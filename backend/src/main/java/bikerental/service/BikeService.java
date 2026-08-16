package bikerental.service;

import java.time.LocalDateTime;
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

        this.bikeRepository =
                bikeRepository;

        this.bookingRepository =
                bookingRepository;
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

        validateBike(
                bike);

        bike.setId(
                null);

        applyEditableFields(
                bike,
                bike);

        /*
         * New bikes are operationally available by default.
         * Time-slot availability is handled separately.
         */
        bike.setAvailable(
                true);

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

        validateBike(
                newBike);

        Bike bike =
                getBikeById(
                        id);

        applyEditableFields(
                bike,
                newBike);

        /*
         * Do NOT allow a normal details edit to silently change
         * operational availability. Availability has dedicated
         * endpoints.
         */
        if (newBike.getImageUrl() != null
                && !newBike.getImageUrl()
                        .isBlank()) {

            bike.setImageUrl(
                    newBike.getImageUrl()
                            .trim());
        }

        return bikeRepository.save(
                bike);
    }

    private void applyEditableFields(
            Bike target,
            Bike source) {

        target.setName(
                source.getName()
                        .trim());

        target.setType(
                source.getType()
                        .trim());

        String fuelType =
                normalizeFuelType(
                        source.getFuelType());

        target.setFuelType(
                fuelType);

        target.setModelYear(
                source.getModelYear());

        target.setPricePerDay(
                source.getPricePerDay());

        target.setPricePerHour(
                source.getPricePerHour());

        // AI-assisted technical fields.
        target.setDisplacementCc(
                source.getDisplacementCc());

        target.setEngineType(
                clean(
                        source.getEngineType()));

        target.setMaxPower(
                clean(
                        source.getMaxPower()));

        target.setMaxTorque(
                clean(
                        source.getMaxTorque()));

        target.setTransmission(
                clean(
                        source.getTransmission()));

        target.setTopSpeedKmph(
                source.getTopSpeedKmph());

        target.setMileageKmpl(
                source.getMileageKmpl());

        target.setFuelTankLitres(
                source.getFuelTankLitres());

        target.setBatteryCapacityKwh(
                source.getBatteryCapacityKwh());

        target.setClaimedRangeKm(
                source.getClaimedRangeKm());

        target.setChargingTime(
                clean(
                        source.getChargingTime()));

        target.setMotorPower(
                clean(
                        source.getMotorPower()));

        target.setFrontBrake(
                clean(
                        source.getFrontBrake()));

        target.setRearBrake(
                clean(
                        source.getRearBrake()));

        target.setAbsType(
                clean(
                        source.getAbsType()));

        target.setFrontTyre(
                clean(
                        source.getFrontTyre()));

        target.setRearTyre(
                clean(
                        source.getRearTyre()));

        target.setWheelType(
                clean(
                        source.getWheelType()));

        target.setFrontSuspension(
                clean(
                        source.getFrontSuspension()));

        target.setRearSuspension(
                clean(
                        source.getRearSuspension()));

        target.setKerbWeightKg(
                source.getKerbWeightKg());

        target.setSeatHeightMm(
                source.getSeatHeightMm());

        target.setGroundClearanceMm(
                source.getGroundClearanceMm());

        target.setCylinders(
                source.getCylinders());

        target.setCoolingSystem(
                clean(
                        source.getCoolingSystem()));

        target.setClutchType(
                clean(
                        source.getClutchType()));

        target.setStartingType(
                clean(
                        source.getStartingType()));

        /*
         * Never keep petrol-only fields on electric vehicles,
         * or electric-only fields on petrol vehicles.
         */
        if ("ELECTRIC".equals(
                fuelType)) {

            target.setDisplacementCc(
                    null);

            target.setMileageKmpl(
                    null);

            target.setFuelTankLitres(
                    null);

            target.setCylinders(
                    null);

            target.setCoolingSystem(
                    null);

            target.setClutchType(
                    null);

        } else {

            target.setBatteryCapacityKwh(
                    null);

            target.setClaimedRangeKm(
                    null);

            target.setChargingTime(
                    null);

            target.setMotorPower(
                    null);
        }

        boolean hasSpecs =
                hasAnySpecification(
                        source);

        target.setSpecificationsGeneratedAt(
                hasSpecs
                        ? LocalDateTime.now()
                        : null);

        target.setSpecificationsModel(
                hasSpecs
                        ? clean(
                                source.getSpecificationsModel())
                        : null);
    }

    // ---------------------------------------------------------
    // DELETE BIKE
    // ---------------------------------------------------------

    @Transactional
    public void deleteBike(Long id) {

        Bike bike =
                getBikeById(
                        id);

        boolean hasActiveBooking =
                bookingRepository
                        .existsByBikeIdAndStatusIn(
                                id,
                                ACTIVE_BOOKING_STATUSES)

                        ||

                        bookingRepository
                                .existsByBikeIdIsNullAndBikeNameIgnoreCaseAndStatusIn(
                                        bike.getName(),
                                        ACTIVE_BOOKING_STATUSES);

        if (hasActiveBooking) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete a bike with an active booking");
        }

        bikeRepository.deleteById(
                id);
    }

    // ---------------------------------------------------------
    // MAKE AVAILABLE
    // ---------------------------------------------------------

    @Transactional
    public Bike makeAvailable(Long id) {

        Bike bike =
                getBikeById(
                        id);

        bike.setAvailable(
                true);

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // MAKE UNAVAILABLE
    // ---------------------------------------------------------

    @Transactional
    public Bike makeUnavailable(Long id) {

        Bike bike =
                getBikeById(
                        id);

        bike.setAvailable(
                false);

        return bikeRepository.save(
                bike);
    }

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

    private void validateBike(
            Bike bike) {

        if (bike == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike data is required");
        }

        if (bike.getName() == null
                || bike.getName()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike name is required");
        }

        String name =
                bike.getName()
                        .trim();

        if (name.length() < 2
                || name.length() > 80) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike name must be between 2 and 80 characters");
        }

        if (bike.getType() == null
                || bike.getType()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike type is required");
        }

        String type =
                bike.getType()
                        .trim();

        if (type.length() > 30) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bike type must be 30 characters or fewer");
        }

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

        Integer modelYear =
                bike.getModelYear();

        if (modelYear == null
                || modelYear < 1950
                || modelYear > 2100) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Model year must be between 1950 and 2100");
        }

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

        Double hourlyPrice =
                bike.getPricePerHour();

        if (hourlyPrice == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour is required");
        }

        if (!Double.isFinite(
                hourlyPrice)
                || hourlyPrice <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour must be greater than 0");
        }

        if (hourlyPrice
                > 1_000_000) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour must not exceed 1000000");
        }

        if (hourlyPrice
                > bike.getPricePerDay()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Price per hour cannot exceed price per day");
        }

        validateTechnicalRanges(
                bike,
                fuelType);
    }

    private void validateTechnicalRanges(
            Bike bike,
            String fuelType) {

        ensureIntegerRange(
                bike.getDisplacementCc(),
                20,
                5000,
                "Displacement");

        ensureIntegerRange(
                bike.getTopSpeedKmph(),
                5,
                500,
                "Top speed");

        ensureDoubleRange(
                bike.getMileageKmpl(),
                1,
                300,
                "Mileage");

        ensureDoubleRange(
                bike.getFuelTankLitres(),
                0.5,
                100,
                "Fuel tank");

        ensureDoubleRange(
                bike.getBatteryCapacityKwh(),
                0.1,
                100,
                "Battery capacity");

        ensureIntegerRange(
                bike.getClaimedRangeKm(),
                1,
                2000,
                "Claimed range");

        ensureDoubleRange(
                bike.getKerbWeightKg(),
                20,
                1000,
                "Kerb weight");

        ensureIntegerRange(
                bike.getSeatHeightMm(),
                300,
                1500,
                "Seat height");

        ensureIntegerRange(
                bike.getGroundClearanceMm(),
                30,
                1000,
                "Ground clearance");

        ensureIntegerRange(
                bike.getCylinders(),
                1,
                16,
                "Cylinder count");

        if ("ELECTRIC".equals(
                fuelType)
                && bike.getMileageKmpl() != null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Electric vehicles cannot use petrol mileage specifications");
        }

        if ("PETROL".equals(
                fuelType)
                && bike.getBatteryCapacityKwh() != null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Petrol vehicles cannot use electric battery specifications");
        }
    }

    private void ensureIntegerRange(
            Integer value,
            int minimum,
            int maximum,
            String label) {

        if (value != null
                && (value < minimum
                || value > maximum)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label
                            + " is outside the supported range");
        }
    }

    private void ensureDoubleRange(
            Double value,
            double minimum,
            double maximum,
            String label) {

        if (value != null
                && (!Double.isFinite(value)
                || value < minimum
                || value > maximum)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label
                            + " is outside the supported range");
        }
    }

    private boolean hasAnySpecification(
            Bike bike) {

        return bike.getDisplacementCc() != null
                || clean(
                        bike.getEngineType()) != null
                || clean(
                        bike.getMaxPower()) != null
                || clean(
                        bike.getMaxTorque()) != null
                || clean(
                        bike.getTransmission()) != null
                || bike.getTopSpeedKmph() != null
                || bike.getMileageKmpl() != null
                || bike.getFuelTankLitres() != null
                || bike.getBatteryCapacityKwh() != null
                || bike.getClaimedRangeKm() != null
                || clean(
                        bike.getMotorPower()) != null
                || clean(
                        bike.getFrontBrake()) != null
                || clean(
                        bike.getRearBrake()) != null
                || clean(
                        bike.getFrontTyre()) != null
                || clean(
                        bike.getRearTyre()) != null
                || bike.getKerbWeightKg() != null;
    }

    private String clean(
            String value) {

        if (value == null) {
            return null;
        }

        String cleaned =
                value.trim()
                        .replaceAll(
                                "\\s+",
                                " ");

        if (cleaned.isBlank()
                || cleaned.length() > 180) {
            return null;
        }

        return cleaned;
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
