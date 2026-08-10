# User Authentication + Booking Ownership Setup

This patch adds customer signup/login, BCrypt password hashing, JWT bearer authentication, private "My Bookings", and backend ownership checks.

## Security behavior

- Public users can browse bikes.
- A user must sign in before creating a booking.
- The backend derives `userId`, customer name and phone from the authenticated account. It does not trust client-supplied ownership fields.
- `GET /api/bookings/my` returns only the signed-in user's bookings.
- `GET /api/bookings/{id}` returns another user's booking as `404 Booking not found`, preventing Booking ID enumeration from exposing details.
- Admin booking list, approve/reject/clear, bike write operations, and uploads require an admin JWT.
- Existing legacy bookings have no `userId`; they remain visible to admin but are not attached to any customer account.

## 1. Add JWT secret to Railway BEFORE pushing the patch

Railway -> Bike-Rental -> Variables -> New Variable:

```text
JWT_SECRET=<private random value at least 32 bytes>
JWT_EXPIRY_HOURS=24
```

Generate a safe value in Windows PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Copy only the generated value into Railway as `JWT_SECRET`. Do not put it in GitHub or README.

Keep the existing Railway variables:

```text
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
MYSQLHOST=...
MYSQLPORT=...
MYSQLUSER=...
MYSQLPASSWORD=...
MYSQLDATABASE=...
UPLOAD_DIR=/data/uploads
```

## 2. Local environment

Before running locally, set the same type of JWT secret in the PowerShell session:

```powershell
$env:JWT_SECRET="your-private-32-plus-character-secret"
$env:JWT_EXPIRY_HOURS="24"
$env:ADMIN_USERNAME="your-admin-username"
$env:ADMIN_PASSWORD="your-admin-password"
$env:MYSQLUSER="root"
$env:MYSQLPASSWORD="your-mysql-password"
$env:MYSQLDATABASE="bike_rental"
```

Then:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Hibernate `ddl-auto=update` will create the `users` table and add `user_id` to `booking` automatically.

## 3. Customer URLs

```text
/                 Customer homepage
/account.html     Customer login + signup
/login.html       Admin login
/admin.html       Admin dashboard
```

## 4. End-to-end ownership test

1. Create User A in `/account.html`.
2. Book one available bike and note Booking ID A.
3. Confirm it appears in `My Bookings`.
4. Logout.
5. Create User B.
6. Enter Booking ID A in the booking-status box.
7. Expected result: `Booking not found in your account.`
8. Login as User A again and enter the same ID.
9. Expected result: booking details are shown.

This verifies the IDOR/BOLA fix at the backend, not just in the UI.

## 5. Admin test

1. Open `/login.html` and sign in with the Railway admin credentials.
2. `/admin.html` should load booking data.
3. Logout.
4. Opening `/admin.html` again should redirect to `/login.html`.
5. Direct requests to admin booking/bike mutation APIs without the admin Bearer token should return `401` or `403`.

## New API routes

```text
POST /api/user-auth/signup     Public
POST /api/user-auth/login      Public
GET  /api/users/me             User JWT
POST /api/bookings             User JWT
GET  /api/bookings/my          User JWT
GET  /api/bookings/{id}        Owner user JWT or admin JWT
GET  /api/bookings             Admin JWT
PUT  /api/bookings/{id}/approve Admin JWT
PUT  /api/bookings/{id}/reject  Admin JWT
DELETE /api/bookings/clear      Admin JWT
```

## Next phase

After this ownership test passes, add the ₹50 Razorpay confirmation payment so a bike becomes a confirmed paid booking only after payment verification.
