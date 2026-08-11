package bikerental.config;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import jakarta.servlet.DispatcherType;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecretKey jwtSecretKey(
            @Value("${app.jwt.secret:}") String secret) {

        if (secret == null ||
                secret.getBytes(StandardCharsets.UTF_8).length < 32) {

            throw new IllegalStateException(
                    "JWT_SECRET must be configured and contain at least 32 bytes for HS256");
        }

        return new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey secretKey) {
        return NimbusJwtEncoder
                .withSecretKey(secretKey)
                .algorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey secretKey) {
        return NimbusJwtDecoder
                .withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http
                .csrf(csrf -> csrf.disable())

                .cors(Customizer.withDefaults())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS))

                .authorizeHttpRequests(auth -> auth

                        // Allow Spring error responses without requiring JWT
                        .dispatcherTypeMatchers(
                                DispatcherType.ERROR)
                        .permitAll()

                        .requestMatchers("/error")
                        .permitAll()

                        // CORS preflight
                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**")
                        .permitAll()

                        // Public endpoints
                        .requestMatchers(
                                "/api/health",
                                "/api/auth/login",
                                "/api/user-auth/**",
                                "/uploads/**")
                        .permitAll()

                        // Public bike browsing
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/bikes",
                                "/api/bikes/**")
                        .permitAll()

                        // User protected routes
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/users/me")
                        .hasAuthority("SCOPE_user")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/bookings")
                        .hasAuthority("SCOPE_user")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/bookings/my")
                        .hasAuthority("SCOPE_user")

                        // Admin protected booking routes
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/bookings")
                        .hasAuthority("SCOPE_admin")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/bookings/*/approve",
                                "/api/bookings/*/reject")
                        .hasAuthority("SCOPE_admin")

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/bookings/clear")
                        .hasAuthority("SCOPE_admin")

                        // Single booking:
                        // actual ownership validation is also performed
                        // inside the booking backend logic.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/bookings/*")
                        .authenticated()

                        // Admin bike management
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/bikes",
                                "/api/bikes/upload")
                        .hasAuthority("SCOPE_admin")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/bikes/**")
                        .hasAuthority("SCOPE_admin")

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/bikes/**")
                        .hasAuthority("SCOPE_admin")

                        // Everything else requires authentication
                        .anyRequest()
                        .authenticated()
                )

                .oauth2ResourceServer(
                        oauth2 ->
                                oauth2.jwt(
                                        Customizer.withDefaults()));

        return http.build();
    }
}