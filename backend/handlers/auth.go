package handlers

import (
	"flodoro/backend/database"
	"flodoro/backend/middleware"
	"flodoro/backend/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type registerReq struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=6"`
	DisplayName string `json:"display_name"`
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "şifre işlenemedi"})
		return
	}

	name := req.DisplayName
	if name == "" {
		name = strings.Split(req.Email, "@")[0]
	}

	user := models.User{
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  name,
	}
	if res := database.DB.Create(&user); res.Error != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "bu e-posta zaten kayıtlı"})
		return
	}

	token, _ := middleware.MakeToken(user.ID)
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": safeUser(user)})
}

func Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if res := database.DB.Where("email = ?", req.Email).First(&user); res.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "e-posta veya şifre hatalı"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "e-posta veya şifre hatalı"})
		return
	}

	token, _ := middleware.MakeToken(user.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": safeUser(user)})
}

func Me(c *gin.Context) {
	uid := c.GetUint("user_id")
	var user models.User
	if res := database.DB.First(&user, uid); res.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "kullanıcı bulunamadı"})
		return
	}
	c.JSON(http.StatusOK, safeUser(user))
}

func safeUser(u models.User) gin.H {
	return gin.H{
		"id":           u.ID,
		"email":        u.Email,
		"display_name": u.DisplayName,
	}
}
