package handlers

import (
	"flodoro/backend/database"
	"flodoro/backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type DayData struct {
	Date     string  `json:"date"`
	Sessions int     `json:"sessions"`
	Minutes  int     `json:"minutes"`
	KmFlown  float64 `json:"km_flown"`
}

func GetStats(c *gin.Context) {
	uid := c.GetUint("user_id")

	var user models.User
	if res := database.DB.First(&user, uid); res.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "kullanıcı bulunamadı"})
		return
	}

	streak, longest := calcStreaks(uid)

	// Miles = km * 0.621371
	totalMiles := user.TotalKm * 0.621371

	c.JSON(http.StatusOK, gin.H{
		"total_sessions": user.SessionCount,
		"total_minutes":  user.TotalMinutes,
		"total_km":       user.TotalKm,
		"total_miles":    totalMiles,
		"current_streak": streak,
		"longest_streak": longest,
		"display_name":   user.DisplayName,
	})
}

func GetHistory(c *gin.Context) {
	uid := c.GetUint("user_id")

	// Last 30 days
	since := time.Now().AddDate(0, 0, -29).Truncate(24 * time.Hour)

	type row struct {
		Date     string
		Sessions int
		Minutes  int
		KmFlown  float64
	}

	var rows []row
	database.DB.Raw(`
		SELECT
			DATE(completed_at) as date,
			COUNT(*) as sessions,
			SUM(duration_min) as minutes,
			SUM(distance_km) as km_flown
		FROM sessions
		WHERE user_id = ?
		  AND status = 'completed'
		  AND completed_at >= ?
		GROUP BY DATE(completed_at)
		ORDER BY date ASC
	`, uid, since).Scan(&rows)

	// Build full 30-day map (fill missing days with zeros)
	dayMap := make(map[string]DayData)
	for _, r := range rows {
		dayMap[r.Date] = DayData{Date: r.Date, Sessions: r.Sessions, Minutes: r.Minutes, KmFlown: r.KmFlown}
	}

	result := make([]DayData, 30)
	for i := 0; i < 30; i++ {
		d := since.AddDate(0, 0, i).Format("2006-01-02")
		if v, ok := dayMap[d]; ok {
			result[i] = v
		} else {
			result[i] = DayData{Date: d}
		}
	}

	c.JSON(http.StatusOK, result)
}

func calcStreaks(userID uint) (current, longest int) {
	type dateRow struct{ Date string }
	var rows []dateRow
	database.DB.Raw(`
		SELECT DISTINCT DATE(completed_at) as date
		FROM sessions
		WHERE user_id = ? AND status = 'completed'
		ORDER BY date DESC
	`, userID).Scan(&rows)

	if len(rows) == 0 {
		return 0, 0
	}

	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	// Current streak: only count if today or yesterday has a session
	if rows[0].Date != today && rows[0].Date != yesterday {
		current = 0
	} else {
		current = 1
		for i := 1; i < len(rows); i++ {
			prev, _ := time.Parse("2006-01-02", rows[i-1].Date)
			curr, _ := time.Parse("2006-01-02", rows[i].Date)
			if prev.Sub(curr) == 24*time.Hour {
				current++
			} else {
				break
			}
		}
	}

	// Longest streak
	run := 1
	for i := 1; i < len(rows); i++ {
		prev, _ := time.Parse("2006-01-02", rows[i-1].Date)
		curr, _ := time.Parse("2006-01-02", rows[i].Date)
		if prev.Sub(curr) == 24*time.Hour {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 1
		}
	}
	if run > longest {
		longest = run
	}
	if current > longest {
		longest = current
	}
	return
}
