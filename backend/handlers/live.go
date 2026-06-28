package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"flodoro/backend/database"
	"flodoro/backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func generateJoinCode() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b) // 8 hex chars
}

// CreateLiveSession creates a new public/friends/private session.
func CreateLiveSession(c *gin.Context) {
	uid := c.GetUint("user_id")
	var user models.User
	database.DB.First(&user, uid)

	var body struct {
		Title      string `json:"title"`
		Visibility string `json:"visibility"` // public | friends | private
	}
	c.ShouldBindJSON(&body)
	if body.Visibility == "" {
		body.Visibility = "public"
	}
	if body.Title == "" {
		body.Title = user.DisplayName + "'s Session"
	}

	// End any existing active sessions by this user
	database.DB.Model(&models.LiveSession{}).
		Where("host_user_id = ? AND status = ?", uid, "active").
		Updates(map[string]interface{}{"status": "ended", "ended_at": time.Now()})

	code := generateJoinCode()
	ls := models.LiveSession{
		HostUserID: uid,
		HostName:   user.DisplayName,
		Title:      body.Title,
		JoinCode:   code,
		Visibility: body.Visibility,
		Status:     "active",
		StartedAt:  time.Now(),
	}
	database.DB.Create(&ls)

	// Auto-join the host
	database.DB.Create(&models.LiveParticipant{
		LiveSessionID: ls.ID,
		UserID:        uid,
		DisplayName:   user.DisplayName,
	})
	database.DB.Model(&ls).Update("participant_count", 1)

	c.JSON(http.StatusCreated, ls)
}

// GetLiveSessions returns active sessions visible to the caller.
func GetLiveSessions(c *gin.Context) {
	uid := c.GetUint("user_id")

	// Get caller's friend IDs
	var friendRows []models.Friend
	database.DB.Where("user_id = ?", uid).Find(&friendRows)
	friendIDs := make([]uint, 0, len(friendRows))
	for _, f := range friendRows {
		friendIDs = append(friendIDs, f.FriendID)
	}

	// Always include public sessions + friends sessions where host is a friend
	var sessions []models.LiveSession
	if len(friendIDs) > 0 {
		database.DB.Where(
			"status = ? AND (visibility = ? OR (visibility = ? AND host_user_id IN ?))",
			"active", "public", "friends", friendIDs,
		).Order("participant_count desc, started_at desc").Limit(50).Find(&sessions)
	} else {
		database.DB.Where("status = ? AND visibility = ?", "active", "public").
			Order("participant_count desc, started_at desc").Limit(50).Find(&sessions)
	}

	// Enrich with elapsed time
	type SessionView struct {
		models.LiveSession
		ElapsedSeconds int `json:"elapsed_seconds"`
		IsFriend       bool `json:"is_friend"`
	}

	friendSet := make(map[uint]bool, len(friendIDs))
	for _, id := range friendIDs {
		friendSet[id] = true
	}

	result := make([]SessionView, 0, len(sessions))
	for _, s := range sessions {
		result = append(result, SessionView{
			LiveSession:    s,
			ElapsedSeconds: int(time.Since(s.StartedAt).Seconds()),
			IsFriend:       friendSet[s.HostUserID],
		})
	}
	c.JSON(http.StatusOK, result)
}

// GetLiveSession retrieves one session by join code.
func GetLiveSession(c *gin.Context) {
	code := c.Param("code")
	var ls models.LiveSession
	if database.DB.Where("join_code = ?", code).First(&ls).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	var participants []models.LiveParticipant
	database.DB.Where("live_session_id = ? AND left_at IS NULL", ls.ID).Find(&participants)

	var messages []models.ChatMessage
	database.DB.Where("live_session_id = ?", ls.ID).Order("created_at asc").Limit(100).Find(&messages)

	c.JSON(http.StatusOK, gin.H{
		"session":      ls,
		"participants": participants,
		"messages":     messages,
		"elapsed_seconds": int(time.Since(ls.StartedAt).Seconds()),
	})
}

// JoinLiveSession records the user as a participant.
func JoinLiveSession(c *gin.Context) {
	uid := c.GetUint("user_id")
	code := c.Param("code")

	var ls models.LiveSession
	if database.DB.Where("join_code = ? AND status = ?", code, "active").First(&ls).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found or ended"})
		return
	}

	// friends-only visibility check
	if ls.Visibility == "friends" {
		var f models.Friend
		if database.DB.Where("user_id = ? AND friend_id = ?", uid, ls.HostUserID).First(&f).Error != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "this session is friends-only"})
			return
		}
	}

	var user models.User
	database.DB.First(&user, uid)

	// Already a participant? Re-activate.
	var p models.LiveParticipant
	if database.DB.Where("live_session_id = ? AND user_id = ?", ls.ID, uid).First(&p).Error == nil {
		if p.LeftAt != nil {
			database.DB.Model(&p).Update("left_at", nil)
			database.DB.Model(&ls).Update("participant_count", ls.ParticipantCount+1)
		}
	} else {
		database.DB.Create(&models.LiveParticipant{
			LiveSessionID: ls.ID,
			UserID:        uid,
			DisplayName:   user.DisplayName,
		})
		database.DB.Model(&ls).Update("participant_count", ls.ParticipantCount+1)
	}

	c.JSON(http.StatusOK, gin.H{"join_code": code, "session_id": ls.ID})
}

// EndLiveSession ends the session (host only).
func EndLiveSession(c *gin.Context) {
	uid := c.GetUint("user_id")
	code := c.Param("code")

	var ls models.LiveSession
	if database.DB.Where("join_code = ? AND host_user_id = ? AND status = ?", code, uid, "active").First(&ls).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found or not your session"})
		return
	}

	now := time.Now()
	database.DB.Model(&ls).Updates(map[string]interface{}{"status": "ended", "ended_at": &now})
	c.JSON(http.StatusOK, gin.H{"status": "ended"})
}
