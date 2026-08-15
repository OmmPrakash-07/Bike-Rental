package bikerental.dto;

public record AiSpecificationRequest(
        String name,
        Integer modelYear,
        String type,
        String fuelType) {
}
