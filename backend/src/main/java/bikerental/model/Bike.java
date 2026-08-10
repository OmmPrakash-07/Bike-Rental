package bikerental.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
public class Bike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type; // Bike / Scooty
    private double pricePerDay;
    private boolean available;
    private String imageUrl;
}