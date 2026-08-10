package bikerental.dto;

public record UserSignupRequest(String fullName, String email, String phone, String password) {
}
