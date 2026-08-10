package bikerental.dto;

public record AuthResponse(
        String token,
        String tokenType,
        long expiresInSeconds,
        String role,
        UserProfile user) {
}
