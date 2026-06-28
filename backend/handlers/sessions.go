package handlers

import (
	"flodoro/backend/database"
	"flodoro/backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type createSessionReq struct {
	Mode        string  `json:"mode"`
	SubMode     string  `json:"sub_mode"`
	OriginCity  string  `json:"origin_city"`
	OriginCode  string  `json:"origin_code"`
	DestCity    string  `json:"dest_city"`
	DestCode    string  `json:"dest_code"`
	DurationMin int     `json:"duration_min"`
	DistanceKm  float64 `json:"distance_km"`
	Callsign    string  `json:"callsign"`
	IsRealistic bool    `json:"is_realistic"`
}

func CreateSession(c *gin.Context) {
	uid := c.GetUint("user_id")
	var req createSessionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	s := models.Session{
		UserID:      uid,
		Mode:        req.Mode,
		SubMode:     req.SubMode,
		OriginCity:  req.OriginCity,
		OriginCode:  req.OriginCode,
		DestCity:    req.DestCity,
		DestCode:    req.DestCode,
		DurationMin: req.DurationMin,
		DistanceKm:  req.DistanceKm,
		Callsign:    req.Callsign,
		IsRealistic: req.IsRealistic,
		Status:      "in_progress",
	}
	database.DB.Create(&s)
	c.JSON(http.StatusCreated, s)
}

type completeReq struct {
	DurationMin int     `json:"duration_min"`
	DistanceKm  float64 `json:"distance_km"`
	Status      string  `json:"status"` // completed | cancelled
}

func CompleteSession(c *gin.Context) {
	uid := c.GetUint("user_id")
	id := c.Param("id")

	var req completeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var s models.Session
	if res := database.DB.Where("id = ? AND user_id = ?", id, uid).First(&s); res.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session bulunamadı"})
		return
	}

	now := time.Now()
	status := req.Status
	if status == "" {
		status = "completed"
	}
	if req.DurationMin > 0 {
		s.DurationMin = req.DurationMin
	}
	if req.DistanceKm > 0 {
		s.DistanceKm = req.DistanceKm
	}
	s.Status = status
	s.CompletedAt = &now
	database.DB.Save(&s)

	if status == "completed" {
		parts := models.PartsPerSession(s.DurationMin)
		database.DB.Exec(
			"UPDATE users SET total_minutes = total_minutes + ?, total_km = total_km + ?, session_count = session_count + 1, total_parts = total_parts + ? WHERE id = ?",
			s.DurationMin, s.DistanceKm, parts, uid,
		)
	}

	c.JSON(http.StatusOK, s)
}

func ListSessions(c *gin.Context) {
	uid := c.GetUint("user_id")
	var sessions []models.Session
	database.DB.
		Where("user_id = ? AND status = ?", uid, "completed").
		Order("created_at DESC").
		Limit(50).
		Find(&sessions)
	c.JSON(http.StatusOK, sessions)
}
