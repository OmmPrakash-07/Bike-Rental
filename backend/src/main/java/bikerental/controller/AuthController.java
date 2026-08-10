package bikerental.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bikerental.model.Admin;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:1234}")
    private String adminPassword;

    @PostMapping("/login")
    public String login(@RequestBody Admin admin) {
        if (admin != null
                && adminUsername.equals(admin.getUsername())
                && adminPassword.equals(admin.getPassword())) {
            return "SUCCESS";
        }
        return "FAIL";
    }
}
