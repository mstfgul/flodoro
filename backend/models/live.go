package models

import "time"

// LiveSession — a social focus session.
type LiveSession struct {
	Base
	HostUserID       uint       `json:"host_user_id"`
	HostName         string     `json:"host_name"`
	Title            string     `json:"title"`
	JoinCode         string     `gorm:"uniqueIndex;size:8" json:"join_code"`
	Visibility       string     `json:"visibility"` // public | friends | private
	Status           string     `json:"status"`     // active | ended
	ParticipantCount int        `json:"participant_count"`
	StartedAt        time.Time  `json:"started_at"`
	EndedAt          *time.Time `json:"ended_at"`
}

// LiveParticipant — someone who joined a live session.
type LiveParticipant struct {
	Base
	LiveSessionID uint       `json:"live_session_id"`
	UserID        uint       `json:"user_id"`
	DisplayName   string     `json:"display_name"`
	LeftAt        *time.Time `json:"left_at,omitempty"`
}

// ChatMessage — a chat message in a live session.
type ChatMessage struct {
	Base
	LiveSessionID uint   `json:"live_session_id"`
	UserID        uint   `json:"user_id"`
	DisplayName   string `json:"display_name"`
	Content       string `json:"content"`
}
