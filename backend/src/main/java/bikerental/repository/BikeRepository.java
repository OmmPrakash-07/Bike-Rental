package bikerental.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import bikerental.model.Bike;

public interface BikeRepository extends JpaRepository<Bike, Long> {
    Optional<Bike> findFirstByNameIgnoreCase(String name);
}
