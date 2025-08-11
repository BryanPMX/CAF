// api/cmd/server/main.go
package main

import (
	"log"
	"net/http"
	"time"

	// Internal packages for our application
	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/db"
	"github.com/BryanPMX/CAF/api/handlers"
	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/utils/storage"

	// External packages (dependencies)
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// main is the primary function that starts the entire API server.
func main() {
	// --- Step 1: Initialize Configuration ---
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("FATAL: Failed to load configuration: %v", err)
	}

	// --- Step 2: Initialize Database Connection ---
	database, err := db.Init(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: Could not connect to the database: %v", err)
	}

	// --- Step 3: Initialize S3 Storage Client ---
	if err := storage.InitS3(); err != nil {
		log.Fatalf("FATAL: Failed to initialize S3 client: %v", err)
	}
	if err := storage.CreateBucketIfNotExists(); err != nil {
		log.Fatalf("FATAL: Failed to ensure S3 bucket exists: %v", err)
	}

	// --- Step 4: Set up Gin HTTP Router ---
	r := gin.Default()

	// --- Step 5: Apply Global Middleware ---
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // For development. In production, this should be restricted.
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// --- Step 6: Define API Routes ---

	// Group 1: Public Routes (No authentication required)
	public := r.Group("/api/v1")
	{
		public.POST("/register", handlers.Register(database))
		public.POST("/login", handlers.Login(database, cfg.JWTSecret))
	}

	// Group 2: Protected Routes (Requires any valid login token)
	protected := r.Group("/api/v1")
	protected.Use(middleware.JWTAuth(cfg.JWTSecret))
	protected.Use(middleware.DataScope(database))
	{
		protected.GET("/profile", func(c *gin.Context) {
			userID, _ := c.Get("userID")
			var user models.User
			if err := database.First(&user, "id = ?", userID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"userID": userID, "role": user.Role})
		})
		protected.POST("/appointments", handlers.CreateAppointment(database))
		protected.GET("/appointments", handlers.GetAppointments(database))
		protected.GET("/cases", handlers.GetCases(database))
		protected.GET("/cases/:id", handlers.GetCaseByID(database))
	}

	// Group 3: Admin-Only Routes (Requires a login token from a user with the 'admin' role)
	admin := r.Group("/api/v1/admin")
	admin.Use(middleware.JWTAuth(cfg.JWTSecret))
	admin.Use(middleware.RoleAuth(database, "admin"))
	{
		// User Management
		admin.POST("/users", handlers.CreateUser(database))
		admin.GET("/users", handlers.GetUsers(database))
		admin.PATCH("/users/:id", handlers.UpdateUser(database))
		admin.DELETE("/users/:id", handlers.DeleteUser(database))
		admin.DELETE("/users/:id/permanent", handlers.PermanentDeleteUser(database))

		// Office Management
		admin.POST("/offices", handlers.CreateOffice(database))
		admin.GET("/offices", handlers.GetOffices(database))
		admin.PATCH("/offices/:id", handlers.UpdateOffice(database))
		admin.DELETE("/offices/:id", handlers.DeleteOffice(database))

		// Case Management
		admin.POST("/cases", handlers.CreateCase(database))
		admin.PATCH("/cases/:id/stage", handlers.UpdateCaseStage(database))

		// Task Management
		admin.POST("/cases/:caseId/tasks", handlers.CreateTask(database))
		admin.PATCH("/tasks/:taskId", handlers.UpdateTask(database))
		admin.DELETE("/tasks/:taskId", handlers.DeleteTask(database))

		// Case Events
		admin.POST("/cases/:caseId/comments", handlers.CreateComment(database))
		admin.POST("/cases/:caseId/documents", handlers.UploadDocument(database))

		// Appointment Management (Admin)
		admin.POST("/appointments", handlers.CreateAppointmentSmart(database))
		admin.PATCH("/appointments/:id", handlers.UpdateAppointmentAdmin(database))
		admin.DELETE("/appointments/:id", handlers.DeleteAppointmentAdmin(database))

		// Dashboard
		admin.GET("/dashboard-summary", handlers.GetDashboardSummary(database))
		admin.GET("/users/search", handlers.SearchClients(database))                // For client search
		admin.GET("/clients/:clientId/cases", handlers.GetCasesForClient(database)) // For client's cases
	}

	// --- Step 7: Start the Server ---
	log.Printf("INFO: Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("FATAL: Failed to run server: %v", err)
	}
}
