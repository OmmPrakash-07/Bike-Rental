package bikerental.service;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.Bike;
import bikerental.model.Booking;
import bikerental.repository.BikeRepository;
import bikerental.repository.BookingRepository;

@Service
public class BikeService {

    private static final Set<String> ACTIVE_BOOKING_STATUSES = Set.of("PENDING", "APPROVED");

    private final BikeRepository bikeRepository;
    private final BookingRepository bookingRepository;

    public BikeService(BikeRepository bikeRepository, BookingRepository bookingRepository) {
        this.bikeRepository = bikeRepository;
        this.bookingRepository = bookingRepository;
    }

    public List<Bike> getAllBikes() {
        return bikeRepository.findAll();
    }

    public Bike getBikeById(Long id) {
        return bikeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bike not found"));
    }

    public Bike addBike(Bike bike) {
        validateBike(bike);
        bike.setId(null);
        bike.setName(bike.getName().trim());
        bike.setType(bike.getType().trim());
        bike.setAvailable(true);
        return bikeRepository.save(bike);
    }

    public void deleteBike(Long id) {
        Bike bike = getBikeById(id);
        boolean hasActiveBooking = bookingRepository.existsByBikeIdAndStatusIn(id, ACTIVE_BOOKING_STATUSES)
                || bookingRepository.existsByBikeNameIgnoreCaseAndStatusIn(bike.getName(), ACTIVE_BOOKING_STATUSES);
        if (hasActiveBooking) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete a bike with an active booking");
        }
        bikeRepository.deleteById(id);
    }

    @Transactional
    public Bike updateBike(Long id, Bike newBike) {
        validateBike(newBike);

        Bike bike = getBikeById(id);
        bike.setName(newBike.getName().trim());
        bike.setType(newBike.getType().trim());
        bike.setPricePerDay(newBike.getPricePerDay());

        // Availability is intentionally preserved while editing bike details.
        if (newBike.getImageUrl() != null && !newBike.getImageUrl().isBlank()) {
            bike.setImageUrl(newBike.getImageUrl());
        }

        return bikeRepository.save(bike);
    }

    @Transactional
    public Bike makeAvailable(Long id) {
        Bike bike = getBikeById(id);

        List<Booking> activeBookings = bookingRepository.findAll().stream()
                .filter(booking -> ACTIVE_BOOKING_STATUSES.contains(booking.getStatus()))
                .filter(booking -> id.equals(booking.getBikeId())
                        || (booking.getBikeId() == null
                            && booking.getBikeName() != null
                            && booking.getBikeName().equalsIgnoreCase(bike.getName())))
                .toList();

        for (Booking booking : activeBookings) {
            if (booking.getBikeId() == null) {
                booking.setBikeId(id);
            }
            if ("APPROVED".equals(booking.getStatus())) {
                booking.setStatus("COMPLETED");
            } else if ("PENDING".equals(booking.getStatus())) {
                booking.setStatus("REJECTED");
            }
            bookingRepository.save(booking);
        }

        bike.setAvailable(true);
        return bikeRepository.save(bike);
    }

    public Bike makeUnavailable(Long id) {
        Bike bike = getBikeById(id);
        if (!bike.isAvailable()) {
            return bike;
        }
        bike.setAvailable(false);
        return bikeRepository.save(bike);
    }

    private void validateBike(Bike bike) {
        if (bike == null || bike.getName() == null || bike.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bike name is required");
        }
        String name = bike.getName().trim();
        if (name.length() < 2 || name.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bike name must be between 2 and 80 characters");
        }

        if (bike.getType() == null || bike.getType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bike type is required");
        }
        if (bike.getType().trim().length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bike type must be 30 characters or fewer");
        }

        if (!Double.isFinite(bike.getPricePerDay()) || bike.getPricePerDay() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Price per day must be greater than 0");
        }
        if (bike.getPricePerDay() > 1_000_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Price per day must not exceed 1000000");
        }
    }
}
