package bikerental.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.cors.allowed-origins:*}")
    private String allowedOrigins;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadPath.toUri().toString());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String configuredOrigins =
                allowedOrigins == null
                        ? "*"
                        : allowedOrigins;

        List<String> parsedOrigins =
                new ArrayList<>();

        for (String origin :
                configuredOrigins.split(",")) {

            String trimmedOrigin =
                    origin.trim();

            if (!trimmedOrigin.isBlank()) {
                parsedOrigins.add(
                        trimmedOrigin);
            }
        }

        String[] origins =
                parsedOrigins.toArray(
                        new String[0]);

        registry.addMapping("/api/**")
                .allowedOrigins(origins.length == 0 ? new String[]{"*"} : origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
