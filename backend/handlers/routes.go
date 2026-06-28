package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type RouteAirport struct {
	City string  `json:"city"`
	Code string  `json:"code"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
}

type LiveRoute struct {
	From    RouteAirport `json:"from"`
	To      RouteAirport `json:"to"`
	Minutes int          `json:"minutes"`
}

// routeCatalogue mirrors the tiers in the frontend liveRoutes.js.
var routeCatalogue = []LiveRoute{
	// 15–25 min
	{From: RouteAirport{"Berlin", "BER", 52.36, 13.50},    To: RouteAirport{"Hamburg", "HAM", 53.63, 9.99},    Minutes: 15},
	{From: RouteAirport{"Paris", "CDG", 49.01, 2.55},      To: RouteAirport{"Brussels", "BRU", 50.90, 4.48},   Minutes: 18},
	{From: RouteAirport{"Istanbul", "IST", 40.98, 28.82},  To: RouteAirport{"Ankara", "ESB", 40.12, 32.99},    Minutes: 20},
	{From: RouteAirport{"Madrid", "MAD", 40.47, -3.56},    To: RouteAirport{"Barcelona", "BCN", 41.30, 2.08},  Minutes: 20},
	{From: RouteAirport{"Munich", "MUC", 48.35, 11.79},    To: RouteAirport{"Vienna", "VIE", 48.11, 16.57},    Minutes: 25},
	{From: RouteAirport{"Dubai", "DXB", 25.25, 55.36},     To: RouteAirport{"Muscat", "MCT", 23.59, 58.28},    Minutes: 25},
	// 35–55 min
	{From: RouteAirport{"Istanbul", "IST", 40.98, 28.82},  To: RouteAirport{"Athens", "ATH", 37.94, 23.94},    Minutes: 35},
	{From: RouteAirport{"Rome", "FCO", 41.80, 12.24},      To: RouteAirport{"Munich", "MUC", 48.35, 11.79},    Minutes: 40},
	{From: RouteAirport{"London", "LHR", 51.48, -0.46},    To: RouteAirport{"Paris", "CDG", 49.01, 2.55},      Minutes: 45},
	{From: RouteAirport{"Frankfurt", "FRA", 50.03, 8.57},  To: RouteAirport{"Warsaw", "WAW", 52.17, 20.97},    Minutes: 50},
	// 60–90 min
	{From: RouteAirport{"London", "LHR", 51.48, -0.46},    To: RouteAirport{"Madrid", "MAD", 40.47, -3.56},    Minutes: 65},
	{From: RouteAirport{"Berlin", "BER", 52.36, 13.50},    To: RouteAirport{"Athens", "ATH", 37.94, 23.94},    Minutes: 70},
	{From: RouteAirport{"Paris", "CDG", 49.01, 2.55},      To: RouteAirport{"Moscow", "SVO", 55.97, 37.41},    Minutes: 80},
	{From: RouteAirport{"Istanbul", "IST", 40.98, 28.82},  To: RouteAirport{"Dubai", "DXB", 25.25, 55.36},     Minutes: 90},
	// 110–120 min
	{From: RouteAirport{"London", "LHR", 51.48, -0.46},    To: RouteAirport{"Istanbul", "IST", 40.98, 28.82},  Minutes: 110},
	{From: RouteAirport{"Singapore", "SIN", 1.36, 103.99}, To: RouteAirport{"Tokyo", "NRT", 35.77, 140.39},    Minutes: 120},
}

// GetRoutes returns the public route catalogue.
func GetRoutes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"routes": routeCatalogue})
}
