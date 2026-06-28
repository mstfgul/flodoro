package handlers

import (
	"flodoro/backend/database"
	"flodoro/backend/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SearchUsers finds users by display name or email (for friend search).
func SearchUsers(c *gin.Context) {
	uid := c.GetUint("user_id")
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query too short"})
		return
	}

	var users []models.User
	database.DB.Where("id != ? AND (display_name LIKE ? OR email LIKE ?)", uid, "%"+q+"%", "%"+q+"%").
		Limit(10).Find(&users)

	result := make([]gin.H, 0, len(users))
	for _, u := range users {
		result = append(result, gin.H{"id": u.ID, "display_name": u.DisplayName, "email": u.Email})
	}
	c.JSON(http.StatusOK, result)
}

// SendFriendRequest creates a pending request from caller → target.
func SendFriendRequest(c *gin.Context) {
	senderID := c.GetUint("user_id")
	var body struct {
		ReceiverID uint `json:"receiver_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if senderID == body.ReceiverID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot add yourself"})
		return
	}

	// Already friends?
	var f models.Friend
	if database.DB.Where("(user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)", senderID, body.ReceiverID, body.ReceiverID, senderID).First(&f).Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "already friends"})
		return
	}

	// Pending request exists?
	var req models.FriendRequest
	if database.DB.Where("sender_id=? AND receiver_id=? AND status=?", senderID, body.ReceiverID, "pending").First(&req).Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "request already sent"})
		return
	}

	r := models.FriendRequest{SenderID: senderID, ReceiverID: body.ReceiverID, Status: "pending"}
	database.DB.Create(&r)
	c.JSON(http.StatusCreated, r)
}

// GetFriendRequests returns pending requests received by the caller.
func GetFriendRequests(c *gin.Context) {
	uid := c.GetUint("user_id")
	var reqs []models.FriendRequest
	database.DB.Where("receiver_id = ? AND status = ?", uid, "pending").Find(&reqs)

	result := make([]gin.H, 0, len(reqs))
	for _, r := range reqs {
		var sender models.User
		database.DB.First(&sender, r.SenderID)
		result = append(result, gin.H{
			"id":           r.ID,
			"sender_id":    r.SenderID,
			"sender_name":  sender.DisplayName,
			"sender_email": sender.Email,
			"created_at":   r.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, result)
}

// RespondFriendRequest accepts or rejects a request.
func RespondFriendRequest(c *gin.Context) {
	uid := c.GetUint("user_id")
	id := c.Param("id")
	var body struct {
		Accept bool `json:"accept"`
	}
	c.ShouldBindJSON(&body)

	var req models.FriendRequest
	if database.DB.Where("id = ? AND receiver_id = ? AND status = ?", id, uid, "pending").First(&req).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}

	if body.Accept {
		req.Status = "accepted"
		database.DB.Save(&req)
		// Create bidirectional friendship
		database.DB.Create(&models.Friend{UserID: req.SenderID, FriendID: req.ReceiverID})
		database.DB.Create(&models.Friend{UserID: req.ReceiverID, FriendID: req.SenderID})
		c.JSON(http.StatusOK, gin.H{"status": "accepted"})
	} else {
		req.Status = "rejected"
		database.DB.Save(&req)
		c.JSON(http.StatusOK, gin.H{"status": "rejected"})
	}
}

// GetFriends returns the caller's accepted friends.
func GetFriends(c *gin.Context) {
	uid := c.GetUint("user_id")
	var friends []models.Friend
	database.DB.Where("user_id = ?", uid).Find(&friends)

	result := make([]gin.H, 0, len(friends))
	for _, f := range friends {
		var u models.User
		database.DB.First(&u, f.FriendID)
		result = append(result, gin.H{
			"id":           u.ID,
			"display_name": u.DisplayName,
			"email":        u.Email,
			"total_parts":  u.TotalParts,
			"session_count": u.SessionCount,
		})
	}
	c.JSON(http.StatusOK, result)
}

// RemoveFriend removes a friendship.
func RemoveFriend(c *gin.Context) {
	uid := c.GetUint("user_id")
	fid := c.Param("id")
	database.DB.Where("(user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)", uid, fid, fid, uid).
		Delete(&models.Friend{})
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}
