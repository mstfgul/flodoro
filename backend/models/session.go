package models

import "time"

type Session struct {
	Base
	UserID      uint       `json:"user_id"`
	Mode        string     `json:"mode"`        // live | city
	SubMode     string     `json:"sub_mode"`    // short | classic | custom
	OriginCity  string     `json:"origin_city"`
	OriginCode  string     `json:"origin_code"`
	DestCity    string     `json:"dest_city"`
	DestCode    string     `json:"dest_code"`
	DurationMin int        `json:"duration_min"`
	DistanceKm  float64    `json:"distance_km"`
	Callsign    string     `json:"callsign"`
	IsRealistic bool       `json:"is_realistic"`
	Status      string     `json:"status"` // completed | cancelled
	CompletedAt *time.Time `json:"completed_at"`
}
