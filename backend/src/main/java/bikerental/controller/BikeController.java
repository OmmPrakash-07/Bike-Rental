package bikerental.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import bikerental.model.Bike;
import bikerental.service.BikeService;

@RestController
@RequestMapping("/api/bikes")
public class BikeController {

    private final BikeService service;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public BikeController(BikeService service) {
        this.service = service;
    }

    @GetMapping
    public List<Bike> getBikes() {
        return service.getAllBikes();
    }

    @GetMapping("/{id}")
    public Bike getBike(@PathVariable Long id) {
        return service.getBikeById(id);
    }

    @PostMapping
    public Bike addBike(@RequestBody Bike bike) {
        return service.addBike(bike);
    }

    @DeleteMapping("/{id}")
    public void deleteBike(@PathVariable Long id) {
        service.deleteBike(id);
    }

    @PutMapping("/{id}")
    public Bike updateBike(@PathVariable Long id, @RequestBody Bike bike) {
        return service.updateBike(id, bike);
    }

    @PostMapping("/upload")
    public String uploadImage(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only image uploads are allowed");
        }
        if (file.getSize() > 5L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be 5 MB or smaller");
        }

        String originalName = file.getOriginalFilename() == null ? "image" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String fileName = UUID.randomUUID() + "_" + safeName;

        try {
            Path directory = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(directory);
            Path target = directory.resolve(fileName).normalize();

            if (!target.startsWith(directory)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
            }

            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return fileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not save image", ex);
        }
    }

    @PutMapping("/{id}/available")
    public Bike makeAvailable(@PathVariable Long id) {
        return service.makeAvailable(id);
    }

    @PutMapping("/{id}/unavailable")
    public Bike makeUnavailable(@PathVariable Long id) {
        return service.makeUnavailable(id);
    }
}
