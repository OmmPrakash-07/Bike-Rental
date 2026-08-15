# BikeRental Email OTP Verification

This patch changes customer signup from immediate JWT login to email verification first.

## New customer flow

1. Customer submits name, email, phone and password.
2. Backend creates/updates an unverified customer record.
3. A 6-digit OTP is generated with `SecureRandom`.
4. Only a BCrypt hash of the OTP is stored in MySQL.
5. OTP is emailed through the Brevo Transactional Email API over HTTPS.
6. Customer enters the OTP on `account.html`.
7. Correct, non-expired OTP marks the email verified and returns the normal user JWT.
8. Login and protected booking APIs reject unverified customer accounts.

Existing customer rows created before this patch have no verification flag and are treated as unverified. They can login with the correct password, then use **Resend code** to verify the existing email once.

## Security limits

- OTP length: 6 digits
- Default expiry: 5 minutes
- Default resend cooldown: 60 seconds
- Default maximum wrong attempts: 5
- OTP is not returned by any API
- OTP is not logged by application code
- OTP is stored only as a BCrypt hash
- JWT is issued only after successful email verification

## New / changed APIs

```http
POST /api/user-auth/signup
POST /api/user-auth/verify-email
POST /api/user-auth/resend-email-otp
POST /api/user-auth/login
```

### Signup

```json
{
  "fullName": "Test User",
  "email": "real-email@example.com",
  "phone": "9876500011",
  "password": "Example123"
}
```

Successful response no longer contains a JWT:

```json
{
  "message": "Verification code sent to your email",
  "email": "real-email@example.com",
  "expiresInSeconds": 300,
  "resendAfterSeconds": 60
}
```

### Verify email

```json
{
  "email": "real-email@example.com",
  "otp": "123456"
}
```

A successful verification returns the normal JWT response and the frontend signs the user in.

## Brevo environment variables

Configure these locally and in Railway. Never commit real credentials.

```text
BREVO_API_KEY=<Brevo API key>
BREVO_SENDER_EMAIL=<verified sender email>
BREVO_SENDER_NAME=BikeRental
```

Optional OTP tuning:

```text
EMAIL_OTP_EXPIRY_MINUTES=5
EMAIL_OTP_RESEND_SECONDS=60
EMAIL_OTP_MAX_ATTEMPTS=5
```

Do not put the real Brevo API key in `application.properties`, GitHub, README screenshots, or chat.

## Local test sequence

Set MySQL, JWT, admin and Brevo environment variables in the same PowerShell terminal, then run:

```powershell
cd "E:\Project\Major Project\Bike Rental\backend"
.\mvnw.cmd clean spring-boot:run
```

Serve frontend in another terminal:

```powershell
cd "E:\Project\Major Project\Bike Rental\frontend"
python -m http.server 5500
```

Open:

```text
http://localhost:5500/account.html?mode=signup
```

Use a real inbox you can access. Confirm:

- Signup does not log the user in immediately.
- Email receives a 6-digit OTP.
- Wrong OTP is rejected.
- Correct OTP signs the user in.
- Resend is blocked during cooldown.
- Login before verification is blocked.
- After verification, login and My Bookings work normally.

## Railway deployment order

Add the Brevo variables to Railway **before** pushing this patch to production. Otherwise signup will correctly fail with a 503 because email delivery is not configured.
