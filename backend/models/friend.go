package models

// FriendRequest — pending or responded friendship request.
type FriendRequest struct {
	Base
	SenderID   uint   `json:"sender_id"`
	ReceiverID uint   `json:"receiver_id"`
	Status     string `json:"status"` // pending | accepted | rejected
}

// Friend — bidirectional friendship.
type Friend struct {
	Base
	UserID   uint `json:"user_id"`
	FriendID uint `json:"friend_id"`
}
