package bikerental.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import bikerental.model.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByPhone(String phone);
}
