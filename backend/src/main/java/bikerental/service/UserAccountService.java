package bikerental.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import bikerental.dto.EmailOtpResendRequest;
import bikerental.dto.EmailOtpVerifyRequest;
import bikerental.dto.OtpChallengeResponse;
import bikerental.dto.UserLoginRequest;
import bikerental.dto.UserProfile;
import bikerental.dto.UserSignupRequest;
import bikerental.model.UserAccount;
import bikerental.repository.UserAccountRepository;

@Service
public class UserAccountService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern OTP_PATTERN = Pattern.compile("^[0-9]{6}$");
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserAccountRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final EmailOtpService emailOtpService;
    private final long otpExpiryMinutes;
    private final long otpResendSeconds;
    private final int otpMaxAttempts;

    public UserAccountService(
            UserAccountRepository repository,
            PasswordEncoder passwordEncoder,
            EmailOtpService emailOtpService,
            @Value("${app.otp.email.expiry-minutes:5}") long otpExpiryMinutes,
            @Value("${app.otp.email.resend-seconds:60}") long otpResendSeconds,
            @Value("${app.otp.email.max-attempts:5}") int otpMaxAttempts) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.emailOtpService = emailOtpService;
        this.otpExpiryMinutes = Math.max(1, otpExpiryMinutes);
        this.otpResendSeconds = Math.max(30, otpResendSeconds);
        this.otpMaxAttempts = Math.max(3, otpMaxAttempts);
    }

    @Transactional
    public OtpChallengeResponse signup(UserSignupRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signup data is required");
        }

        String fullName = normalizeName(request.fullName());
        String email = normalizeEmail(request.email());
        String phone = normalizePhone(request.phone());
        validatePassword(request.password());

        UserAccount user = repository.findByEmailIgnoreCase(email).orElse(null);

        if (user != null && user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        UserAccount phoneOwner = repository.findByPhone(phone).orElse(null);
        if (phoneOwner != null && (user == null || !phoneOwner.getId().equals(user.getId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this phone number already exists");
        }

        if (user == null) {
            user = new UserAccount();
            user.setCreatedAt(LocalDateTime.now());
        } else {
            enforceResendCooldown(user);
        }

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setActive(true);
        user.setEmailVerified(false);
        repository.save(user);

        return issueEmailOtp(user, false);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public UserAccount verifyEmail(EmailOtpVerifyRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and verification code are required");
        }

        String email = normalizeEmail(request.email());
        String otp = request.otp() == null ? "" : request.otp().trim();
        if (!OTP_PATTERN.matcher(otp).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the 6-digit verification code");
        }

        UserAccount user = repository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired verification code"));

        if (user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already verified. Please login");
        }
        if (user.getEmailOtpHash() == null || user.getEmailOtpExpiresAt() == null
                || LocalDateTime.now().isAfter(user.getEmailOtpExpiresAt())) {
            clearOtp(user);
            repository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification code expired. Request a new code");
        }
        if (user.getEmailOtpAttempts() >= otpMaxAttempts) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new code");
        }

        if (!passwordEncoder.matches(otp, user.getEmailOtpHash())) {
            user.setEmailOtpAttempts(user.getEmailOtpAttempts() + 1);
            repository.save(user);
            if (user.getEmailOtpAttempts() >= otpMaxAttempts) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new code");
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid verification code");
        }

        user.setEmailVerified(true);
        clearOtp(user);
        return repository.save(user);
    }

    @Transactional
    public OtpChallengeResponse resendEmailOtp(EmailOtpResendRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        String email = normalizeEmail(request.email());
        UserAccount user = repository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pending account not found"));

        if (user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already verified. Please login");
        }
        enforceResendCooldown(user);
        return issueEmailOtp(user, false);
    }

    public UserAccount authenticate(UserLoginRequest request) {
        if (request == null || request.email() == null || request.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }

        String email = normalizeEmail(request.email());
        UserAccount user = repository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!user.isActive() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email verification required");
        }
        return user;
    }

    public UserAccount getRequiredUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid user token");
        }
        UserAccount user = repository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User account is disabled");
        }
        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email verification required");
        }
        return user;
    }

    public UserProfile toProfile(UserAccount user) {
        return new UserProfile(user.getId(), user.getFullName(), user.getEmail(), user.getPhone());
    }

    private OtpChallengeResponse issueEmailOtp(UserAccount user, boolean enforceCooldown) {
        if (enforceCooldown) {
            enforceResendCooldown(user);
        }

        String otp = String.format(Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));
        LocalDateTime now = LocalDateTime.now();
        user.setEmailOtpHash(passwordEncoder.encode(otp));
        user.setEmailOtpExpiresAt(now.plusMinutes(otpExpiryMinutes));
        user.setEmailOtpAttempts(0);
        user.setEmailOtpLastSentAt(now);
        repository.save(user);

        emailOtpService.sendVerificationOtp(user, otp, otpExpiryMinutes);

        return new OtpChallengeResponse(
                "Verification code sent to your email",
                user.getEmail(),
                otpExpiryMinutes * 60,
                otpResendSeconds);
    }

    private void enforceResendCooldown(UserAccount user) {
        LocalDateTime lastSent = user.getEmailOtpLastSentAt();
        if (lastSent == null) {
            return;
        }
        long elapsed = Duration.between(lastSent, LocalDateTime.now()).getSeconds();
        long remaining = otpResendSeconds - elapsed;
        if (remaining > 0) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait " + remaining + " seconds before requesting another code");
        }
    }

    private void clearOtp(UserAccount user) {
        user.setEmailOtpHash(null);
        user.setEmailOtpExpiresAt(null);
        user.setEmailOtpAttempts(0);
        user.setEmailOtpLastSentAt(null);
    }

    private String normalizeName(String value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name is required");
        }
        String name = value.trim().replaceAll("\\s+", " ");
        if (name.length() < 2 || name.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name must be between 2 and 80 characters");
        }
        return name;
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        String email = value.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 160 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address");
        }
        return email;
    }

    private String normalizePhone(String value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is required");
        }
        String phone = value.replaceAll("\\D", "");
        if (!phone.matches("^[0-9]{10}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid 10-digit phone number");
        }
        return phone;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be between 8 and 72 characters");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must include at least one letter and one number");
        }
    }
}
