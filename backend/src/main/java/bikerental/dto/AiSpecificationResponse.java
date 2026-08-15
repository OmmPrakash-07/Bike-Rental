package bikerental.dto;

import java.util.List;

public record AiSpecificationResponse(
        String vehicleName,
        Integer modelYear,
        String modelUsed,
        boolean grounded,
        VehicleSpecifications specifications,
        List<SpecificationSource> sources,
        String notice) {
}
