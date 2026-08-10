package bikerental.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.model.Booking;
import bikerental.service.BookingService;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService service;

    public BookingController(BookingService service) {
        this.service = service;
    }

    @PostMapping
    public Booking addBooking(@RequestBody Booking booking, @AuthenticationPrincipal Jwt jwt) {
        return service.createBooking(booking, userId(jwt));
    }

    @GetMapping("/my")
    public List<Booking> getMyBookings(@AuthenticationPrincipal Jwt jwt) {
        return service.getBookingsForUser(userId(jwt));
    }

    @GetMapping
    public List<Booking> getBookings() {
        return service.getAllBookings();
    }

    @GetMapping("/{id}")
    public Booking getBooking(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        if (hasScope(jwt, "admin")) {
            return service.getBooking(id);
        }
        return service.getBookingForUser(id, userId(jwt));
    }

    @PutMapping("/{id}/approve")
    public Booking approveBooking(@PathVariable Long id) {
        return service.approveBooking(id);
    }

    @PutMapping("/{id}/reject")
    public Booking rejectBooking(@PathVariable Long id) {
        return service.rejectBooking(id);
    }

    @DeleteMapping("/clear")
    public void clearAllBookings() {
        service.clearAllBookings();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }

    private boolean hasScope(Jwt jwt, String scope) {
        String scopes = jwt.getClaimAsString("scope");
        return scopes != null && List.of(scopes.split(" ")).contains(scope);
    }
}
