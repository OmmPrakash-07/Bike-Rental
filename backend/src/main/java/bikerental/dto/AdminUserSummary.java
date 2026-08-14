package bikerental.dto;

import java.time.LocalDateTime;

public record AdminUserSummary(
        Long id,
        String fullName,
        String email,
        String phone,
        boolean emailVerified,
        boolean active,
        LocalDateTime createdAt,
        long totalBookings) {
}
