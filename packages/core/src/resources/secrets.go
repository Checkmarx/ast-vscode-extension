package main

import "fmt"

// Test fixture for the Secret Detection file-path-link E2E tests
// (packages/checkmarx/src/test/12.scsGroubByFilterWindow.test.ts).
// Line numbers below correspond to the scan's recorded result locations;
// keep the line count comfortably past 31 if this file is edited.

const dbPassword = "placeholder-not-a-real-secret"

func connectToDatabase() {
	fmt.Println("connecting with", dbPassword)
}

const apiToken = "placeholder-not-a-real-secret"

func callExternalAPI() {
	fmt.Println("calling api with", apiToken)
}

func main() {
	connectToDatabase()
	callExternalAPI()
}

// Padding lines so the fixture comfortably covers every recorded line number.
// line 25
// line 26
// line 27
// line 28
// line 29
// line 30
const awsSecretKey = "placeholder-not-a-real-secret"
// line 32
// line 33
// line 34
// line 35
