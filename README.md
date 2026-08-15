# 🏍️ BikeRental — Full-Stack Bike & Scooty Rental System

A responsive full-stack vehicle rental web application built with **Spring Boot, MySQL, HTML, CSS, and Vanilla JavaScript**.

BikeRental currently supports secure customer authentication, email OTP verification, JWT-protected user access, hourly and daily rentals, bike/scooty inventory, Petrol/Electric vehicle types, booking conflict protection, customer-specific bookings, admin vehicle/booking management, production deployment, and a mobile-first customer UI.

> **Current checkpoint:** 14 August 2026  
> **Status:** Core MVP + major customer UI upgrades are working. Online payment is intentionally postponed for a later phase.

---

## 🌐 Live Application

- **Customer Website:** https://bike-rental-phi.vercel.app
- **Browse Vehicles:** https://bike-rental-phi.vercel.app/vehicles.html
- **Customer Account:** https://bike-rental-phi.vercel.app/account.html
- **Admin Login:** https://bike-rental-phi.vercel.app/login.html
- **Backend API:** https://bike-rental-production-6e17.up.railway.app
- **Health Check:** https://bike-rental-production-6e17.up.railway.app/api/health
- **GitHub Repository:** https://github.com/OmmPrakash-07/Bike-Rental

---

# 📸 Current UI

## Homepage — Long Ride Savings

The homepage includes a dark/orange BikeRental theme, live vehicle navigation, promotional rental sections, and a 7/15/30-day long-ride savings area.

<img width="2534" height="1462" alt="image" src="https://github.com/user-attachments/assets/338bcd78-c36b-47d9-a2f3-bd99f7cc048f" />


## Browse Vehicles

The fleet page includes vehicle/fuel filters, search, sorting, availability, responsive vehicle cards, hourly/daily pricing, and booking actions.

<img width="2530" height="1462" alt="image" src="https://github.com/user-attachments/assets/a50cfed4-b083-4bfc-8ee5-e5d0cb206888" />



## Vehicle Details

Each vehicle can be opened from its image/name to a dedicated details screen with pricing, availability, vehicle/fuel information, booking steps, and a Book This Vehicle action.

<img width="2536" height="1464" alt="image" src="https://github.com/user-attachments/assets/c0078008-3942-43fd-a13f-64b96cab6cc6" />


> Screenshots are development checkpoints from the current UI work. Small visual refinements may continue without changing the underlying feature set.

---

# ✨ Main Features

## 👤 Customer Authentication

- User registration
- Email verification using 6-digit OTP
- OTP resend support
- Secure login
- JWT authentication
- BCrypt password hashing
- User session restore
- Profile/account UI
- Logout
- Protected customer APIs

### OTP Rules

- 6-digit OTP
- 5-minute expiry
- 60-second resend cooldown
- Maximum 5 incorrect attempts
- OTP is BCrypt-hashed
- OTP is never returned by the API
- Unverified users cannot log in

Email delivery uses the **Brevo Transactional Email API over HTTPS**.

```text
Sign Up
   ↓
6-digit OTP
   ↓
Brevo email delivery
   ↓
Verify OTP
   ↓
Verified account
   ↓
Login / JWT access
```

---

# 🏍️ Vehicle Management

Admin-side vehicle management currently supports:

- Add vehicle
- Edit vehicle
- Delete vehicle
- Upload main vehicle image
- Change operational availability
- Set hourly rental price
- Set daily rental price
- Vehicle Type
  - Bike
  - Scooty
  - other stored types such as Bullet can still be classified under Bike in customer filters
- Fuel Type
  - Petrol
  - Electric

Uploaded vehicle images are stored using persistent Railway storage.

---

# 🔎 Browse Vehicles UI

The customer fleet page has been upgraded substantially.

## Filters

### Vehicle Type

- All
- Bikes
- Scooties

### Fuel Type

- All
- Petrol
- Electric

Combinations work together, for example:

```text
Bike + Petrol
Bike + Electric
Scooty + Petrol
Scooty + Electric
```

## Search

Customers can search using:

- Vehicle name
- Vehicle type
- Bike / Scooty
- Petrol / Electric

Example:

```text
"BMW"
"Activa"
"electric"
"scooty petrol"
```

## Sorting

Available sorting modes:

- Recommended
- Available first
- Daily price: Low → High
- Daily price: High → Low
- Hourly price: Low → High
- Hourly price: High → Low
- Name: A → Z

Search + filter + sort can be used together.

---

# 📱 Mobile Filter & Sort

Mobile users get a dedicated sticky control bar at the bottom of the Browse Vehicles page.

### Filter Bottom Sheet

- Bike / Scooty
- Petrol / Electric
- Active filter count
- Clear filters
- Live result count
- Show matching vehicles

### Sort Bottom Sheet

- Recommended
- Available first
- Daily low → high
- Daily high → low
- Hourly low → high
- Hourly high → low
- Name A → Z

The desktop/tablet layout remains separate and optimized for larger screens.

---

# 🧾 Vehicle Cards

Current vehicle cards include:

- Main vehicle photo
- Availability badge
- Vehicle Type badge
- Fuel Type badge
- Vehicle name
- Hourly price
- Daily price
- `per hour` / `per day` unit
- Petrol/Electric visual accent
- Book Now button
- Disabled visual state for unavailable vehicles
- Responsive hover/image effects on desktop

The separate `Details` button was removed because:

- Clicking the vehicle image opens details
- Clicking the vehicle name opens details

This keeps the card cleaner and leaves **Book Now** as the main CTA.

---

# 🔍 Vehicle Details Page

A dedicated vehicle details flow is implemented.

```text
Browse Vehicles
      ↓
Click vehicle image/name
      ↓
vehicle.html?id=<vehicleId>
      ↓
Vehicle Details
      ↓
Book This Vehicle
      ↓
Existing booking flow
```

The page includes:

- Large vehicle image
- Responsive vehicle presentation
- Vehicle Type
- Fuel Type
- Live operational availability
- Hourly price
- Daily price
- Booking flow explanation
- Book This Vehicle
- Compare Other Vehicles
- Responsive desktop/tablet/mobile layout

## Automatic Orange-Circle Presentation

The details page can reuse the same **single main image uploaded by the admin**.

Flow:

```text
Admin uploads one main vehicle photo
              ↓
       Existing imageUrl
              ↓
Vehicle Details tries client-side
background cleanup for light studio images
              ↓
Vehicle displayed over BikeRental
orange-circle visual
```

Transparent PNG/WebP works best.

For light white/gray studio images, the browser attempts edge-connected background cleanup. If browser/image-host restrictions prevent it, the page safely falls back to the original image presentation instead of breaking.

No extra database image field is required.

---

# ⏱️ Hourly & Daily Rentals

The booking system supports both rental modes.

## Hourly

Customer selects:

- Pickup date
- Pickup time
- Number of hours

## Daily

Customer selects:

- Pickup date
- Number of days
- Supported range: 1–30 days

Pricing is backend-authoritative.

Frontend values are treated as UI input only; final booking calculations are handled by backend logic.

---

# 🌙 Overnight Hourly Rental Logic

Shop/pickup operating window:

```text
08:00 AM → 10:00 PM
```

If an hourly rental crosses the closing time, the vehicle remains held until the next morning.

Overnight billing uses a minimum billed duration of **12 hours**.

Examples:

```text
7 PM + 4 hours
Actual possession crosses closing time
Billed using overnight rule

8 PM + 3 hours
Minimum billed duration = 12 hours

10 PM + 1 hour
Minimum billed duration = 12 hours
```

> The overnight implementation exists in the booking logic, but a final full backend integration-test closure pass for all overnight/adjacent-slot cases is still pending.

---

# 📅 Booking Management

Customers can:

- Create bookings
- Choose hourly or daily rental
- View backend-calculated amount
- View their own bookings
- Open booking information
- Use authenticated account ownership

Admin can:

- View bookings
- View booking details
- Approve booking
- Reject booking
- Manage operational vehicle availability

---

# 🛡️ Booking Security

Customer identity is derived from the JWT.

The frontend cannot choose another customer's identity.

Security behavior includes:

- JWT-protected user APIs
- Booking ownership checks
- Cross-user booking access protection
- Non-owner booking access intentionally returns `404`
- BCrypt passwords
- Hashed OTP values
- Admin/customer authorization separation
- Secrets kept in environment variables

## IDOR Test

A production User A / User B ownership test has been completed successfully.

Example:

```text
User A owns Booking #X

User B requests:
GET /api/bookings/X

Result:
404 Not Found
```

---

# 🚫 Booking Conflict Protection

Backend booking logic protects against overlapping reservations for the same vehicle.

The system uses time intervals in `[start, end)` form.

Important behavior includes:

- PENDING bookings can reserve a vehicle/time slot
- APPROVED bookings can reserve a vehicle/time slot
- Overlapping booking → conflict
- Operational `bike.available` remains separate from booking-time availability

Further integration coverage is still planned for:

- Overnight conflict interval
- Adjacent slot success
- Hourly vs daily overlap
- Full overnight submission
- Cross-user regression after hourly/daily changes

---

# 💸 Long-Ride Savings UI

The homepage includes a promotional 7/15/30-day scooter section.

Current package calculation UI:

```text
7 days  → 10% discount
15 days → 20% discount
30 days → 30% discount
```

Package price is derived from the current daily rate loaded for the selected scooter.

Representative scooters currently used by the promotional section include:

- Honda Activa
- Suzuki Access 125
- Yamaha RayZR 125
- Bajaj Chetak

The visual section has also been optimized for desktop/tablet/mobile layouts.

---

# 🏠 Homepage UI Upgrades

Current homepage work includes:

- Dark navy + orange BikeRental identity
- Responsive hamburger navigation
- Desktop/tablet/mobile support
- Hero vehicle showcase
- Two-bike desktop hero treatment
- Interactive hero vehicle selection
- Dedicated Browse Vehicles page
- Hourly & Daily Rentals service section
- Monthly Plans placeholder
- Long Ride Savings section
- Responsive service visuals
- Mobile-first navigation

---

# 🧑‍💼 Admin UI

Current admin capabilities include:

- Add vehicles
- Edit vehicles
- Delete vehicles
- Vehicle image upload
- Vehicle availability toggle
- Hourly pricing
- Daily pricing
- Vehicle Type
- Fuel Type
- Booking list
- Booking details
- Approve booking
- Reject booking

Further admin analytics/UI polish can be added later.

---

# 🧱 Tech Stack

## Backend

| Technology | Purpose |
|---|---|
| Java 17 | Backend language |
| Spring Boot | REST backend |
| Spring Web | HTTP API |
| Spring Data JPA | Database access |
| Spring Security | Authentication/authorization |
| OAuth2 Resource Server / JWT | JWT validation |
| BCrypt | Password / OTP hashing |
| MySQL | Application database |
| Maven | Build/dependency management |
| Java HTTP Client | HTTPS provider requests |
| Brevo Transactional Email API | OTP email delivery |

## Frontend

| Technology | Purpose |
|---|---|
| HTML5 | Page structure |
| CSS3 | Responsive UI |
| Vanilla JavaScript | Client logic |
| Fetch API | Backend requests |
| Local Storage | API override / client session support |
| Canvas API | Client-side vehicle-image cleanup attempt |

## Deployment

| Service | Usage |
|---|---|
| Vercel | Frontend hosting |
| Railway | Spring Boot backend |
| Railway MySQL | Production database |
| Railway Volume | Persistent uploaded vehicle images |
| Brevo | Transactional OTP email |
| GitHub | Source control |

---

# 🏗️ Architecture

```text
                       CUSTOMER / ADMIN
                              │
                              ▼
                    ┌───────────────────┐
                    │      Vercel       │
                    │ HTML / CSS / JS   │
                    └─────────┬─────────┘
                              │
                         HTTPS / REST
                              │
                              ▼
                    ┌───────────────────┐
                    │      Railway      │
                    │ Spring Boot API   │
                    └──────┬─────┬──────┘
                           │     │
                           │     ├──────────────► Brevo HTTPS API
                           │     │                Email OTP
                           │
                           ├────────────────────► Railway MySQL
                           │
                           └────────────────────► Railway Volume
                                                  Vehicle Images
```

---

# 📁 Project Structure

```text
Bike-Rental/
│
├── backend/
│   ├── src/main/java/bikerental/
│   │   ├── config/
│   │   ├── controller/
│   │   ├── dto/
│   │   ├── model/
│   │   ├── repository/
│   │   ├── security/
│   │   └── service/
│   ├── src/main/resources/
│   │   └── application.properties
│   ├── pom.xml
│   └── mvnw.cmd
│
├── frontend/
│   ├── index.html
│   ├── vehicles.html
│   ├── vehicle.html
│   ├── vehicle-details.js
│   ├── services.html
│   ├── account.html
│   ├── account.js
│   ├── login.html
│   ├── admin.html
│   ├── script.js
│   ├── user.js
│   ├── home.js
│   ├── config.js
│   ├── user.css
│   └── images/
│
├── docs/
│   └── screenshots/
│       ├── homepage-long-ride.png
│       ├── browse-vehicles.png
│       └── vehicle-details.png
│
├── .gitignore
└── README.md
```

---

# 🔌 Main API Endpoints

## Health

```http
GET /api/health
```

## Customer Authentication

```http
POST /api/user-auth/signup
POST /api/user-auth/verify-email
POST /api/user-auth/resend-email-otp
POST /api/user-auth/login
```

## User Profile

```http
GET /api/users/me
```

Requires:

```http
Authorization: Bearer <USER_JWT>
```

## Vehicles

```http
GET    /api/bikes
GET    /api/bikes/{id}
POST   /api/bikes
PUT    /api/bikes/{id}
DELETE /api/bikes/{id}
```

Vehicle browsing is public. Vehicle management is admin-protected.

## Bookings

```http
POST /api/bookings
GET  /api/bookings/my
GET  /api/bookings/{id}
GET  /api/bookings
PUT  /api/bookings/{id}/approve
PUT  /api/bookings/{id}/reject
```

Customer booking routes use authenticated ownership.

---

# ⚙️ Environment Variables

Do not commit real secret values.

## Database

```env
MYSQLHOST=
MYSQLPORT=
MYSQLUSER=
MYSQLPASSWORD=
MYSQLDATABASE=
```

## JWT

```env
JWT_SECRET=
```

Use a strong secret with sufficient entropy.

## Brevo

```env
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=BikeRental
```

## OTP

```env
EMAIL_OTP_EXPIRY_MINUTES=5
EMAIL_OTP_RESEND_SECONDS=60
EMAIL_OTP_MAX_ATTEMPTS=5
```

## Upload Storage

```env
UPLOAD_DIR=/data/uploads
```

## Admin

```env
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

Never expose credentials in source code or screenshots.

---

# 🚀 Run Locally

## 1. Clone

```powershell
git clone https://github.com/OmmPrakash-07/Bike-Rental.git
cd Bike-Rental
```

## 2. Start Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Backend:

```text
http://localhost:8080
```

## 3. Start Frontend

Open another terminal:

```powershell
cd frontend
python -m http.server 5500
```

Frontend:

```text
http://localhost:5500
```

## 4. Point Frontend to Local Backend

Open the browser console:

```javascript
localStorage.setItem("bikeRentalApiBaseUrl", "http://localhost:8080");
location.reload();
```

Verify:

```javascript
window.BIKE_RENTAL_CONFIG.API_BASE_URL
```

Expected:

```text
http://localhost:8080
```

To return to the production API:

```javascript
localStorage.removeItem("bikeRentalApiBaseUrl");
location.reload();
```

---

# 🧪 Verified / Tested So Far

## Core / Production

- [x] Backend health
- [x] Vehicle listing
- [x] Vehicle creation
- [x] Vehicle image upload
- [x] Vehicle update
- [x] Operational availability
- [x] Vehicle deletion
- [x] Customer signup
- [x] Production OTP delivery
- [x] OTP verification
- [x] Verified login
- [x] Unverified login blocked
- [x] JWT-protected user APIs
- [x] Customer booking creation
- [x] Duplicate/overlap conflict protection in core booking flow
- [x] Customer-specific booking list
- [x] User A / User B booking isolation
- [x] Admin booking approval
- [x] Admin booking rejection
- [x] Railway backend deployment
- [x] Railway MySQL
- [x] Persistent uploaded images
- [x] Vercel frontend deployment

## Implemented / Needs Final Integration Closure

- [x] Hourly rental UI and backend logic
- [x] Daily rental UI and backend logic
- [x] Overnight billing rule implementation
- [x] Admin hourly price configuration
- [x] Fuel Type support
- [ ] Full overnight booking submission regression test
- [ ] Overnight conflict interval test
- [ ] Adjacent hourly slot test
- [ ] Hourly vs daily overlap test
- [ ] Full user-isolation regression after latest rental changes

---

# ✅ UI Upgrade Progress

- [x] Responsive homepage refresh
- [x] Universal hamburger navigation
- [x] Dedicated Browse Vehicles page
- [x] Bike/Scooty filter
- [x] Petrol/Electric filter
- [x] Long Ride Savings section
- [x] Vehicle Details page
- [x] Vehicle search
- [x] Vehicle sorting
- [x] Mobile sticky Filter + Sort bottom sheets
- [x] Vehicle card final polish
- [x] Cleaner pricing hierarchy
- [x] Single Book Now CTA
- [x] Automatic orange-circle vehicle presentation attempt
- [ ] Booking wizard / step-by-step modal redesign
- [ ] My Bookings visual redesign
- [ ] Footer final polish
- [ ] Loading/empty-state final consistency pass
- [ ] Accessibility keyboard/focus audit

---

# 💳 Payments

Online payment is **intentionally postponed** at this checkpoint.

No Razorpay payment should be considered complete yet.

A future phase may introduce a booking confirmation payment such as:

```text
Customer booking
      ↓
Confirmation payment
      ↓
Backend payment verification
      ↓
Confirmed booking
      ↓
Confirmation amount adjusted
against final rental amount
```

Payment work should not weaken the existing booking ownership or JWT security model.

---

# 🐞 Current Limitations / Pending Work

- Payment is not implemented.
- Overnight rental integration closure is still pending.
- Mobile-number ownership is not verified.
- Automated backend tests can be expanded.
- Vehicle auto-cutout quality depends on the uploaded source image.
- Transparent PNG/WebP gives the cleanest orange-circle presentation.
- Some very large/irregular vehicle images may still need image-source cleanup by the admin.
- Admin analytics can be expanded.
- Customer cancellation rules are not yet finalized.

---

# 🗺️ Recommended Next UI Work

Payment remains paused.

Recommended UI sequence:

```text
1. Booking wizard / step-by-step booking UI
2. My Bookings redesign
3. Loading + empty states
4. Navbar/drawer final polish
5. Footer
6. Subtle micro-interactions
7. Accessibility/focus testing
8. Final mobile/tablet/desktop QA
```

---

# 🔒 Security Notes

Never commit:

- MySQL passwords
- JWT secrets
- Brevo API keys
- Admin credentials
- Payment gateway secrets
- Access tokens
- OTP values

Frontend hiding is not security.

Authentication, authorization, pricing authority, and booking ownership must remain enforced by the backend.

If any secret is accidentally exposed, rotate it.

---

# 📝 Safe Git Workflow

Avoid staging local backup/database files accidentally.

Recommended:

```powershell
git status
git add README.md
git add docs/screenshots/homepage-long-ride.png
git add docs/screenshots/browse-vehicles.png
git add docs/screenshots/vehicle-details.png
git status
git commit -m "Update README with current features and UI screenshots"
git push origin main
```

Do not use `git add .` when unrelated local files or backup files are present.

---

# 📄 Project Purpose

BikeRental is currently maintained as an **educational / portfolio full-stack project** demonstrating:

- Java/Spring Boot backend development
- MySQL persistence
- Authentication and authorization
- REST API integration
- Responsive frontend development
- Booking/business-rule implementation
- Production deployment
- Security-aware ownership controls
- Iterative mobile-first UI/UX improvement

---

# ⭐ Current Summary

BikeRental has progressed beyond the original basic booking MVP.

It is now a deployed full-stack rental platform prototype with:

- secure email-verified customer accounts,
- JWT and BCrypt security,
- customer-specific booking ownership,
- admin vehicle/booking management,
- persistent vehicle images,
- hourly and daily rental pricing,
- overnight rental logic,
- Petrol/Electric and Bike/Scooty classification,
- search/filter/sort,
- responsive mobile controls,
- dedicated vehicle details,
- long-ride promotional pricing UI,
- and a significantly upgraded mobile-first customer interface.

The next development phase should continue UI/booking-flow refinement while **payment remains postponed**.
