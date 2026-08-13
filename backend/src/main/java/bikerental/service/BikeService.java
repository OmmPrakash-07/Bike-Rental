package bikerental.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.Bike;
import bikerental.repository.BikeRepository;
import bikerental.repository.BookingRepository;

@Service
public class BikeService {

    private static final Set<String> ACTIVE_BOOKING_STATUSES =
            Set.of("PENDING", "APPROVED");

    private static final Set<String> ALLOWED_FUEL_TYPES =
            Set.of("PETROL", "ELECTRIC");

    private final BikeRepository bikeRepository;
    private final BookingRepository bookingRepository;

    public BikeService(
            BikeRepository bikeRepository,
            BookingRepository bookingRepository) {

        this.bikeRepository = bikeRepository;
        this.bookingRepository = bookingRepository;
    }

    // ---------------------------------------------------------
    // GET ALL BIKES
    // ---------------------------------------------------------

    public List<Bike> getAllBikes() {
        return bikeRepository.findAll();
    }

    // ---------------------------------------------------------
    // GET BIKE
    // ---------------------------------------------------------

    public Bike getBikeById(Long id) {

        return bikeRepository
                .findById(id)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Bike not found"));
    }

    // ---------------------------------------------------------
    // ADD BIKE
    // ---------------------------------------------------------

    @Transactional
    public Bike addBike(Bike bike) {

        validateBike(bike);

        bike.setId(null);

        bike.setName(
                bike.getName().trim());

        bike.setType(
                bike.getType().trim());

        bike.setFuelType(
                normalizeFuelType(
                        bike.getFuelType()));

        /*
         * New bikes are operationally available
         * by default.
         *
         * Time-slot availability is handled by
         * BookingService separately.
         */
        bike.setAvailable(true);

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // UPDATE BIKE
    // ---------------------------------------------------------

    @Transactional
    public Bike updateBike(
            Long id,
            Bike newBike) {

        validateBike(newBike);

        Bike bike =
                getBikeById(id);

        bike.setName(
                newBike.getName().trim());

        bike.setType(
                newBike.getType().trim());

        bike.setFuelType(
                normalizeFuelType(
                        newBike.getFuelType()));

        bike.setPricePerDay(
                newBike.getPricePerDay());

        bike.setPricePerHour(
                newBike.getPricePerHour());

        /*
         * Do NOT allow a normal details edit
         * to silently change availability.
         *
         * Availability has dedicated endpoints.
         */
        if (newBike.getImageUrl() != null
                && !newBike.getImageUrl()
                        .isBlank()) {

            bike.setImageUrl(
                    newBike.getImageUrl());
        }

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // DELETE BIKE
    // ---------------------------------------------------------

    @Transactional
    public void deleteBike(Long id) {

        Bike bike =
                getBikeById(id);

        /*
         * Do not delete a vehicle while it has
         * pending or approved bookings.
         */
        boolean hasActiveBooking =
                bookingRepository
                        .existsByBikeIdAndStatusIn(
                                id,
                                ACTIVE_BOOKING_STATUSES)

                        ||

                        bookingRepository
                                .existsByBikeNameIgnoreCaseAndStatusIn(
                                        bike.getName(),
                                        ACTIVE_BOOKING_STATUSES);

        if (hasActiveBooking) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete a bike with an active booking");
        }

        bikeRepository.deleteById(id);
    }

    // ---------------------------------------------------------
    // MAKE AVAILABLE
    // ---------------------------------------------------------

    @Transactional
    public Bike makeAvailable(Long id) {

        Bike bike =
                getBikeById(id);

        /*
         * IMPORTANT:
         *
         * available=true means:
         *
         * The vehicle is operational and may
         * accept rental requests.
         *
         * It DOES NOT mean there are no bookings.
         *
         * Existing booking time conflicts are
         * handled by BookingService.
         */
        bike.setAvailable(true);

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // MAKE UNAVAILABLE
    // ---------------------------------------------------------

    @Transactional
    public Bike makeUnavailable(Long id) {

        Bike bike =
                getBikeById(id);

        /*
         * Admin can disable a bike because of:
         *
         * maintenance
         * repair
         * servicing
         * offline status
         * other operational reasons
         *
         * Existing booking records are NOT deleted,
         * rejected or completed automatically.
         */
        bike.setAvailable(false);

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

    private void validateBike(Bike bike) {

        if (bike == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike data is required");
        }

        // ---------------- NAME ----------------

        if (bike.getName() == null
                || bike.getName()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike name is required");
        }

        String name =
                bike.getName().trim();

        if (name.length() < 2
                || name.length() > 80) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike name must be between 2 and 80 characters");
        }

        // ---------------- TYPE ----------------

        if (bike.getType() == null
                || bike.getType()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike type is required");
        }

        String type =
                bike.getType().trim();

        if (type.length() > 30) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike type must be 30 characters or fewer");
        }

        // ---------------- FUEL TYPE ----------------

        if (bike.getFuelType() == null
                || bike.getFuelType()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Fuel type is required");
        }

        String fuelType =
                normalizeFuelType(
                        bike.getFuelType());

        if (!ALLOWED_FUEL_TYPES.contains(
                fuelType)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Fuel type must be PETROL or ELECTRIC");
        }

        // ---------------- DAILY PRICE ----------------

        if (!Double.isFinite(
                bike.getPricePerDay())

                || bike.getPricePerDay() <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per day must be greater than 0");
        }

        if (bike.getPricePerDay()
                > 1_000_000) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per day must not exceed 1000000");
        }

        // ---------------- HOURLY PRICE ----------------

        /*
         * Hourly price is now required whenever
         * a bike is created or edited.
         *
         * Existing DB bikes may still temporarily
         * contain null until admin updates them.
         */
        Double hourlyPrice =
                bike.getPricePerHour();

        if (hourlyPrice == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour is required");
        }

        if (!Double.isFinite(hourlyPrice)
                || hourlyPrice <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour must be greater than 0");
        }

        if (hourlyPrice > 1_000_000) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour must not exceed 1000000");
        }

        /*
         * Basic pricing sanity check:
         *
         * Hourly price should not be greater
         * than the full daily price.
         */
        if (hourlyPrice
                > bike.getPricePerDay()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour cannot exceed price per day");
        }
    }

    private String normalizeFuelType(
            String value) {

        return value == null
                ? ""
                : value.trim()
                        .toUpperCase(
                                Locale.ROOT);
    }

}