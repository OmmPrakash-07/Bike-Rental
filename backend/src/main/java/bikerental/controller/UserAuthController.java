package bikerental.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.dto.AuthResponse;
import bikerental.dto.EmailOtpResendRequest;
import bikerental.dto.EmailOtpVerifyRequest;
import bikerental.dto.OtpChallengeResponse;
import bikerental.dto.UserLoginRequest;
import bikerental.dto.UserSignupRequest;
import bikerental.model.UserAccount;
import bikerental.security.JwtTokenService;
import bikerental.service.UserAccountService;

@RestController
@RequestMapping("/api/user-auth")
public class UserAuthController {

    private final UserAccountService userService;
    private final JwtTokenService tokenService;

    public UserAuthController(UserAccountService userService, JwtTokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    @PostMapping("/signup")
    public OtpChallengeResponse signup(@RequestBody(required = false) UserSignupRequest request) {
        return userService.signup(request);
    }

    @PostMapping("/verify-email")
    public AuthResponse verifyEmail(@RequestBody(required = false) EmailOtpVerifyRequest request) {
        UserAccount user = userService.verifyEmail(request);
        return tokenService.createUserToken(user);
    }

    @PostMapping("/resend-email-otp")
    public OtpChallengeResponse resendEmailOtp(@RequestBody(required = false) EmailOtpResendRequest request) {
        return userService.resendEmailOtp(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody(required = false) UserLoginRequest request) {
        UserAccount user = userService.authenticate(request);
        return tokenService.createUserToken(user);
    }
}
