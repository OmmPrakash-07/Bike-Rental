package bikerental.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import bikerental.model.Booking;

public interface BookingRepository
        extends JpaRepository<Booking, Long> {

    boolean existsByBikeIdAndStatusIn(
            Long bikeId,
            Collection<String> statuses);

    boolean existsByBikeNameIgnoreCaseAndStatusIn(
            String bikeName,
            Collection<String> statuses);

    List<Booking> findByBikeIdAndStatusIn(
            Long bikeId,
            Collection<String> statuses);

    List<Booking> findByBikeNameIgnoreCaseAndStatusIn(
            String bikeName,
            Collection<String> statuses);

    Optional<Booking> findFirstByBikeIdAndStatusOrderByIdDesc(
            Long bikeId,
            String status);

    List<Booking> findByUserIdOrderByIdDesc(
            Long userId);

    long countByUserId(Long userId);
}
