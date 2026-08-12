package bikerental.model;

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

    // Daily rental price
    private double pricePerDay;

    // Hourly rental price.
    // Nullable so existing bikes in database do not break.
    private Double pricePerHour;

    /*
     * This will represent whether the bike is operationally available.
     * Booking time-slot conflicts will be handled separately.
     */
    private boolean available;

    private String imageUrl;
}