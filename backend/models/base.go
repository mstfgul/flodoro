package models

import (
	"time"

	"gorm.io/gorm"
)

// Base replaces gorm.Model with explicit json tags so IDs serialize as "id" (lowercase).
type Base struct {
	ID        uint           `gorm:"primarykey;autoIncrement" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
