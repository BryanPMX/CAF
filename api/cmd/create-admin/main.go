/*
This program is a command-line tool to create the initial 'admin' user.
It is NOT part of the main API server. It should be run manually one time
from the terminal to bootstrap the system with the first administrator account.

HOW TO RUN (from the 'api' directory):
go run ./cmd/create-admin -firstName="Admin" -lastName="User" -email="admin@caf.org" -password="YourSecurePassword"
*/
package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/BryanPMX/CAF/api/config"
	"github.com/BryanPMX/CAF/api/db"
	"github.com/BryanPMX/CAF/api/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Step 1: Define and parse command-line flags for the user's details.
	// The 'flag' package is the standard Go way to handle command-line arguments.
	firstName := flag.String("firstName", "", "Administrator's first name")
	lastName := flag.String("lastName", "", "Administrator's last name")
	email := flag.String("email", "", "Administrator's email address")
	password := flag.String("password", "", "Administrator's initial password")
	flag.Parse()

	// Step 2: Validate the input.
	if *firstName == "" || *lastName == "" || *email == "" || *password == "" {
		fmt.Println("Error: All flags (-firstName, -lastName, -email, -password) are required.")
		return
	}

	fmt.Println("Attempting to create admin user...")

	// Step 3: Load configuration and connect to the database.
	// We reuse the exact same config and db packages as our main API.
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("FATAL: Failed to load configuration: %v", err)
	}

	database, err := db.Init(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: Could not connect to the database: %v", err)
	}

	// Step 4: Hash the provided password for secure storage.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("FATAL: Failed to hash password: %v", err)
	}

	// Step 5: Create the user model with the 'admin' role.
	adminUser := models.User{
		FirstName: *firstName,
		LastName:  *lastName,
		Email:     *email,
		Password:  string(hashedPassword),
		Role:      "admin", // Explicitly set the role to 'admin'.
	}

	// Step 6: Save the new admin user to the database.
	if err := database.Create(&adminUser).Error; err != nil {
		log.Fatalf("FATAL: Failed to create admin user: %v", err)
	}

	// Step 7: Confirm success.
	fmt.Printf("\nSUCCESS! Administrator account created.\n")
	fmt.Printf("  Email: %s\n", *email)
	fmt.Printf("  You can now log in to the Admin Portal with the password you provided.\n")
}
