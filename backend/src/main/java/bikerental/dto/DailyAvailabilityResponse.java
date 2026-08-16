package bikerental.dto;

/**
 * Public daily availability payload for the booking UI.
 *
 * Intentionally contains no customer identity, booking id,
 * email, phone, user id or authentication data.
 */
public record DailyAvailabilityResponse(
        Long bikeId,
        String bikeName,
        String startDate,
        String endDate,
        int durationDays,
        boolean operationallyAvailable,
        boolean available,
        String reason) {
}
