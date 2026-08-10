package bikerental.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.model.Admin;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${app.admin.username:}")
    private String adminUsername;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody(required = false) Admin admin) {
        // No source-code fallback credentials. Production/local credentials must be
        // supplied through ADMIN_USERNAME and ADMIN_PASSWORD environment variables.
        if (isBlank(adminUsername) || isBlank(adminPassword)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("ADMIN_NOT_CONFIGURED");
        }

        if (admin == null || isBlank(admin.getUsername()) || admin.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("INVALID_REQUEST");
        }

        boolean usernameMatches = secureEquals(adminUsername, admin.getUsername());
        boolean passwordMatches = secureEquals(adminPassword, admin.getPassword());

        if (usernameMatches && passwordMatches) {
            return ResponseEntity.ok("SUCCESS");
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("FAIL");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean secureEquals(String expected, String actual) {
        if (actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
