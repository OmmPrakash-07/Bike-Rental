// Backend API configuration

window.BIKE_RENTAL_CONFIG = {
  API_BASE_URL:
    localStorage.getItem("bikeRentalApiBaseUrl") ||
    "https://bike-rental-production-6e17.up.railway.app"
};