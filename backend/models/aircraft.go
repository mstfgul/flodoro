package models

// UserAircraft — aircraft unlocked by the user.
type UserAircraft struct {
	Base
	UserID       uint   `json:"user_id"`
	AircraftCode string `json:"aircraft_code"`
	HangarSlot   int    `json:"hangar_slot"` // display position in hangar
}

// AircraftDef is the static catalog definition (used by both backend validation and frontend).
type AircraftDef struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	PartsRequired int    `json:"parts_required"`
}

// Catalog — ordered by parts required. Frontend adds visuals (photo, color, description).
var Catalog = []AircraftDef{
	{Code: "CESSNA_172",     Name: "Cessna 172",           PartsRequired: 60},
	{Code: "PIPER_CHEROKEE", Name: "Piper Cherokee",        PartsRequired: 180},
	{Code: "BEECH_BARON",    Name: "Beechcraft Baron",      PartsRequired: 360},
	{Code: "TWIN_OTTER",     Name: "DHC-6 Twin Otter",      PartsRequired: 720},
	{Code: "ATR_72",         Name: "ATR 72",                PartsRequired: 1500},
	{Code: "EMB_E175",       Name: "Embraer E175",          PartsRequired: 3000},
	{Code: "B737",           Name: "Boeing 737-800",        PartsRequired: 6000},
	{Code: "A320",           Name: "Airbus A320",           PartsRequired: 9000},
	{Code: "B787",           Name: "Boeing 787 Dreamliner", PartsRequired: 15000},
	{Code: "A350",           Name: "Airbus A350 XWB",       PartsRequired: 24000},
	{Code: "B747",           Name: "Boeing 747-8",          PartsRequired: 40000},
	{Code: "A380",           Name: "Airbus A380",           PartsRequired: 60000},
	{Code: "CONCORDE",       Name: "Concorde",              PartsRequired: 100000},
}

// HangarCapacity returns max hangar slots based on total focus minutes.
func HangarCapacity(totalMinutes int) int {
	switch {
	case totalMinutes >= 40000:
		return 13
	case totalMinutes >= 15000:
		return 10
	case totalMinutes >= 6000:
		return 8
	case totalMinutes >= 1500:
		return 6
	case totalMinutes >= 360:
		return 4
	default:
		return 3
	}
}

// SlotPurchaseCost returns the parts cost for the next slot purchase.
// Cost escalates: 200 → 600 → 1500 → 3500 → 8000 → 18000 → doubles each time.
func SlotPurchaseCost(purchasedSlots int) int {
	costs := []int{200, 600, 1500, 3500, 8000, 18000}
	if purchasedSlots < len(costs) {
		return costs[purchasedSlots]
	}
	base := costs[len(costs)-1]
	extra := purchasedSlots - len(costs) + 1
	for i := 0; i < extra; i++ {
		base *= 2
	}
	return base
}

// PartsPerSession calculates parts earned for a completed session.
func PartsPerSession(durationMinutes int) int {
	if durationMinutes <= 0 {
		return 0
	}
	// Base: 1 part per minute, bonus for long sessions
	base := durationMinutes
	if durationMinutes >= 50 {
		base += 10 // bonus for 50+ min sessions
	} else if durationMinutes >= 25 {
		base += 5 // bonus for 25+ min
	}
	return base
}
