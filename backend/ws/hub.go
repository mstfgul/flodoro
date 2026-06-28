package ws

import (
	"encoding/json"
	"flodoro/backend/database"
	"flodoro/backend/models"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Message is the JSON envelope for all WS traffic.
type Message struct {
	Type           string `json:"type"`
	ID             uint   `json:"id,omitempty"`
	UserID         uint   `json:"user_id,omitempty"`
	DisplayName    string `json:"display_name,omitempty"`
	Content        string `json:"content,omitempty"`
	Timestamp      string `json:"timestamp,omitempty"`
	Duration       int    `json:"duration,omitempty"`
	StartedAt      string `json:"started_at,omitempty"`
	ElapsedSeconds int    `json:"elapsed_seconds,omitempty"`
	Active         bool   `json:"active,omitempty"`
	// route selected by host (propagated to all clients)
	OriginCode string `json:"origin_code,omitempty"`
	DestCode   string `json:"dest_code,omitempty"`
	FromCity   string `json:"from_city,omitempty"`
	ToCity     string `json:"to_city,omitempty"`
}

// Client is one WebSocket connection inside a room.
type Client struct {
	userID      uint
	displayName string
	conn        *websocket.Conn
	send        chan []byte
	room        *Room
}

// Room manages all clients in one live session.
type Room struct {
	code      string
	sessionID uint
	hostUID   uint
	clients   map[uint]*Client
	broadcast chan []byte
	join      chan *Client
	leave     chan *Client
	mu        sync.RWMutex
	// focus session state (in-memory only)
	focusActive      bool
	focusStartedAt   time.Time
	focusDuration    int
	focusOriginCode  string
	focusDestCode    string
	focusFromCity    string
	focusToCity      string
}

func (r *Room) run() {
	for {
		select {
		case c := <-r.join:
			r.mu.Lock()
			r.clients[c.userID] = c
			r.mu.Unlock()
		case c := <-r.leave:
			r.mu.Lock()
			if existing, ok := r.clients[c.userID]; ok && existing == c {
				delete(r.clients, c.userID)
				close(c.send)
			}
			r.mu.Unlock()
		case msg := <-r.broadcast:
			r.mu.RLock()
			for _, c := range r.clients {
				select {
				case c.send <- msg:
				default:
				}
			}
			r.mu.RUnlock()
		}
	}
}

// Hub holds all active rooms.
type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

var GlobalHub = &Hub{rooms: make(map[string]*Room)}

func (h *Hub) getOrCreate(code string, sessionID, hostUID uint) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r, ok := h.rooms[code]; ok {
		return r
	}
	r := &Room{
		code:      code,
		sessionID: sessionID,
		hostUID:   hostUID,
		clients:   make(map[uint]*Client),
		broadcast: make(chan []byte, 256),
		join:      make(chan *Client, 32),
		leave:     make(chan *Client, 32),
	}
	go r.run()
	h.rooms[code] = r
	return r
}

// writePump pushes queued messages to the WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump handles incoming messages: chat, start_focus, end_focus.
func (c *Client) readPump() {
	defer func() {
		leaveMsg := Message{
			Type:        "leave",
			UserID:      c.userID,
			DisplayName: c.displayName,
			Timestamp:   time.Now().UTC().Format(time.RFC3339),
		}
		if raw, err := json.Marshal(leaveMsg); err == nil {
			c.room.broadcast <- raw
		}
		// Mark participant as left in DB (other participants are not affected)
		now := time.Now()
		database.DB.Model(&models.LiveParticipant{}).
			Where("live_session_id = ? AND user_id = ?", c.room.sessionID, c.userID).
			Update("left_at", &now)
		// Update cached participant count
		var active int64
		database.DB.Model(&models.LiveParticipant{}).
			Where("live_session_id = ? AND left_at IS NULL", c.room.sessionID).
			Count(&active)
		database.DB.Model(&models.LiveSession{}).Where("id = ?", c.room.sessionID).
			Update("participant_count", active)

		c.room.leave <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws read error uid=%d: %v", c.userID, err)
			}
			break
		}

		var incoming struct {
			Type       string `json:"type"`
			Content    string `json:"content"`
			Duration   int    `json:"duration"`
			OriginCode string `json:"origin_code"`
			DestCode   string `json:"dest_code"`
			FromCity   string `json:"from_city"`
			ToCity     string `json:"to_city"`
		}
		if err := json.Unmarshal(raw, &incoming); err != nil {
			continue
		}

		switch incoming.Type {

		case "start_focus":
			// Only the host can start a focus session
			if c.userID != c.room.hostUID || c.room.focusActive {
				continue
			}
			dur := incoming.Duration
			if dur <= 0 {
				dur = 25
			}
			now := time.Now()
			c.room.mu.Lock()
			c.room.focusActive = true
			c.room.focusStartedAt = now
			c.room.focusDuration = dur
			c.room.focusOriginCode = incoming.OriginCode
			c.room.focusDestCode = incoming.DestCode
			c.room.focusFromCity = incoming.FromCity
			c.room.focusToCity = incoming.ToCity
			c.room.mu.Unlock()

			out := Message{
				Type:        "focus_started",
				UserID:      c.userID,
				DisplayName: c.displayName,
				Duration:    dur,
				StartedAt:   now.UTC().Format(time.RFC3339),
				Timestamp:   now.UTC().Format(time.RFC3339),
				OriginCode:  incoming.OriginCode,
				DestCode:    incoming.DestCode,
				FromCity:    incoming.FromCity,
				ToCity:      incoming.ToCity,
			}
			if outRaw, err := json.Marshal(out); err == nil {
				c.room.broadcast <- outRaw
			}

		case "end_focus":
			// Host ends the group focus session
			if c.userID != c.room.hostUID || !c.room.focusActive {
				continue
			}
			c.room.mu.Lock()
			c.room.focusActive = false
			c.room.mu.Unlock()

			out := Message{Type: "focus_ended", Timestamp: time.Now().UTC().Format(time.RFC3339)}
			if outRaw, err := json.Marshal(out); err == nil {
				c.room.broadcast <- outRaw
			}

		default:
			// Treat as chat message
			if incoming.Content == "" {
				continue
			}
			cm := models.ChatMessage{
				LiveSessionID: c.room.sessionID,
				UserID:        c.userID,
				DisplayName:   c.displayName,
				Content:       incoming.Content,
			}
			database.DB.Create(&cm)

			out := Message{
				Type:        "chat",
				ID:          cm.ID,
				UserID:      c.userID,
				DisplayName: c.displayName,
				Content:     incoming.Content,
				Timestamp:   cm.CreatedAt.UTC().Format(time.RFC3339),
			}
			if outRaw, err := json.Marshal(out); err == nil {
				c.room.broadcast <- outRaw
			}
		}
	}
}

// ServeWS upgrades to WebSocket and attaches the client to the session room.
func ServeWS(c *gin.Context) {
	uid := c.GetUint("user_id")
	code := c.Param("code")

	var ls models.LiveSession
	if database.DB.Where("join_code = ? AND status = ?", code, "active").First(&ls).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	var p models.LiveParticipant
	if database.DB.Where("live_session_id = ? AND user_id = ?", ls.ID, uid).First(&p).Error != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "join the session first"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	room := GlobalHub.getOrCreate(code, ls.ID, ls.HostUserID)
	client := &Client{
		userID:      uid,
		displayName: p.DisplayName,
		conn:        conn,
		send:        make(chan []byte, 64),
		room:        room,
	}
	// Synchronously add the client so it is in r.clients before any broadcasts fire.
	room.mu.Lock()
	room.clients[client.userID] = client
	room.mu.Unlock()

	// If a focus session is already active, send current state to the new joiner
	room.mu.RLock()
	if room.focusActive {
		elapsed := int(time.Since(room.focusStartedAt).Seconds())
		state := Message{
			Type:           "focus_state",
			Active:         true,
			Duration:       room.focusDuration,
			StartedAt:      room.focusStartedAt.UTC().Format(time.RFC3339),
			ElapsedSeconds: elapsed,
			OriginCode:     room.focusOriginCode,
			DestCode:       room.focusDestCode,
			FromCity:       room.focusFromCity,
			ToCity:         room.focusToCity,
		}
		if raw, err := json.Marshal(state); err == nil {
			client.send <- raw
		}
	}
	room.mu.RUnlock()

	// Broadcast join announcement
	joinMsg := Message{
		Type:        "join",
		UserID:      uid,
		DisplayName: p.DisplayName,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
	if raw, err := json.Marshal(joinMsg); err == nil {
		room.broadcast <- raw
	}

	go client.writePump()
	client.readPump()
}
