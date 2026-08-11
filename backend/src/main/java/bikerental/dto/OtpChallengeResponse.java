package bikerental.dto;

public record OtpChallengeResponse(
        String message,
        String email,
        long expiresInSeconds,
        long resendAfterSeconds) {
}
