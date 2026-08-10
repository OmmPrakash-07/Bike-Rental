package bikerental.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import bikerental.dto.AuthResponse;
import bikerental.model.Admin;
import bikerental.security.JwtTokenService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${app.admin.username:}")
    private String adminUsername;

    @Value("${app.admin.password:}")
    private String adminPassword;

    private final JwtTokenService tokenService;

    public AuthController(JwtTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody(required = false) Admin admin) {
        if (isBlank(adminUsername) || isBlank(adminPassword)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Admin login is not configured");
        }

        if (admin == null || isBlank(admin.getUsername()) || admin.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username and password are required");
        }

        boolean usernameMatches = secureEquals(adminUsername, admin.getUsername());
        boolean passwordMatches = secureEquals(adminPassword, admin.getPassword());

        if (!usernameMatches || !passwordMatches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        return tokenService.createAdminToken();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean secureEquals(String expected, String actual) {
        if (actual == null) return false;
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
