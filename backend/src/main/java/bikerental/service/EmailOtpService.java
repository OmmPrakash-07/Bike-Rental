package bikerental.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.UserAccount;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
public class EmailOtpService {

    private static final String BREVO_EMAIL_API =
            "https://api.brevo.com/v3/smtp/email";

    private final String apiKey;
    private final String senderEmail;
    private final String senderName;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public EmailOtpService(
            @Value("${BREVO_API_KEY:}") String apiKey,
            @Value("${BREVO_SENDER_EMAIL:}") String senderEmail,
            @Value("${BREVO_SENDER_NAME:BikeRental}") String senderName,
            ObjectMapper objectMapper) {

        this.apiKey =
                apiKey == null ? "" : apiKey.trim();

        this.senderEmail =
                senderEmail == null ? "" : senderEmail.trim();

        this.senderName =
                senderName == null || senderName.isBlank()
                        ? "BikeRental"
                        : senderName.trim();

        this.objectMapper = objectMapper;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public void sendVerificationOtp(
            UserAccount user,
            String otp,
            long expiryMinutes) {

        validateConfiguration();

        if (user == null
                || user.getEmail() == null
                || user.getEmail().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "User email is required");
        }

        String fullName =
                user.getFullName() == null
                        || user.getFullName().isBlank()
                        ? "Customer"
                        : user.getFullName().trim();

        String subject =
                "BikeRental email verification code";

        String textContent =
                "Hi " + fullName + ",\n\n"
                        + "Your BikeRental verification code is: "
                        + otp
                        + "\n\n"
                        + "This code expires in "
                        + expiryMinutes
                        + " minutes.\n\n"
                        + "Do not share this code with anyone.\n\n"
                        + "If you did not create this account, "
                        + "you can safely ignore this email.\n\n"
                        + "BikeRental";

        Map<String, Object> sender = Map.of(
                "name", senderName,
                "email", senderEmail
        );

        Map<String, Object> recipient = Map.of(
                "email", user.getEmail(),
                "name", fullName
        );

        Map<String, Object> payload = Map.of(
                "sender", sender,
                "to", List.of(recipient),
                "subject", subject,
                "textContent", textContent
        );

        String requestBody;

        try {

            requestBody =
                    objectMapper.writeValueAsString(payload);

        } catch (JacksonException ex) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not prepare verification email",
                    ex);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BREVO_EMAIL_API))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("api-key", apiKey)
                .POST(
                        HttpRequest.BodyPublishers
                                .ofString(requestBody))
                .build();

        try {

            HttpResponse<String> response =
                    httpClient.send(
                            request,
                            HttpResponse.BodyHandlers.ofString());

            int status = response.statusCode();

            if (status < 200 || status >= 300) {

                System.err.println(
                        "Brevo email API returned HTTP "
                                + status);

                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Could not send verification email. "
                                + "Please try again");
            }

            System.out.println(
                    "Verification email sent successfully "
                            + "using Brevo API");

        } catch (InterruptedException ex) {

            Thread.currentThread().interrupt();

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Verification email request was interrupted",
                    ex);

        } catch (IOException ex) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not connect to email service. "
                            + "Please try again",
                    ex);
        }
    }

    private void validateConfiguration() {

        if (apiKey.isBlank()
                || senderEmail.isBlank()
                || senderName.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email verification service is not configured");
        }
    }
}