// api/cmd/server/main.go
package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	// Internal packages for our application
	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/db"
	"github.com/BryanPMX/CAF/api/handlers"
	"github.com/BryanPMX/CAF/api/middleware"
	"github.com/BryanPMX/CAF/api/models"
	"github.com/BryanPMX/CAF/api/services"
	"github.com/BryanPMX/CAF/api/storage"

	// External packages (dependencies)
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
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

	// --- Step 2.5: Run Database Migrations ---
	log.Println("INFO: Running database migrations...")

	// Initialize migration manager
	migrationManager := db.NewMigrationManager(database)

	// Run migrations
	if err := migrationManager.RunMigrations(); err != nil {
		log.Fatalf("FATAL: Failed to run database migrations: %v", err)
	}

	// Get migration status for logging
	migrationStatus, err := migrationManager.GetMigrationStatus()
	if err != nil {
		log.Printf("WARN: Could not get migration status: %v", err)
	} else {
		log.Printf("INFO: Migration status: %d migrations found", len(migrationStatus))
		for _, status := range migrationStatus {
			log.Printf("INFO: Migration %s (%s): %s", status["version"], status["description"], status["status"])
		}
	}

	log.Println("INFO: Database migrations completed successfully")

	// --- Step 2.6: Initialize Session Service ---
	sessionService := services.NewSessionService(database, models.SessionConfig{
		MaxConcurrentSessions: 5,
		SessionTimeout:        24 * time.Hour,
		InactivityTimeout:     30 * time.Minute,
	})
	log.Println("INFO: Session service initialized successfully")

	// --- Step 2.7: Initialize Performance Optimized Handler ---
	performanceHandler := handlers.NewPerformanceOptimizedHandler(database, nil) // nil for Redis - can be configured later
	log.Println("INFO: Performance optimized handler initialized successfully")

	// --- Step 3: Initialize S3 Storage Client ---
	log.Println("INFO: Initializing S3 storage client...")

	// Don't delay for AWS deployment - only for LocalStack
	if os.Getenv("AWS_ENDPOINT_URL") != "" && os.Getenv("AWS_ENDPOINT_URL") != "http://localstack:4566" {
		// This is likely AWS, don't delay
	} else {
		// Add a small delay to ensure LocalStack is fully ready
		time.Sleep(2 * time.Second)
	}

	if err := storage.InitS3(); err != nil {
		log.Printf("WARN: Failed to initialize S3 client: %v", err)
		log.Println("INFO: Continuing without S3 - some features may be limited")
	} else {
		log.Println("INFO: S3 client initialized successfully. Checking bucket...")

		if err := storage.CreateBucketIfNotExists(); err != nil {
			log.Printf("WARN: Failed to ensure S3 bucket exists: %v", err)
			log.Println("INFO: Continuing without S3 bucket verification - some features may be limited")
		} else {
			log.Println("INFO: S3 bucket verified/created successfully")
		}
	}

	// --- Step 4: Set up Gin HTTP Router ---
	r := gin.Default()

	// Enable gzip compression for responses
	r.Use(gzip.Gzip(gzip.BestSpeed))

	// --- Step 5: Apply Global Middleware ---
	// Configure CORS for production deployment
	allowedOrigins := []string{"*"} // Default for development
	
	// Check for CORS configuration from environment
	if corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); corsOrigins != "" {
		allowedOrigins = strings.Split(corsOrigins, ",")
		for i, origin := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(origin)
		}
		log.Printf("INFO: Using CORS origins from environment: %v", allowedOrigins)
	} else if os.Getenv("NODE_ENV") == "production" {
		// Fallback production defaults
		allowedOrigins = []string{
			"https://admin.caf-mexico.org",
			"https://portal.caf-mexico.org",
			"https://caf-mexico.org",
			"https://www.caf-mexico.org",
		}
		log.Printf("INFO: Using default production CORS origins: %v", allowedOrigins)
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Authorization", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Apply general rate limiting to all routes
	r.Use(middleware.GeneralAPIRateLimit())

	// --- Step 6: Define API Routes ---

	// Group 1: Public Routes (No authentication required)
	public := r.Group("/api/v1")
	{
		public.POST("/register", middleware.ValidateUserRegistration(), handlers.Register(database))
		public.POST("/login", middleware.AuthRateLimit(), handlers.EnhancedLogin(database, cfg.JWTSecret, sessionService))
	}

	// WebSocket endpoint for per-user notifications (token via query param)
	r.GET("/ws", handlers.NotificationsWebSocket(cfg.JWTSecret, sessionService))

	// Health check endpoints - Basic health check that doesn't depend on external services
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "CAF API",
			"timestamp": time.Now().UTC(),
			"version":   "1.2.0",
			"deployment": "production-ready-https-enabled",
		})
	})

	// AWS ALB health check endpoint (common AWS convention)
	r.GET("/health/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"alive":  true,
		})
	})

	// Readiness check (includes dependencies)
	r.GET("/health/ready", func(c *gin.Context) {
		// Test database connection
		if err := database.Raw("SELECT 1").Error; err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "not ready",
				"error":  "database connection failed",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"database":  "connected",
			"timestamp": time.Now().UTC(),
		})
	})

	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "API server is working", "timestamp": time.Now()})
	})

	r.GET("/health/migrations", func(c *gin.Context) {
		migrationStatus, err := migrationManager.GetMigrationStatus()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "service": "migrations", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "migrations", "migrations": migrationStatus})
	})

	r.GET("/health/s3", func(c *gin.Context) {
		if err := storage.HealthCheck(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "service": "S3", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "S3"})
	})

	r.GET("/health/cache", func(c *gin.Context) {
		stats := handlers.GetCacheStats()
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "Cache", "stats": stats})
	})

	// Group 2: Protected Routes (Requires any valid login token)
	// Enhanced with comprehensive data access control
	protected := r.Group("/api/v1")
	protected.Use(middleware.EnhancedJWTAuth(cfg.JWTSecret, sessionService))
	protected.Use(middleware.DataAccessControl(database)) // NEW: Enhanced access control
	protected.Use(middleware.DenyClients())               // Block clients from staff/admin APIs
	{
		// Universal dashboard summary for all authenticated users
		protected.GET("/dashboard-summary", handlers.GetDashboardSummary(database))
		// Dashboard content for all users
		protected.GET("/dashboard/announcements", handlers.GetAnnouncements(database))
		protected.GET("/dashboard/notes", handlers.GetNotes(database))
		protected.POST("/dashboard/announcements/:id/dismiss", handlers.DismissAnnouncement(database))
		protected.POST("/notes", handlers.CreateUserNote(database))
		protected.PATCH("/notes/:id", handlers.UpdateUserNote(database))
		protected.DELETE("/notes/:id", handlers.DeleteUserNote(database))

		// Profile and user info (include office for managers to prefill office selection)
		protected.GET("/profile", func(c *gin.Context) {
			userID, _ := c.Get("userID")
			var user models.User
			if err := database.Preload("Office").First(&user, "id = ?", userID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
				return
			}
			// Fallback: update last_login if missing
			now := time.Now()
			if user.LastLogin == nil || user.LastLogin.Before(now.Add(-1*time.Hour)) {
				_ = database.Model(&user).Update("last_login", &now).Error
			}
			c.JSON(http.StatusOK, gin.H{
				"userID":    userID,
				"role":      user.Role,
				"firstName": user.FirstName,
				"lastName":  user.LastName,
				"office":    user.Office,
				"officeId":  user.OfficeID,
			})
		})

		// Offices list available to authenticated staff/managers/admins
		protected.GET("/offices", handlers.GetOffices(database))

		// Enhanced Case Management with Access Control
		protected.GET("/cases", middleware.CaseAccessControl(database), handlers.GetCasesEnhanced(database))
		protected.GET("/cases/:id", middleware.CaseAccessControl(database), handlers.GetCaseByIDEnhanced(database))
		protected.GET("/cases/my", middleware.CaseAccessControl(database), handlers.GetMyCases(database))
		protected.POST("/cases", middleware.CaseAccessControl(database), middleware.ValidateCaseCreation(), handlers.CreateCaseEnhanced(database))
		protected.PUT("/cases/:id", middleware.CaseAccessControl(database), middleware.ValidateCaseUpdate(), handlers.UpdateCase(database))
		protected.DELETE("/cases/:id", middleware.CaseAccessControl(database), handlers.DeleteCase(database))

		// Enhanced Appointment Management with Access Control
		protected.GET("/appointments", middleware.AppointmentAccessControl(database), handlers.GetAppointmentsEnhanced(database))
		protected.GET("/appointments/:id", middleware.AppointmentAccessControl(database), handlers.GetAppointmentByIDEnhanced(database))
		protected.GET("/appointments/my", middleware.AppointmentAccessControl(database), handlers.GetMyAppointments(database))
		protected.POST("/appointments", middleware.AppointmentAccessControl(database), handlers.CreateAppointmentEnhanced(database))
		protected.PUT("/appointments/:id", middleware.AppointmentAccessControl(database), handlers.UpdateAppointmentEnhanced(database))

		// Task Management with Access Control
		protected.GET("/tasks", middleware.TaskAccessControl(database), handlers.GetTasks(database))
		protected.GET("/tasks/:id", middleware.TaskAccessControl(database), handlers.GetTaskByID(database))
		protected.POST("/tasks", middleware.TaskAccessControl(database), handlers.CreateTaskEnhanced(database))
		protected.PUT("/tasks/:id", middleware.TaskAccessControl(database), handlers.UpdateTaskEnhanced(database))
		protected.DELETE("/tasks/:id", middleware.TaskAccessControl(database), handlers.DeleteTaskEnhanced(database))
		protected.GET("/tasks/my", middleware.TaskAccessControl(database), handlers.GetMyTasks(database))

		// Task Comments
		protected.POST("/tasks/:id/comments", middleware.TaskAccessControl(database), handlers.CreateTaskComment(database))
		protected.PUT("/tasks/:id/comments/:commentId", middleware.TaskAccessControl(database), handlers.UpdateTaskComment(database))
		protected.DELETE("/tasks/:id/comments/:commentId", middleware.TaskAccessControl(database), handlers.DeleteTaskComment(database))

		// Document access for all authenticated users
		protected.GET("/documents/:eventId", handlers.GetDocument(database))

		// Notification endpoints for all authenticated users
		protected.GET("/notifications", handlers.GetNotifications(database))
		protected.POST("/notifications/mark-read", handlers.MarkNotificationsAsRead(database))

		// Case Events CRUD for authenticated users
		protected.POST("/cases/:id/comments", handlers.CreateComment(database))
		protected.PUT("/cases/comments/:eventId", handlers.UpdateComment(database))
		protected.DELETE("/cases/comments/:eventId", handlers.DeleteComment(database))
		protected.POST("/cases/:id/documents", handlers.UploadDocument(database))
		protected.PUT("/cases/documents/:eventId", handlers.UpdateDocument(database))
		protected.DELETE("/cases/documents/:eventId", handlers.DeleteDocument(database))

		// Legacy endpoints removed - using enhanced handlers only
	}

	// Group 3: Admin-Only Routes (Requires a login token from a user with the 'admin' role)
	admin := r.Group("/api/v1/admin")
	admin.Use(middleware.EnhancedJWTAuth(cfg.JWTSecret, sessionService))
	admin.Use(middleware.RoleAuth(database, "admin"))
	admin.Use(middleware.DataAccessControl(database)) // Admin also gets enhanced context
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

		// Enhanced Case Management (Admin can override department restrictions)
		admin.POST("/cases", handlers.CreateCaseEnhanced(database))
		admin.PUT("/cases/:id", handlers.UpdateCase(database))
		admin.DELETE("/cases/:id", handlers.DeleteCase(database))
		// Case management endpoints
		admin.PATCH("/cases/:id/stage", handlers.UpdateCaseStage(database))
		admin.POST("/cases/:id/assign", handlers.AssignStaffToCase(database))

		// Performance Optimized Endpoints
		admin.GET("/optimized/cases", performanceHandler.GetOptimizedCases())
		admin.GET("/optimized/appointments", performanceHandler.GetOptimizedAppointments())
		admin.GET("/optimized/users", performanceHandler.GetOptimizedUsers())
		admin.GET("/performance/metrics", performanceHandler.GetPerformanceMetrics())

		// Archive Management
		admin.POST("/cases/:id/complete", handlers.CompleteCase(database))
		admin.GET("/archives", handlers.GetArchivedCases(database))
		admin.GET("/archives/stats", handlers.GetArchiveStats(database))
		admin.POST("/archives/:id/restore", handlers.RestoreArchivedCase(database))
		admin.DELETE("/archives/:id/permanent", handlers.PermanentlyDeleteArchivedCase(database))

		// Enhanced Task Management
		admin.POST("/cases/:id/tasks", handlers.CreateTaskEnhanced(database))
		admin.PATCH("/tasks/:id", handlers.UpdateTaskEnhanced(database))
		admin.DELETE("/tasks/:id", handlers.DeleteTaskEnhanced(database))

		// Task Comments
		admin.POST("/tasks/:id/comments", handlers.CreateTaskComment(database))
		admin.PUT("/tasks/:id/comments/:commentId", handlers.UpdateTaskComment(database))
		admin.DELETE("/tasks/:id/comments/:commentId", handlers.DeleteTaskComment(database))

		// Case Events
		admin.POST("/cases/:id/comments", handlers.CreateComment(database))
		admin.POST("/cases/:id/documents", handlers.UploadDocument(database))
		admin.GET("/documents/:eventId", handlers.GetDocument(database))

		// Enhanced Appointment Management (Admin can override department restrictions)
		admin.POST("/appointments", handlers.CreateAppointmentSmart(database))
		admin.PATCH("/appointments/:id", handlers.UpdateAppointmentEnhanced(database))
		admin.DELETE("/appointments/:id", handlers.DeleteAppointmentAdmin(database))

		// Legacy admin endpoints removed - using enhanced handlers only

		// Dashboard
		admin.GET("/dashboard-summary", handlers.GetDashboardSummary(database))
		admin.GET("/dashboard/stats", handlers.GetDashboardStats(database))
		admin.GET("/dashboard/activity", handlers.GetRecentActivity(database))
		admin.GET("/dashboard/health", handlers.GetSystemHealth(database))
		admin.POST("/bulk-operations", handlers.GetBulkOperations(database))
		admin.POST("/export", handlers.ExportData(database))
		admin.GET("/users/search", handlers.SearchClients(database))                                           // For client search
		admin.GET("/clients/:clientId/cases", handlers.GetCasesForClient(database))                            // For client's cases
		admin.GET("/clients/:clientId/cases-for-appointment", handlers.GetClientCasesForAppointment(database)) // For appointment case dropdown

		// Announcement Management (Admin only)
		admin.POST("/announcements", handlers.CreateAnnouncement(database))
		admin.PATCH("/announcements/:id", handlers.UpdateAnnouncement(database))
		admin.DELETE("/announcements/:id", handlers.DeleteAnnouncement(database))

		// Reports and Audit routes
		reportsHandler := handlers.NewReportsHandler(database)
		admin.GET("/reports/summary-report", reportsHandler.GetSummaryReport())
		admin.GET("/reports/cases-report", reportsHandler.GetCasesReport())
		admin.GET("/reports/appointments-report", reportsHandler.GetAppointmentsReport())
		admin.GET("/reports/export", reportsHandler.ExportReport())
	}

	// Group 4: Staff-Specific Routes (Enhanced access control for staff members)
	staff := r.Group("/api/v1/staff")
	staff.Use(middleware.EnhancedJWTAuth(cfg.JWTSecret, sessionService))
	staff.Use(middleware.RoleAuth(database, "staff"))
	staff.Use(middleware.DataAccessControl(database))
	{
		// Staff can only see their own data and department data
		staff.GET("/profile", func(c *gin.Context) {
			currentUser, _ := c.Get("currentUser")
			user := currentUser.(models.User)
			c.JSON(http.StatusOK, gin.H{
				"user":       user,
				"department": user.Department,
				"specialty":  user.Specialty,
				"office":     user.Office,
			})
		})

		// Staff-specific case views
		staff.GET("/cases", middleware.CaseAccessControl(database), handlers.GetCasesEnhanced(database))
		staff.GET("/cases/:id", middleware.CaseAccessControl(database), handlers.GetCaseByIDEnhanced(database))
		staff.GET("/cases/my", middleware.CaseAccessControl(database), handlers.GetMyCases(database))

		// Document access
		staff.GET("/documents/:eventId", handlers.GetDocument(database))

		// Staff-specific appointment views
		staff.GET("/appointments", middleware.AppointmentAccessControl(database), handlers.GetAppointmentsEnhanced(database))
		staff.GET("/appointments/:id", middleware.AppointmentAccessControl(database), handlers.GetAppointmentByIDEnhanced(database))
		staff.GET("/appointments/my", middleware.AppointmentAccessControl(database), handlers.GetMyAppointments(database))
		staff.DELETE("/appointments/:id", middleware.AppointmentAccessControl(database), handlers.DeleteAppointmentEnhanced(database))
		staff.POST("/appointments", handlers.CreateAppointmentSmart(database)) // Smart appointment creation

		// Client cases for appointment creation
		staff.GET("/clients/:clientId/cases-for-appointment", handlers.GetClientCasesForAppointment(database))

		// Staff-specific task views
		staff.GET("/tasks", middleware.TaskAccessControl(database), handlers.GetTasks(database))
		staff.GET("/tasks/:id", middleware.TaskAccessControl(database), handlers.GetTaskByID(database))
		staff.GET("/tasks/my", middleware.TaskAccessControl(database), handlers.GetMyTasks(database))
		staff.POST("/tasks", middleware.TaskAccessControl(database), handlers.CreateTaskEnhanced(database))
		staff.PUT("/tasks/:id", middleware.TaskAccessControl(database), handlers.UpdateTaskEnhanced(database))
		staff.DELETE("/tasks/:id", middleware.TaskAccessControl(database), handlers.DeleteTaskEnhanced(database))

		// Task Comments
		staff.POST("/tasks/:id/comments", middleware.TaskAccessControl(database), handlers.CreateTaskComment(database))
		staff.PUT("/tasks/:id/comments/:commentId", middleware.TaskAccessControl(database), handlers.UpdateTaskComment(database))
		staff.DELETE("/tasks/:id/comments/:commentId", middleware.TaskAccessControl(database), handlers.DeleteTaskComment(database))
	}

	// Group 5: Office Manager Routes (role: office_manager)
	officeManager := r.Group("/api/v1/manager")
	officeManager.Use(middleware.EnhancedJWTAuth(cfg.JWTSecret, sessionService))
	officeManager.Use(middleware.RoleAuth(database, "office_manager"))
	officeManager.Use(middleware.DataAccessControl(database))
	{
		// Users (auto-scoped by DataAccessControl via GetUsers)
		officeManager.GET("/users", handlers.GetUsers(database))
		// Offices list for selection (we can return all so manager can pick among offices only where needed?)
		// Keep offices list admin-only for now; creation modal already requires picking an office from list.

		// Client cases for appointment creation
		officeManager.GET("/clients/:clientId/cases-for-appointment", handlers.GetClientCasesForAppointment(database))

		// Smart appointment creation for office managers
		officeManager.POST("/appointments", handlers.CreateAppointmentSmart(database))

		// Reports (scoped by office via DataAccessControl)
		reportsHandler := handlers.NewReportsHandler(database)
		officeManager.GET("/reports/summary-report", reportsHandler.GetSummaryReport())
		officeManager.GET("/reports/cases-report", reportsHandler.GetCasesReport())
		officeManager.GET("/reports/appointments-report", reportsHandler.GetAppointmentsReport())
		officeManager.GET("/reports/export", reportsHandler.ExportReport())
	}

	// --- Step 7: Start the Server ---
	// Bind to all interfaces (0.0.0.0) for AWS deployment
	serverAddr := "0.0.0.0:" + cfg.Port
	log.Printf("INFO: Server starting on %s", serverAddr)
	log.Printf("INFO: Enhanced data access control system enabled")
	log.Printf("INFO: Department-based filtering active")
	log.Printf("INFO: Case assignment control active")

	// Add graceful shutdown handling
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("FATAL: Failed to run server: %v", err)
	}
}
