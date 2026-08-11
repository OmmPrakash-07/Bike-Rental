package bikerental.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.UserAccount;

@Service
public class EmailOtpService {

    private final JavaMailSender mailSender;
    private final String mailHost;
    private final String fromAddress;

    public EmailOtpService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.mail.from:}") String fromAddress) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.mailHost = mailHost == null ? "" : mailHost.trim();
        this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
    }

    public void sendVerificationOtp(UserAccount user, String otp, long expiryMinutes) {
        if (mailSender == null || mailHost.isBlank() || fromAddress.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email verification service is not configured");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(user.getEmail());
        message.setSubject("BikeRental email verification code");
        message.setText(
                "Hi " + user.getFullName() + ",\n\n" +
                "Your BikeRental verification code is: " + otp + "\n\n" +
                "This code expires in " + expiryMinutes + " minutes.\n" +
                "Do not share this code with anyone.\n\n" +
                "If you did not create this account, you can ignore this email.");

        try {
            mailSender.send(message);
        } catch (MailException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not send verification email. Please try again",
                    ex);
        }
    }
}
