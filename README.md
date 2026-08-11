# 🏍️ Bike Rental System

A full-stack bike rental web application built with **Spring Boot, MySQL, HTML, CSS, and JavaScript**.

The project supports secure customer signup/login, email OTP verification, bike booking, booking ownership protection, bike management, and a separate admin dashboard.

> **Current Status:** Core MVP is working and deployed. Authentication, OTP verification, booking security, bike management, database persistence, and production deployment have been tested successfully.

---

## 🌐 Live Application

- **Customer Website:** https://bike-rental-phi.vercel.app
- **Customer Login / Sign Up:** https://bike-rental-phi.vercel.app/account.html
- **Admin Login:** https://bike-rental-phi.vercel.app/login.html
- **Backend API:** https://bike-rental-production-6e17.up.railway.app
- **Health Check:** https://bike-rental-production-6e17.up.railway.app/api/health

---

## ✨ Features

### Customer

- User registration
- Email OTP verification
- Secure login
- JWT authentication
- BCrypt password hashing
- Browse bikes
- View bike details
- Create bookings
- View own bookings
- Booking conflict protection
- Responsive customer UI
- Account dropdown
- Logout

### Security

- Passwords are hashed with BCrypt
- JWT-based authentication
- OTP stored as a hash
- OTP expires automatically
- OTP resend cooldown
- Maximum OTP attempt protection
- Backend derives customer identity from JWT
- Frontend-provided user IDs are not trusted
- Cross-user booking access is blocked
- Non-owner booking access returns `404`
- Admin APIs are protected separately
- Secrets are stored in environment variables

### Email OTP

Email verification uses the **Brevo Transactional Email API over HTTPS**.

```text
Sign Up
   ↓
6-digit OTP generated
   ↓
OTP emailed through Brevo
   ↓
User verifies OTP
   ↓
Account verified
   ↓
Login / JWT access
```

Current OTP rules:

- 6-digit OTP
- 5-minute expiry
- 60-second resend cooldown
- Maximum 5 incorrect attempts
- OTP is never returned by the API
- Unverified accounts cannot log in

### Bike Management

Admin can:

- Add bikes
- Upload bike images
- Update bike details
- Delete bikes
- Change availability
- View inventory

Uploaded images are stored on a persistent Railway volume.

### Booking Management

Customers can:

- Select a bike
- Select pickup date
- Select rental duration
- Create a booking
- View calculated rental amount
- View only their own bookings

Backend protections include:

- Duplicate/overlapping booking protection
- Bike reservation handling
- Booking ownership validation
- Booking status management
- Availability synchronization

Admin can:

- View bookings
- Approve bookings
- Reject bookings
- View booking details
- Manage bike availability

---

## 🧱 Tech Stack

### Backend

- Java 17
- Spring Boot
- Spring Web
- Spring Data JPA
- Spring Security
- OAuth2 Resource Server / JWT
- BCrypt
- MySQL
- Maven
- Java HTTP Client
- Brevo Transactional Email API

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API
- Browser Local Storage

### Deployment

- **Frontend:** Vercel
- **Backend:** Railway
- **Database:** Railway MySQL
- **Persistent Uploads:** Railway Volume
- **Email:** Brevo
- **Source Control:** GitHub

---

## 📁 Project Structure

```text
Bike Rental/
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
│   ├── account.html
│   ├── login.html
│   ├── admin.html
│   ├── user.js
│   ├── account.js
│   ├── admin.js
│   └── *.css
│
├── EMAIL-OTP-SETUP.md
└── README.md
```

---

## 🔌 Important API Endpoints

### Health

```http
GET /api/health
```

### Customer Authentication

```http
POST /api/user-auth/signup
POST /api/user-auth/verify-email
POST /api/user-auth/resend-otp
POST /api/user-auth/login
```

### User Profile

```http
GET /api/users/me
```

Requires:

```http
Authorization: Bearer <USER_JWT>
```

### Bikes

```http
GET    /api/bikes
GET    /api/bikes/{id}
POST   /api/bikes
PUT    /api/bikes/{id}
DELETE /api/bikes/{id}
```

Bike browsing is public. Bike management requires admin authorization.

### Bookings

```http
POST /api/bookings
GET  /api/bookings/my
GET  /api/bookings/{id}
GET  /api/bookings
PUT  /api/bookings/{id}/approve
PUT  /api/bookings/{id}/reject
```

Customer booking endpoints use the authenticated customer's identity.

---

## 🛡️ Booking Ownership / IDOR Protection

A customer cannot access another customer's booking by changing the booking ID.

Example:

```text
User A owns Booking #28

User B requests:
GET /api/bookings/28

Result:
404 Not Found
```

The backend validates ownership before returning customer booking data.

This behavior has been tested successfully using separate customer accounts.

---

## ⚙️ Environment Variables

Never commit secrets to GitHub.

### Database

```env
MYSQLHOST=
MYSQLPORT=
MYSQLUSER=
MYSQLPASSWORD=
MYSQLDATABASE=
```

### JWT

```env
JWT_SECRET=
```

Use a strong secret containing at least 32 bytes.

### Brevo

```env
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=BikeRental
```

### OTP

```env
EMAIL_OTP_EXPIRY_MINUTES=5
EMAIL_OTP_RESEND_SECONDS=60
EMAIL_OTP_MAX_ATTEMPTS=5
```

### Upload Storage

```env
UPLOAD_DIR=/data/uploads
```

### Admin

```env
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

Admin credentials must stay private and should only be configured using environment variables.

---

## 🚀 Run Locally

### 1. Clone

```bash
git clone https://github.com/OmmPrakash-07/Bike-Rental.git
cd Bike-Rental
```

### 2. Create Database

```sql
CREATE DATABASE bike_rental;
```

Configure the required environment variables before starting the backend.

### 3. Start Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Backend:

```text
http://localhost:8080
```

### 4. Start Frontend

Open another terminal:

```powershell
cd frontend
python -m http.server 5500
```

Frontend:

```text
http://localhost:5500
```

For local frontend development:

```javascript
localStorage.setItem("bikeRentalApiBaseUrl", "http://localhost:8080");
location.reload();
```

---

## 🧪 Tested Flows

- Backend health check ✅
- Bike listing ✅
- Bike creation ✅
- Bike image upload ✅
- Bike update ✅
- Bike availability changes ✅
- Bike deletion ✅
- Customer signup ✅
- Production OTP email delivery ✅
- OTP verification ✅
- Verified user login ✅
- Unverified user login blocked ✅
- JWT-protected user APIs ✅
- Booking creation ✅
- Duplicate booking conflict protection ✅
- Customer-specific booking listing ✅
- User A / User B booking isolation ✅
- Admin booking approval ✅
- Admin booking rejection ✅
- Persistent uploaded images after redeployment ✅
- Railway backend deployment ✅
- Railway MySQL integration ✅
- Vercel frontend deployment ✅

---

## ✅ Current Project Status

### Completed

- [x] Spring Boot backend
- [x] MySQL database
- [x] Customer frontend
- [x] Admin frontend
- [x] Bike CRUD
- [x] Bike image upload
- [x] Persistent image storage
- [x] Booking workflow
- [x] Booking conflict protection
- [x] Admin booking management
- [x] Customer signup/login
- [x] BCrypt password hashing
- [x] JWT authentication
- [x] Email OTP verification
- [x] Brevo transactional email integration
- [x] Booking ownership protection
- [x] IDOR protection
- [x] Railway backend deployment
- [x] Railway MySQL deployment
- [x] Vercel frontend deployment

### Planned

- [ ] ₹50 online booking confirmation payment
- [ ] Razorpay Test Mode integration
- [ ] Backend payment verification
- [ ] Deduct ₹50 from final rental balance
- [ ] Improved booking status workflow
- [ ] Customer cancellation rules
- [ ] Improved admin analytics
- [ ] Optional mobile OTP
- [ ] More automated tests

---

## 💳 Planned Payment Flow

Online payment is **not implemented yet**.

Planned flow:

```text
Verified User
   ↓
Select Bike
   ↓
Enter Booking Details
   ↓
Pay ₹50 Confirmation Amount
   ↓
Backend Verifies Payment
   ↓
Booking Confirmed
   ↓
Bike Reserved
   ↓
₹50 Adjusted Against Final Rental Amount
```

Razorpay Test Mode should be used during development.

---

## 🔒 Security Notes

Never commit:

- Database passwords
- JWT secrets
- Brevo API keys
- Admin credentials
- Payment gateway secrets
- Authentication tokens
- OTP values

If a secret is accidentally exposed, rotate it.

Frontend hiding is not security. Authorization and ownership checks must remain enforced by the backend.

---

## 🐞 Known Limitations

- Online payments are not implemented yet.
- Mobile number ownership is not currently verified.
- The frontend intentionally uses a simple MVP architecture.
- Admin authentication can be expanded further in a future version.
- Automated integration/security tests can be expanded.

---

## 🗺️ Next Development Point

Continue from:

> **₹50 booking confirmation payment using Razorpay Test Mode**

Existing authentication, OTP, booking ownership, and authorization behavior should remain unchanged.

---

## 📦 Architecture

```text
Customer Browser
       │
       ▼
     Vercel
 HTML / CSS / JS
       │
       │ HTTPS API
       ▼
    Railway
 Spring Boot API
   │        │
   │        ├────────► Brevo HTTPS API
   │        │           Email OTP
   │
   ├────────► Railway MySQL
   │
   └────────► Railway Volume
              Bike Images
```

---

## 📝 Git Workflow

After development changes:

```bash
git status
git add .
git commit -m "Describe your changes"
git push origin main
```

For this README update:

```bash
git add README.md
git commit -m "Refresh README with current production status"
git push origin main
```

---

## 📄 License

This project is currently maintained as an educational / portfolio project. Add an appropriate open-source license before wider redistribution.

---

## ⭐ Summary

The Bike Rental System is now a deployed full-stack MVP with secure authentication, email OTP verification, bike management, booking workflows, user-specific booking protection, persistent storage, and an admin interface.

The recommended next phase is **online booking confirmation payment integration**.
