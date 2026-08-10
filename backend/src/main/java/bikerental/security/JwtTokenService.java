package bikerental.security;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import bikerental.dto.AuthResponse;
import bikerental.dto.UserProfile;
import bikerental.model.UserAccount;

@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final long expiryHours;

    public JwtTokenService(JwtEncoder jwtEncoder,
            @Value("${app.jwt.expiry-hours:24}") long expiryHours) {
        this.jwtEncoder = jwtEncoder;
        this.expiryHours = Math.max(1, Math.min(expiryHours, 168));
    }

    public AuthResponse createUserToken(UserAccount user) {
        UserProfile profile = new UserProfile(user.getId(), user.getFullName(), user.getEmail(), user.getPhone());
        String token = encodeToken(
                String.valueOf(user.getId()),
                "user",
                user.getEmail(),
                user.getFullName());
        return new AuthResponse(token, "Bearer", expiryHours * 3600, "USER", profile);
    }

    public AuthResponse createAdminToken() {
        String token = encodeToken("admin", "admin", null, "Administrator");
        return new AuthResponse(token, "Bearer", expiryHours * 3600, "ADMIN", null);
    }

    private String encodeToken(String subject, String scope, String email, String name) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("bike-rental-backend")
                .issuedAt(now)
                .expiresAt(now.plus(expiryHours, ChronoUnit.HOURS))
                .subject(subject)
                .claim("scope", scope)
                .claim("name", name);

        if (email != null) {
            claims.claim("email", email);
        }

        JwsHeader headers = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(headers, claims.build())).getTokenValue();
    }
}
