package bikerental.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import bikerental.dto.BikeAvailabilityResponse;
import bikerental.dto.DailyAvailabilityResponse;
import bikerental.model.Bike;
import bikerental.model.Booking;
import bikerental.model.UserAccount;
import bikerental.repository.BikeRepository;
import bikerental.repository.BookingRepository;

@Service
public class BookingService {

    private static final Set<String> ACTIVE_STATUSES =
            Set.of("PENDING", "APPROVED");

    private static final ZoneId RENTAL_ZONE =
            ZoneId.of("Asia/Kolkata");

    private static final DateTimeFormatter TIME_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm");

    /*
     * Shop and pickup-slot timing.
     *
     * Customers may pick up a bike from 08:00 AM through 10:00 PM,
     * on exact one-hour slots only.
     */
    private static final LocalTime SHOP_OPEN_TIME =
            LocalTime.of(8, 0);

    private static final LocalTime SHOP_CLOSE_TIME =
            LocalTime.of(22, 0);

    /*
     * If an hourly rental would return after 10:00 PM,
     * the bike cannot be returned while the shop is closed.
     *
     * Overnight rentals therefore have a minimum billable
     * duration of 12 hours, and the reservation remains active
     * until at least the next 08:00 AM opening time.
     */
    private static final int MIN_OVERNIGHT_HOURS = 12;

    private final BookingRepository bookingRepository;
    private final BikeRepository bikeRepository;
    private final UserAccountService userService;

    public BookingService(
            BookingRepository bookingRepository,
            BikeRepository bikeRepository,
            UserAccountService userService) {

        this.bookingRepository = bookingRepository;
        this.bikeRepository = bikeRepository;
        this.userService = userService;
    }

    // ---------------------------------------------------------
    // CREATE BOOKING
    // ---------------------------------------------------------

    @Transactional
    public Booking createBooking(
            Booking request,
            Long authenticatedUserId) {

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Booking data is required");
        }

        UserAccount user =
                userService.getRequiredUser(
                        authenticatedUserId);

        Bike bike = resolveBike(request);

        /*
         * available=false now means the bike has been
         * manually/operationally disabled by admin.
         *
         * Normal scheduled bookings will later be handled
         * using time-slot conflict checks instead of
         * permanently disabling the bike.
         */
        if (!bike.isAvailable()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This bike is currently unavailable");
        }

        RentalWindow window =
                validateAndBuildWindow(request);

        /*
         * Check only bookings whose time range overlaps.
         */
        Booking conflictingBooking =
                findConflictingBooking(
                        bike,
                        window.start(),
                        window.end(),
                        null,
                        ACTIVE_STATUSES);

        if (conflictingBooking != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This bike is already booked for the selected time");
        }

        double totalAmount;

        Double hourlyPrice =
                bike.getPricePerHour();

        if ("HOURLY".equals(window.rentalType())) {

            if (hourlyPrice == null
                    || !Double.isFinite(hourlyPrice)
                    || hourlyPrice <= 0) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Hourly rental price is not configured for this bike");
            }

            totalAmount =
                    hourlyPrice
                            * window.durationHours();

        } else {

            totalAmount =
                    bike.getPricePerDay()
                            * window.durationDays();
        }

        /*
         * Do NOT save the frontend request directly.
         *
         * Create a clean backend-owned booking so that
         * frontend cannot manipulate:
         *
         * userId
         * customerName
         * phone
         * bikeName
         * prices
         * totalAmount
         * status
         * start/end timestamps
         */
        Booking booking =
                new Booking();

        booking.setUserId(
                user.getId());

        booking.setCustomerName(
                user.getFullName());

        booking.setPhone(
                user.getPhone());

        booking.setBikeId(
                bike.getId());

        booking.setBikeName(
                bike.getName());

        booking.setDate(
                window.date().toString());

        booking.setRentalType(
                window.rentalType());

        booking.setPickupTime(
                window.pickupTime());

        booking.setDurationDays(
                window.durationDays());

        booking.setDurationHours(
                window.durationHours());

        booking.setPricePerDay(
                bike.getPricePerDay());

        booking.setPricePerHour(
                hourlyPrice);

        booking.setTotalAmount(
                roundMoney(totalAmount));

        booking.setStartDateTime(
                window.start());

        booking.setEndDateTime(
                window.end());

        booking.setStatus(
                "PENDING");

        /*
         * IMPORTANT:
         *
         * Do NOT call:
         *
         * bike.setAvailable(false)
         *
         * because one booking should only reserve its
         * own time interval.
         */

        return bookingRepository.save(
                booking);
    }

    // ---------------------------------------------------------
    // LIST BOOKINGS
    // ---------------------------------------------------------

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    public List<Booking> getBookingsForUser(
            Long userId) {

        userService.getRequiredUser(
                userId);

        return bookingRepository
                .findByUserIdOrderByIdDesc(
                        userId);
    }

    // ---------------------------------------------------------
    // PUBLIC BIKE AVAILABILITY
    // ---------------------------------------------------------

    /**
     * Returns only occupancy information required by the customer
     * booking UI. No user name, phone, email, booking id or other
     * customer data is exposed.
     */
    public BikeAvailabilityResponse getBikeAvailability(
            Long bikeId,
            String dateText,
            Integer durationHours) {

        if (bikeId == null || bikeId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "bikeId must be a positive number");
        }

        Bike bike =
                bikeRepository
                        .findById(bikeId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Bike not found"));

        LocalDate date;

        try {
            date = LocalDate.parse(dateText);
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "date must use YYYY-MM-DD format");
        }

        LocalDate today =
                LocalDate.now(RENTAL_ZONE);

        if (date.isBefore(today)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Availability date cannot be in the past");
        }

        int requestedHours =
                durationHours == null
                        ? 1
                        : durationHours;

        if (requestedHours < 1
                || requestedHours > 12) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "durationHours must be between 1 and 12");
        }

        List<Booking> candidates =
                getCandidateBookings(
                        bike,
                        ACTIVE_STATUSES);

        LocalDateTime dayStart =
                date.atStartOfDay();

        LocalDateTime dayEnd =
                date.plusDays(1)
                        .atStartOfDay();

        List<BikeAvailabilityResponse.BookedSlot> bookedSlots =
                new ArrayList<>();

        Set<Long> bookedSlotSeenIds =
                new HashSet<>();

        for (Booking existing : candidates) {

            if (existing.getId() != null
                    && !bookedSlotSeenIds.add(
                            existing.getId())) {
                continue;
            }

            RentalWindow existingWindow;

            try {
                existingWindow =
                        getStoredBookingWindow(
                                existing);
            } catch (ResponseStatusException ex) {
                /*
                 * A malformed active legacy booking is treated as an
                 * all-day block rather than exposing a risky slot.
                 */
                bookedSlots.add(
                        new BikeAvailabilityResponse.BookedSlot(
                                dayStart.toString(),
                                dayEnd.toString(),
                                false,
                                false,
                                true));
                continue;
            }

            if (!rangesOverlap(
                    dayStart,
                    dayEnd,
                    existingWindow.start(),
                    existingWindow.end())) {
                continue;
            }

            LocalDateTime clippedStart =
                    existingWindow.start()
                            .isBefore(dayStart)
                                    ? dayStart
                                    : existingWindow.start();

            LocalDateTime clippedEnd =
                    existingWindow.end()
                            .isAfter(dayEnd)
                                    ? dayEnd
                                    : existingWindow.end();

            boolean startsBeforeDate =
                    existingWindow.start()
                            .isBefore(dayStart);

            boolean endsAfterDate =
                    existingWindow.end()
                            .isAfter(dayEnd);

            boolean allDay =
                    clippedStart.equals(dayStart)
                            && clippedEnd.equals(dayEnd);

            bookedSlots.add(
                    new BikeAvailabilityResponse.BookedSlot(
                            clippedStart.toString(),
                            clippedEnd.toString(),
                            startsBeforeDate,
                            endsAfterDate,
                            allDay));
        }

        bookedSlots.sort(
                (left, right) ->
                        left.startDateTime()
                                .compareTo(
                                        right.startDateTime()));

        List<BikeAvailabilityResponse.PickupSlot> pickupSlots =
                new ArrayList<>();

        LocalDateTime now =
                LocalDateTime.now(RENTAL_ZONE);

        for (int hour =
                     SHOP_OPEN_TIME.getHour();
             hour <= SHOP_CLOSE_TIME.getHour();
             hour++) {

            LocalTime pickupTime =
                    LocalTime.of(hour, 0);

            RentalWindow requestedWindow =
                    calculateHourlyWindow(
                            date,
                            pickupTime,
                            requestedHours,
                            false);

            boolean available = true;
            String reason = "AVAILABLE";

            if (!bike.isAvailable()) {
                available = false;
                reason = "VEHICLE_UNAVAILABLE";

            } else if (!requestedWindow.start()
                    .isAfter(now)) {
                available = false;
                reason = "PAST";

            } else {
                Booking conflict =
                        findConflictingBookingInCandidates(
                                candidates,
                                requestedWindow.start(),
                                requestedWindow.end(),
                                null);

                if (conflict != null) {
                    available = false;
                    reason = "BOOKED";
                }
            }

            pickupSlots.add(
                    new BikeAvailabilityResponse.PickupSlot(
                            pickupTime.format(TIME_FORMAT),
                            available,
                            reason));
        }

        return new BikeAvailabilityResponse(
                bike.getId(),
                bike.getName(),
                date.toString(),
                bike.isAvailable(),
                requestedHours,
                SHOP_OPEN_TIME.format(TIME_FORMAT),
                SHOP_CLOSE_TIME.format(TIME_FORMAT),
                bookedSlots,
                pickupSlots);
    }

    /**
     * Returns whether a complete daily date range is available.
     * This is informational only; createBooking remains authoritative.
     */
    public DailyAvailabilityResponse getBikeDailyAvailability(
            Long bikeId,
            String dateText,
            Integer durationDays) {

        if (bikeId == null || bikeId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "bikeId must be a positive number");
        }

        Bike bike =
                bikeRepository
                        .findById(bikeId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Bike not found"));

        LocalDate date;

        try {
            date = LocalDate.parse(dateText);
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "date must use YYYY-MM-DD format");
        }

        LocalDate today =
                LocalDate.now(RENTAL_ZONE);

        if (date.isBefore(today)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Availability date cannot be in the past");
        }

        RentalWindow window =
                buildDailyWindow(
                        durationDays,
                        date);

        boolean available =
                bike.isAvailable();

        String reason =
                available
                        ? "AVAILABLE"
                        : "VEHICLE_UNAVAILABLE";

        if (available) {

            Booking conflict =
                    findConflictingBooking(
                            bike,
                            window.start(),
                            window.end(),
                            null,
                            ACTIVE_STATUSES);

            if (conflict != null) {
                available = false;
                reason = "BOOKED";
            }
        }

        return new DailyAvailabilityResponse(
                bike.getId(),
                bike.getName(),
                window.date()
                        .toString(),
                window.end()
                        .toLocalDate()
                        .toString(),
                window.durationDays(),
                bike.isAvailable(),
                available,
                reason);
    }

    // ---------------------------------------------------------
    // GET BOOKING
    // ---------------------------------------------------------

    public Booking getBooking(Long id) {

        return bookingRepository
                .findById(id)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Booking not found"));
    }

    public Booking getBookingForUser(
            Long id,
            Long userId) {

        Booking booking =
                getBooking(id);

        if (booking.getUserId() == null
                || !booking.getUserId()
                        .equals(userId)) {

            /*
             * Return 404 instead of 403 so another user
             * cannot confirm that the booking ID exists.
             */
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Booking not found");
        }

        return booking;
    }

    // ---------------------------------------------------------
    // APPROVE
    // ---------------------------------------------------------

    @Transactional
    public Booking approveBooking(
            Long id) {

        Booking booking =
                getBooking(id);

        if (!"PENDING".equals(
                booking.getStatus())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only a pending booking can be approved");
        }

        Bike bike =
                resolveBike(booking);

        if (booking.getBikeId() == null) {

            booking.setBikeId(
                    bike.getId());
        }

        RentalWindow window =
                getStoredBookingWindow(
                        booking);

        Booking conflict =
                findConflictingBooking(
                        bike,
                        window.start(),
                        window.end(),
                        booking.getId(),
                        Set.of("APPROVED"));

        if (conflict != null) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bike is already assigned to another booking during this time");
        }

        booking.setStatus(
                "APPROVED");

        return bookingRepository.save(
                booking);
    }

    // ---------------------------------------------------------
    // REJECT
    // ---------------------------------------------------------

    @Transactional
    public Booking rejectBooking(
            Long id) {

        Booking booking =
                getBooking(id);

        if (!"PENDING".equals(
                booking.getStatus())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only a pending booking can be rejected");
        }

        booking.setStatus(
                "REJECTED");

        /*
         * We intentionally do not change bike.available.
         *
         * Rejecting one time slot must not affect
         * another booking slot.
         */

        return bookingRepository.save(
                booking);
    }

    // ---------------------------------------------------------
    // CLEAR
    // ---------------------------------------------------------

    @Transactional
    public void clearAllBookings() {

        /*
         * Booking deletion no longer modifies
         * bike availability.
         */
        bookingRepository.deleteAll();
    }

    // ---------------------------------------------------------
    // BIKE RESOLUTION
    // ---------------------------------------------------------

    private Bike resolveBike(
            Booking request) {

        if (request.getBikeId() != null) {

            return bikeRepository
                    .findById(
                            request.getBikeId())
                    .orElseThrow(
                            () ->
                                    new ResponseStatusException(
                                            HttpStatus.NOT_FOUND,
                                            "Bike not found"));
        }

        /*
         * Compatibility with old/legacy records.
         */
        if (request.getBikeName() != null
                && !request.getBikeName()
                        .isBlank()) {

            return bikeRepository
                    .findFirstByNameIgnoreCase(
                            request.getBikeName()
                                    .trim())
                    .orElseThrow(
                            () ->
                                    new ResponseStatusException(
                                            HttpStatus.NOT_FOUND,
                                            "Bike not found"));
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "bikeId is required");
    }

    // ---------------------------------------------------------
    // NEW REQUEST VALIDATION
    // ---------------------------------------------------------

    private RentalWindow validateAndBuildWindow(
            Booking request) {

        if (request.getBikeId() == null
                || request.getBikeId() <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "bikeId must be a positive number");
        }

        if (request.getDate() == null
                || request.getDate()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup date is required");
        }

        LocalDate date;

        try {

            date =
                    LocalDate.parse(
                            request.getDate());

        } catch (DateTimeParseException ex) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup date must use YYYY-MM-DD format");
        }

        LocalDate today =
                LocalDate.now(
                        RENTAL_ZONE);

        if (date.isBefore(today)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup date cannot be in the past");
        }

        /*
         * Old frontend compatibility:
         *
         * If rentalType is missing,
         * treat it as DAILY.
         */
        String rentalType =
                normalizeRentalType(
                        request.getRentalType());

        if ("HOURLY".equals(
                rentalType)) {

            return buildHourlyWindow(
                    request,
                    date);
        }

        return buildDailyWindow(
                request,
                date);
    }

    // ---------------------------------------------------------
    // HOURLY
    // ---------------------------------------------------------

    private RentalWindow buildHourlyWindow(
            Booking request,
            LocalDate date) {

        if (request.getPickupTime() == null
                || request.getPickupTime()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time is required for hourly rental");
        }

        LocalTime pickupTime;

        try {

            pickupTime =
                    LocalTime.parse(
                            request.getPickupTime()
                                    .trim(),
                            TIME_FORMAT);

        } catch (DateTimeParseException ex) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time must use HH:mm format");
        }

        /*
         * Shop hours and pickup slots are the same:
         *
         * 08:00 AM through 10:00 PM.
         *
         * Pickup slots are exactly one hour apart, so minutes
         * must always be 00.
         */
        if (pickupTime.isBefore(SHOP_OPEN_TIME)
                || pickupTime.isAfter(SHOP_CLOSE_TIME)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time must be between 08:00 and 22:00");
        }

        if (pickupTime.getMinute() != 0
                || pickupTime.getSecond() != 0
                || pickupTime.getNano() != 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup time must use a one-hour slot");
        }

        Integer requestedHours =
                request.getDurationHours();

        if (requestedHours == null
                || requestedHours < 1
                || requestedHours > 12) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hourly duration must be between 1 and 12 hours");
        }

        return calculateHourlyWindow(
                date,
                pickupTime,
                requestedHours,
                true);
    }

    private RentalWindow calculateHourlyWindow(
            LocalDate date,
            LocalTime pickupTime,
            int requestedHours,
            boolean enforceFuture) {

        LocalDateTime start =
                LocalDateTime.of(
                        date,
                        pickupTime);

        if (enforceFuture) {
            LocalDateTime now =
                    LocalDateTime.now(
                            RENTAL_ZONE);

            if (!start.isAfter(now)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hourly pickup time must be in the future");
            }
        }

        LocalDateTime requestedEnd =
                start.plusHours(
                        requestedHours);

        LocalDateTime sameDayClosing =
                LocalDateTime.of(
                        date,
                        SHOP_CLOSE_TIME);

        LocalDateTime finalEnd =
                requestedEnd;

        int billableHours =
                requestedHours;

        /*
         * If the requested return crosses 10:00 PM, keep the bike
         * until at least the next 08:00 AM opening and enforce the
         * existing 12-hour overnight minimum. This is the same rule
         * used for both the real booking and availability preview.
         */
        if (requestedEnd.isAfter(
                sameDayClosing)) {

            LocalDateTime nextOpening =
                    date.plusDays(1)
                            .atTime(
                                    SHOP_OPEN_TIME);

            LocalDateTime minimumOvernightEnd =
                    start.plusHours(
                            MIN_OVERNIGHT_HOURS);

            finalEnd =
                    latestOf(
                            requestedEnd,
                            nextOpening,
                            minimumOvernightEnd);

            long calculatedHours =
                    Duration.between(
                            start,
                            finalEnd)
                            .toHours();

            if (calculatedHours < 1
                    || calculatedHours > Integer.MAX_VALUE) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Unable to calculate hourly rental duration");
            }

            billableHours =
                    (int) calculatedHours;
        }

        return new RentalWindow(
                "HOURLY",
                date,
                pickupTime.format(
                        TIME_FORMAT),
                null,
                billableHours,
                start,
                finalEnd);
    }

    // ---------------------------------------------------------
    // DAILY
    // ---------------------------------------------------------

    private RentalWindow buildDailyWindow(
            Booking request,
            LocalDate date) {

        return buildDailyWindow(
                request.getDurationDays(),
                date);
    }

    private RentalWindow buildDailyWindow(
            Integer days,
            LocalDate date) {

        if (days == null
                || days < 1
                || days > 30) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Daily duration must be between 1 and 30 days");
        }

        /*
         * A daily booking occupies the whole date range.
         *
         * Example:
         *
         * 15 Aug, 2 days
         *
         * start = 15 Aug 00:00
         * end   = 17 Aug 00:00
         */
        LocalDateTime start =
                date.atStartOfDay();

        LocalDateTime end =
                start.plusDays(days);

        return new RentalWindow(
                "DAILY",
                date,
                null,
                days,
                null,
                start,
                end);
    }

    // ---------------------------------------------------------
    // OVERLAP CHECKING
    // ---------------------------------------------------------

    private Booking findConflictingBooking(
            Bike bike,
            LocalDateTime requestedStart,
            LocalDateTime requestedEnd,
            Long excludeBookingId,
            Set<String> statuses) {

        return findConflictingBookingInCandidates(
                getCandidateBookings(
                        bike,
                        statuses),
                requestedStart,
                requestedEnd,
                excludeBookingId);
    }

    private List<Booking> getCandidateBookings(
            Bike bike,
            Set<String> statuses) {

        List<Booking> candidates =
                new ArrayList<>();

        /*
         * Normal modern records.
         */
        candidates.addAll(
                bookingRepository
                        .findByBikeIdAndStatusIn(
                                bike.getId(),
                                statuses));

        /*
         * Compatibility for old bookings
         * that may only contain bikeName.
         */
        candidates.addAll(
                bookingRepository
                        .findByBikeNameIgnoreCaseAndStatusIn(
                                bike.getName(),
                                statuses));

        return candidates;
    }

    private Booking findConflictingBookingInCandidates(
            List<Booking> candidates,
            LocalDateTime requestedStart,
            LocalDateTime requestedEnd,
            Long excludeBookingId) {

        Set<Long> seenIds =
                new HashSet<>();

        for (Booking existing : candidates) {

            if (existing.getId() != null) {

                if (!seenIds.add(
                        existing.getId())) {
                    continue;
                }
            }

            if (excludeBookingId != null
                    && excludeBookingId.equals(
                            existing.getId())) {
                continue;
            }

            RentalWindow existingWindow;

            try {
                existingWindow =
                        getStoredBookingWindow(
                                existing);
            } catch (ResponseStatusException ex) {
                /*
                 * If an active legacy booking is too damaged to
                 * calculate safely, block the requested slot rather
                 * than risk double-booking the same bike.
                 */
                return existing;
            }

            if (rangesOverlap(
                    requestedStart,
                    requestedEnd,
                    existingWindow.start(),
                    existingWindow.end())) {
                return existing;
            }
        }

        return null;
    }

    private boolean rangesOverlap(
            LocalDateTime startA,
            LocalDateTime endA,
            LocalDateTime startB,
            LocalDateTime endB) {

        /*
         * Intervals are treated as:
         *
         * [start, end)
         *
         * Therefore:
         *
         * Booking A: 10:00 - 12:00
         * Booking B: 12:00 - 14:00
         *
         * does NOT conflict.
         */
        return startA.isBefore(endB)
                && endA.isAfter(startB);
    }

    // ---------------------------------------------------------
    // EXISTING / LEGACY BOOKING WINDOW
    // ---------------------------------------------------------

    private RentalWindow getStoredBookingWindow(
            Booking booking) {

        /*
         * New bookings already store exact
         * backend-generated timestamps.
         */
        if (booking.getStartDateTime() != null
                && booking.getEndDateTime() != null) {

            return new RentalWindow(
                    normalizeRentalType(
                            booking.getRentalType()),
                    booking.getStartDateTime()
                            .toLocalDate(),
                    booking.getPickupTime(),
                    booking.getDurationDays(),
                    booking.getDurationHours(),
                    booking.getStartDateTime(),
                    booking.getEndDateTime());
        }

        /*
         * Legacy booking fallback.
         */
        if (booking.getDate() == null
                || booking.getDate()
                        .isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Existing booking does not contain a valid rental date");
        }

        LocalDate date;

        try {

            date =
                    LocalDate.parse(
                            booking.getDate());

        } catch (DateTimeParseException ex) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Existing booking contains an invalid rental date");
        }

        String rentalType =
                normalizeRentalType(
                        booking.getRentalType());

        if ("HOURLY".equals(
                rentalType)) {

            if (booking.getPickupTime() == null
                    || booking.getDurationHours() == null) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Existing hourly booking is incomplete");
            }

            LocalTime time;

            try {

                time =
                        LocalTime.parse(
                                booking.getPickupTime(),
                                TIME_FORMAT);

            } catch (DateTimeParseException ex) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Existing hourly booking contains invalid pickup time");
            }

            LocalDateTime start =
                    LocalDateTime.of(
                            date,
                            time);

            LocalDateTime end =
                    start.plusHours(
                            booking.getDurationHours());

            return new RentalWindow(
                    "HOURLY",
                    date,
                    time.format(
                            TIME_FORMAT),
                    null,
                    booking.getDurationHours(),
                    start,
                    end);
        }

        /*
         * Old bookings had only:
         *
         * date + durationDays
         *
         * so treat them as DAILY.
         */
        int days =
                booking.getDurationDays() == null
                        || booking.getDurationDays() < 1
                                ? 1
                                : booking.getDurationDays();

        LocalDateTime start =
                date.atStartOfDay();

        LocalDateTime end =
                start.plusDays(days);

        return new RentalWindow(
                "DAILY",
                date,
                null,
                days,
                null,
                start,
                end);
    }

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------

    private String normalizeRentalType(
            String rentalType) {

        /*
         * Compatibility with the currently deployed
         * frontend before hourly UI is added.
         */
        if (rentalType == null
                || rentalType.isBlank()) {

            return "DAILY";
        }

        String normalized =
                rentalType
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (!"DAILY".equals(normalized)
                && !"HOURLY".equals(normalized)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "rentalType must be DAILY or HOURLY");
        }

        return normalized;
    }

    private LocalDateTime latestOf(
            LocalDateTime first,
            LocalDateTime second,
            LocalDateTime third) {

        LocalDateTime latest =
                first.isAfter(second)
                        ? first
                        : second;

        return latest.isAfter(third)
                ? latest
                : third;
    }

    private double roundMoney(
            double value) {

        return Math.round(
                value * 100.0)
                / 100.0;
    }

    /*
     * Internal backend representation.
     */
    private record RentalWindow(
            String rentalType,
            LocalDate date,
            String pickupTime,
            Integer durationDays,
            Integer durationHours,
            LocalDateTime start,
            LocalDateTime end) {
    }
}
