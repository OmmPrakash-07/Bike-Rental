package bikerental.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.dto.UserProfile;
import bikerental.model.UserAccount;
import bikerental.service.UserAccountService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserAccountService userService;

    public UserController(UserAccountService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserProfile me(@AuthenticationPrincipal Jwt jwt) {
        UserAccount user = userService.getRequiredUser(Long.valueOf(jwt.getSubject()));
        return userService.toProfile(user);
    }
}
