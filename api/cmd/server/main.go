// This is the main entry point for the API server.
package main

import (
	"log"

	"github.com/gin-gonic/gin"

	// Import our internal packages
	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/db"
)

func main() {
	// 1. Load Configuration
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// 2. Initialize Database
	database, err := db.Init(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Could not connect to the database: %v", err)
	}
	// `database` variable is now available but unused. We'll use it in handlers.
	_ = database // This line silences the "unused variable" error for now.

	// 3. Set up Gin Router
	r := gin.Default()

	// 4. Define a simple health-check endpoint
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// 5. Start Server
	log.Printf("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
