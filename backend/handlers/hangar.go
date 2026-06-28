package handlers

import (
	"errors"
	"flodoro/backend/database"
	"flodoro/backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetHangar(c *gin.Context) {
	uid := c.GetUint("user_id")

	var user models.User
	if database.DB.First(&user, uid).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var owned []models.UserAircraft
	database.DB.Where("user_id = ?", uid).Order("hangar_slot asc").Find(&owned)

	available := user.TotalParts - user.SpentParts
	earned := models.HangarCapacity(user.TotalMinutes)
	total := earned + user.PurchasedSlots

	c.JSON(http.StatusOK, gin.H{
		"owned":           owned,
		"total_parts":     user.TotalParts,
		"spent_parts":     user.SpentParts,
		"available_parts": available,
		"capacity":        total,
		"earned_slots":    earned,
		"purchased_slots": user.PurchasedSlots,
		"next_slot_cost":  models.SlotPurchaseCost(user.PurchasedSlots),
		"total_minutes":   user.TotalMinutes,
		"catalog":         models.Catalog,
	})
}

func ClaimAircraft(c *gin.Context) {
	uid := c.GetUint("user_id")
	code := c.Param("code")

	var def *models.AircraftDef
	for i := range models.Catalog {
		if models.Catalog[i].Code == code {
			def = &models.Catalog[i]
			break
		}
	}
	if def == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aircraft not in catalog"})
		return
	}

	var ua models.UserAircraft
	var httpStatus int

	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if tx.First(&user, uid).Error != nil {
			httpStatus = http.StatusNotFound
			return errors.New("user not found")
		}

		var existing models.UserAircraft
		if tx.Where("user_id = ? AND aircraft_code = ?", uid, code).First(&existing).Error == nil {
			httpStatus = http.StatusConflict
			return errors.New("already owned")
		}

		available := user.TotalParts - user.SpentParts
		if available < def.PartsRequired {
			httpStatus = http.StatusPaymentRequired
			return errors.New("not enough parts")
		}

		var count int64
		tx.Model(&models.UserAircraft{}).Where("user_id = ?", uid).Count(&count)

		capacity := models.HangarCapacity(user.TotalMinutes) + user.PurchasedSlots
		if int(count) >= capacity {
			httpStatus = http.StatusForbidden
			return errors.New("hangar full — buy more slots to expand")
		}

		ua = models.UserAircraft{UserID: uid, AircraftCode: code, HangarSlot: int(count)}
		if err := tx.Create(&ua).Error; err != nil {
			return err
		}

		return tx.Exec(
			"UPDATE users SET spent_parts = spent_parts + ? WHERE id = ?",
			def.PartsRequired, uid,
		).Error
	})

	if txErr != nil {
		status := httpStatus
		if status == 0 {
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": txErr.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"aircraft": ua, "parts_spent": def.PartsRequired})
}

func BuySlot(c *gin.Context) {
	uid := c.GetUint("user_id")

	var purchased, capacity, nextCost, avail int
	var httpStatus int

	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if tx.First(&user, uid).Error != nil {
			httpStatus = http.StatusNotFound
			return errors.New("user not found")
		}

		cost := models.SlotPurchaseCost(user.PurchasedSlots)
		available := user.TotalParts - user.SpentParts

		if available < cost {
			httpStatus = http.StatusPaymentRequired
			return errors.New("not enough parts")
		}

		// Simple atomic increment — SQLite serialises writes, so this is race-safe.
		// RowsAffected is intentionally NOT checked: glebarez/sqlite returns unreliable
		// values inside transactions, causing false "concurrent request" errors.
		if err := tx.Exec(
			"UPDATE users SET spent_parts = spent_parts + ?, purchased_slots = purchased_slots + 1 WHERE id = ?",
			cost, uid,
		).Error; err != nil {
			return err
		}

		purchased = user.PurchasedSlots + 1
		capacity = models.HangarCapacity(user.TotalMinutes) + purchased
		nextCost = models.SlotPurchaseCost(purchased)
		avail = available - cost
		return nil
	})

	if txErr != nil {
		status := httpStatus
		if status == 0 {
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": txErr.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"purchased_slots": purchased,
		"capacity":        capacity,
		"next_slot_cost":  nextCost,
		"available_parts": avail,
	})
}
