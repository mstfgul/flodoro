package main

import (
	"flodoro/backend/database"
	"flodoro/backend/handlers"
	"flodoro/backend/middleware"
	"flodoro/backend/ws"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	database.Connect()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")

	// Auth (public)
	auth := api.Group("/auth")
	auth.POST("/register", handlers.Register)
	auth.POST("/login", handlers.Login)
	auth.GET("/me", middleware.AuthRequired(), handlers.Me)

	// Protected
	p := api.Group("/")
	p.Use(middleware.AuthRequired())

	// Focus sessions
	p.POST("/sessions", handlers.CreateSession)
	p.PUT("/sessions/:id/complete", handlers.CompleteSession)
	p.GET("/sessions", handlers.ListSessions)
	p.GET("/stats", handlers.GetStats)
	p.GET("/stats/history", handlers.GetHistory)

	// Hangar & aircraft
	p.GET("/hangar", handlers.GetHangar)
	p.POST("/hangar/claim/:code", handlers.ClaimAircraft)
	p.POST("/hangar/buy-slot", handlers.BuySlot)

	// Friends
	p.GET("/users/search", handlers.SearchUsers)
	p.POST("/friends/request", handlers.SendFriendRequest)
	p.GET("/friends/requests", handlers.GetFriendRequests)
	p.POST("/friends/requests/:id/respond", handlers.RespondFriendRequest)
	p.GET("/friends", handlers.GetFriends)
	p.DELETE("/friends/:id", handlers.RemoveFriend)

	// Routes (public catalogue)
	api.GET("/routes", handlers.GetRoutes)

	// Live sessions
	p.POST("/live", handlers.CreateLiveSession)
	p.GET("/live", handlers.GetLiveSessions)
	p.GET("/live/:code", handlers.GetLiveSession)
	p.POST("/live/:code/join", handlers.JoinLiveSession)
	p.POST("/live/:code/end", handlers.EndLiveSession)

	// WebSocket (needs auth header via query param since WS doesn't support headers easily)
	r.GET("/ws/:code", middleware.AuthRequired(), ws.ServeWS)

	log.Println("Flodoro backend :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
