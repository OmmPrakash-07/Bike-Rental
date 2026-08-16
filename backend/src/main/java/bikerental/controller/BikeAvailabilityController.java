package bikerental.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import bikerental.dto.BikeAvailabilityResponse;
import bikerental.dto.DailyAvailabilityResponse;
import bikerental.service.BookingService;

@RestController
@RequestMapping("/api/bikes")
public class BikeAvailabilityController {

    private final BookingService bookingService;

    public BikeAvailabilityController(
            BookingService bookingService) {

        this.bookingService = bookingService;
    }

    /**
     * Public read-only availability endpoint.
     *
     * Example:
     * GET /api/bikes/2/availability?date=2026-08-15&durationHours=3
     */
    @GetMapping("/{bikeId}/availability")
    public BikeAvailabilityResponse getAvailability(
            @PathVariable Long bikeId,
            @RequestParam String date,
            @RequestParam(defaultValue = "1") Integer durationHours) {

        return bookingService.getBikeAvailability(
                bikeId,
                date,
                durationHours);
    }

    /**
     * Public read-only daily range availability endpoint.
     *
     * Example:
     * GET /api/bikes/2/availability/daily?date=2026-08-15&durationDays=3
     */
    @GetMapping("/{bikeId}/availability/daily")
    public DailyAvailabilityResponse getDailyAvailability(
            @PathVariable Long bikeId,
            @RequestParam String date,
            @RequestParam Integer durationDays) {

        return bookingService.getBikeDailyAvailability(
                bikeId,
                date,
                durationDays);
    }
}
