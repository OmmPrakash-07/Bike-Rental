package bikerental.repository;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import bikerental.model.Bike;

public interface BikeRepository extends JpaRepository<Bike, Long> {
    List<Bike> findByNameIgnoreCase(String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Bike b where b.id = :id")
    Optional<Bike> findByIdForUpdate(@Param("id") Long id);
}
