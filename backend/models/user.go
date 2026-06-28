package models

type User struct {
	Base
	Email        string  `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string  `gorm:"not null" json:"-"`
	DisplayName  string  `json:"display_name"`
	TotalMinutes int     `json:"total_minutes"`
	TotalKm      float64 `json:"total_km"`
	SessionCount int     `json:"session_count"`
	TotalParts   int     `json:"total_parts"`
	SpentParts   int     `json:"spent_parts"`
	AvatarCode     string `json:"avatar_code"`
	PurchasedSlots int    `gorm:"not null;default:0" json:"purchased_slots"`
}
