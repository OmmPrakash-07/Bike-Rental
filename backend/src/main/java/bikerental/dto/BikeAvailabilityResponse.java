package bikerental.dto;

import java.util.List;

/**
 * Public availability payload for the booking UI.
 *
 * Intentionally contains no customer identity, booking id,
 * email, phone, user id or authentication data.
 */
public record BikeAvailabilityResponse(
        Long bikeId,
        String bikeName,
        String date,
        boolean operationallyAvailable,
        int durationHours,
        String shopOpen,
        String shopClose,
        List<BookedSlot> bookedSlots,
        List<PickupSlot> pickupSlots) {

    public record BookedSlot(
            String startDateTime,
            String endDateTime,
            boolean startsBeforeDate,
            boolean endsAfterDate,
            boolean allDay) {
    }

    public record PickupSlot(
            String time,
            boolean available,
            String reason) {
    }
}
