package bikerental.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.dto.AiSpecificationRequest;
import bikerental.dto.AiSpecificationResponse;
import bikerental.service.GeminiVehicleSpecificationService;

@RestController
@RequestMapping("/api/admin/bikes")
public class AdminBikeSpecificationController {

    private final GeminiVehicleSpecificationService service;

    public AdminBikeSpecificationController(
            GeminiVehicleSpecificationService service) {

        this.service =
                service;
    }

    @PostMapping("/specifications/generate")
    public AiSpecificationResponse generateSpecifications(
            @RequestBody AiSpecificationRequest request) {

        return service.generate(
                request);
    }
}
