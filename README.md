# Bike Rental — Clean Continuation

This is the repaired version of the existing Bike Rental project. It keeps the same project idea and UI direction, but separates frontend and backend cleanly inside one repository.

## Project structure

```text
bikerental-clean/
├── backend/      # Spring Boot + JPA + MySQL
│   ├── src/
│   ├── pom.xml
│   ├── mvnw
│   ├── mvnw.cmd
│   └── uploads/
├── frontend/     # HTML + CSS + JavaScript
│   ├── user.html
│   ├── index.html
│   ├── login.html
│   └── config.js
└── README.md
```

The frontend and backend stay in one GitHub repository. When deploying the backend to Railway, set the service Root Directory to `backend`. Railway can use the same repository while only building the backend folder.

## What was repaired

- Removed the database password that was hard-coded in source code.
- Added environment-variable database configuration for local use and Railway.
- Added `/api/health`.
- Centralized CORS and upload-directory configuration.
- Bike editing no longer changes an unavailable bike back to available.
- A booking now reserves the bike immediately, preventing multiple conflicting pending bookings.
- Rejecting a pending booking makes the bike available again.
- Approving a booking is protected against another approved booking for the same bike.
- Making a bike available completes an approved booking or rejects an old pending booking.
- Added `bikeId`, `durationDays`, `pricePerDay`, and `totalAmount` to bookings.
- Added booking input validation and upload validation.
- Replaced customer-side `prompt()` booking with a proper booking form/modal.
- Customer now receives a real Booking ID.
- Added customer Booking ID status lookup.
- Removed the old UI claim about ₹50 online payment because payment is not implemented yet.
- Frontend API URL now lives in one file: `frontend/config.js`.
- Polished the customer, admin, and login UI with a consistent responsive dark theme.
- Added customer-side inline validation for name, 10-digit phone, pickup date, duration, and Booking ID lookup.
- Added admin-side inline validation for vehicle name/type/price and 5 MB image upload limits.
- Added image preview, vehicle/booking search and filters, dashboard counters, loading states, toast feedback, and safer confirmation prompts.
- Added matching backend validation for vehicle field lengths/price range, customer name length, positive bike IDs, and upload size.

## Run locally

### 1. Start MySQL

Make sure MySQL is running. The backend uses database `bike_rental` by default and can create it automatically.

### 2. Set your MySQL password in PowerShell

```powershell
$env:MYSQLUSER="root"
$env:MYSQLPASSWORD="YOUR_MYSQL_PASSWORD"
$env:MYSQLDATABASE="bike_rental"
```

If your local MySQL root account has no password, you can omit `MYSQLPASSWORD`.

### 3. Start backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Health check:

```text
http://localhost:8080/api/health
```

### 4. Start frontend

Open the `frontend` folder with VS Code Live Server (or another static server).

Customer page:

```text
user.html
```

Admin login:

```text
login.html
```

Default local demo admin credentials:

```text
username: admin
password: 1234
```

Override these in deployment with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## Frontend backend URL

Local default in `frontend/config.js`:

```javascript
API_BASE_URL: "http://localhost:8080"
```

After Railway deployment, change this one value to the Railway backend domain.

## Railway layout

Keep the whole repository exactly as it is. In Railway, create the backend service from this repository and select:

```text
Root Directory: backend
```

For the backend database, configure these environment variables (or map the equivalent Railway MySQL variables):

```text
MYSQLHOST
MYSQLPORT
MYSQLDATABASE
MYSQLUSER
MYSQLPASSWORD
```

Spring Boot automatically reads `PORT` when Railway provides it.

For uploaded bike images in production, set `UPLOAD_DIR` to a persistent volume mount path. Without persistent storage, uploaded images can be lost on redeploy.

## Current API

```text
GET    /api/health
POST   /api/auth/login

GET    /api/bikes
POST   /api/bikes
PUT    /api/bikes/{id}
DELETE /api/bikes/{id}
POST   /api/bikes/upload
PUT    /api/bikes/{id}/available
PUT    /api/bikes/{id}/unavailable

POST   /api/bookings
GET    /api/bookings
GET    /api/bookings/{id}
PUT    /api/bookings/{id}/approve
PUT    /api/bookings/{id}/reject
DELETE /api/bookings/clear
```

## Next development step

Do not restart the project from zero. Continue from this checkpoint.

Recommended next feature: add real payment only after the current booking flow is tested end-to-end. For a production system, admin authentication and public booking-status privacy also need stronger security; the current login remains suitable for a student/demo project, not a public production admin panel.
