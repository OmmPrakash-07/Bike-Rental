package bikerental.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.Bike;
import bikerental.model.Booking;
import bikerental.model.UserAccount;
import bikerental.repository.BikeRepository;
import bikerental.repository.BookingRepository;

@Service
public class BookingService {

    private static final Set<String> ACTIVE_STATUSES = Set.of("PENDING", "APPROVED");

    private final BookingRepository bookingRepository;
    private final BikeRepository bikeRepository;
    private final UserAccountService userService;

    public BookingService(BookingRepository bookingRepository,
            BikeRepository bikeRepository,
            UserAccountService userService) {
        this.bookingRepository = bookingRepository;
        this.bikeRepository = bikeRepository;
        this.userService = userService;
    }

    @Transactional
    public Booking createBooking(Booking request, Long authenticatedUserId) {
        validateBookingRequest(request);
        UserAccount user = userService.getRequiredUser(authenticatedUserId);
        Bike bike = resolveBike(request);

        if (!bike.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This bike is currently unavailable");
        }

        if (bookingRepository.existsByBikeIdAndStatusIn(bike.getId(), ACTIVE_STATUSES)
                || bookingRepository.existsByBikeNameIgnoreCaseAndStatusIn(bike.getName(), ACTIVE_STATUSES)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This bike already has an active booking request");
        }

        request.setId(null);
        request.setUserId(user.getId());
        request.setCustomerName(user.getFullName());
        request.setPhone(user.getPhone());
        request.setBikeId(bike.getId());
        request.setBikeName(bike.getName());
        request.setPricePerDay(bike.getPricePerDay());
        request.setTotalAmount(bike.getPricePerDay() * request.getDurationDays());
        request.setStatus("PENDING");

        bike.setAvailable(false);
        bikeRepository.save(bike);
        return bookingRepository.save(request);
    }

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    public List<Booking> getBookingsForUser(Long userId) {
        userService.getRequiredUser(userId);
        return bookingRepository.findByUserIdOrderByIdDesc(userId);
    }

    public Booking getBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    public Booking getBookingForUser(Long id, Long userId) {
        Booking booking = getBooking(id);
        if (booking.getUserId() == null || !booking.getUserId().equals(userId)) {
            // 404 avoids confirming that another user's booking ID exists.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }
        return booking;
    }

    @Transactional
    public Booking approveBooking(Long id) {
        Booking booking = getBooking(id);
        if (!"PENDING".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a pending booking can be approved");
        }

        Bike bike = resolveBike(booking);
        if (booking.getBikeId() == null) {
            booking.setBikeId(bike.getId());
        }

        boolean anotherApprovedBookingExists = bookingRepository
                .findByBikeIdAndStatusIn(bike.getId(), Set.of("APPROVED"))
                .stream()
                .anyMatch(existing -> !existing.getId().equals(booking.getId()));

        if (anotherApprovedBookingExists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bike is already assigned to another approved booking");
        }

        bike.setAvailable(false);
        bikeRepository.save(bike);
        booking.setStatus("APPROVED");
        return bookingRepository.save(booking);
    }

    @Transactional
    public Booking rejectBooking(Long id) {
        Booking booking = getBooking(id);
        if (!"PENDING".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a pending booking can be rejected");
        }

        booking.setStatus("REJECTED");
        Booking saved = bookingRepository.save(booking);

        try {
            Bike bike = resolveBike(booking);
            if (booking.getBikeId() == null) {
                booking.setBikeId(bike.getId());
                bookingRepository.save(booking);
            }
            bike.setAvailable(true);
            bikeRepository.save(bike);
        } catch (ResponseStatusException ignored) {
            // Legacy booking may reference a deleted bike.
        }
        return saved;
    }

    @Transactional
    public void clearAllBookings() {
        List<Booking> bookings = bookingRepository.findAll();
        bookings.stream()
                .filter(booking -> ACTIVE_STATUSES.contains(booking.getStatus()))
                .forEach(booking -> {
                    try {
                        Bike bike = resolveBike(booking);
                        bike.setAvailable(true);
                        bikeRepository.save(bike);
                    } catch (ResponseStatusException ignored) {
                        // Safe cleanup if a legacy booking points to a deleted bike.
                    }
                });
        bookingRepository.deleteAll();
    }

    private Bike resolveBike(Booking request) {
        if (request.getBikeId() != null) {
            return bikeRepository.findById(request.getBikeId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bike not found"));
        }
        if (request.getBikeName() != null && !request.getBikeName().isBlank()) {
            return bikeRepository.findFirstByNameIgnoreCase(request.getBikeName().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bike not found"));
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bikeId is required");
    }

    private void validateBookingRequest(Booking request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking data is required");
        }
        if (request.getDate() == null || request.getDate().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pickup date is required");
        }
        try {
            LocalDate pickupDate = LocalDate.parse(request.getDate());
            if (pickupDate.isBefore(LocalDate.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pickup date cannot be in the past");
            }
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pickup date must use YYYY-MM-DD format");
        }
        if (request.getDurationDays() == null || request.getDurationDays() < 1 || request.getDurationDays() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be between 1 and 30 days");
        }
        if (request.getBikeId() == null || request.getBikeId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bikeId must be a positive number");
        }
    }
}
