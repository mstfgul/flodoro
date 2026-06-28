package database

import (
	"flodoro/backend/models"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	var err error
	DB, err = gorm.Open(sqlite.Open("flodoro.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatal("database connection failed:", err)
	}

	if err = DB.AutoMigrate(
		&models.User{},
		&models.Session{},
		&models.UserAircraft{},
		&models.FriendRequest{},
		&models.Friend{},
		&models.LiveSession{},
		&models.LiveParticipant{},
		&models.ChatMessage{},
	); err != nil {
		log.Fatal("migration failed:", err)
	}

	// Backfill: columns added after initial release may be NULL for existing rows.
	// NULL arithmetic (NULL + 1 = NULL) silently breaks slot purchases.
	DB.Exec("UPDATE users SET purchased_slots = 0 WHERE purchased_slots IS NULL")
	DB.Exec("UPDATE users SET total_parts = 0 WHERE total_parts IS NULL")
	DB.Exec("UPDATE users SET spent_parts = 0 WHERE spent_parts IS NULL")
	DB.Exec("UPDATE users SET total_minutes = 0 WHERE total_minutes IS NULL")
	DB.Exec("UPDATE users SET session_count = 0 WHERE session_count IS NULL")

	log.Println("database connected: flodoro.db")
}
