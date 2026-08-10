// Change only this value when your backend is deployed.
// Example: https://your-backend.up.railway.app
window.BIKE_RENTAL_CONFIG = {
    API_BASE_URL: localStorage.getItem("bikeRentalApiBaseUrl") || "http://localhost:8080"
};
