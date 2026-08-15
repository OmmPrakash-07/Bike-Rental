package bikerental.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class Bike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    // Bike / Scooty / Bullet etc.
    private String type;

    // PETROL / ELECTRIC
    // Nullable for existing database rows until the admin edits them.
    private String fuelType;

    // Model year is required for new/edited vehicles so AI lookup can target
    // the exact model-year instead of mixing specifications across variants.
    private Integer modelYear;

    // Daily rental price
    private double pricePerDay;

    // Hourly rental price.
    // Nullable so existing bikes in database do not break.
    private Double pricePerHour;

    /*
     * This represents whether the bike is operationally available.
     * Booking time-slot conflicts are handled separately.
     */
    private boolean available;

    private String imageUrl;

    // ---------------------------------------------------------
    // AI-ASSISTED TECHNICAL SPECIFICATIONS
    // All fields are nullable. If Gemini cannot verify a value, the admin
    // preview leaves it blank and the customer page simply hides that row.
    // ---------------------------------------------------------

    private Integer displacementCc;

    @Column(length = 180)
    private String engineType;

    @Column(length = 120)
    private String maxPower;

    @Column(length = 120)
    private String maxTorque;

    @Column(length = 120)
    private String transmission;

    private Integer topSpeedKmph;

    private Double mileageKmpl;

    private Double fuelTankLitres;

    private Double batteryCapacityKwh;

    private Integer claimedRangeKm;

    @Column(length = 120)
    private String chargingTime;

    @Column(length = 120)
    private String motorPower;

    @Column(length = 180)
    private String frontBrake;

    @Column(length = 180)
    private String rearBrake;

    @Column(length = 180)
    private String absType;

    @Column(length = 180)
    private String frontTyre;

    @Column(length = 180)
    private String rearTyre;

    @Column(length = 120)
    private String wheelType;

    @Column(length = 180)
    private String frontSuspension;

    @Column(length = 180)
    private String rearSuspension;

    private Double kerbWeightKg;

    private Integer seatHeightMm;

    private Integer groundClearanceMm;

    private Integer cylinders;

    @Column(length = 120)
    private String coolingSystem;

    @Column(length = 160)
    private String clutchType;

    @Column(length = 120)
    private String startingType;

    // Timestamp only records when the reviewed AI values were saved.
    private LocalDateTime specificationsGeneratedAt;

    @Column(length = 80)
    private String specificationsModel;
}
