const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const USER_API = `${API_BASE}/api/users`;
const USER_TOKEN_KEY = "bikeRentalUserToken";
const USER_PROFILE_KEY = "bikeRentalUserProfile";

let detailBike = null;
let detailUser = null;

function detailEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function detailImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE}/${String(imageUrl).replace(/^\//, "")}`;
}

function detailCategory(bike) {
  const type = String(bike?.type || "").trim().toLowerCase();

  if (type.includes("scoot")) return "Scooty";
  if (
    type.includes("bike") ||
    type.includes("bullet") ||
    type.includes("motorcycle") ||
    type.includes("motorbike")
  ) return "Bike";

  return String(bike?.type || "Vehicle");
}

function detailFuel(bike) {
  const fuel = String(bike?.fuelType || "").trim().toUpperCase();

  if (fuel === "ELECTRIC") return "Electric";
  if (fuel === "PETROL") return "Petrol";
  return "Not set";
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "—";
  return `₹${Math.round(number).toLocaleString("en-IN")}`;
}

function detailToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

function detailUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY) || "";
}

function detailClearSession() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  detailUser = null;
}

function detailInitials(fullName) {
  const names = String(fullName || "User").trim().split(/\s+/).filter(Boolean);
  if (!names.length) return "U";
  if (names.length === 1) return names[0][0].toUpperCase();
  return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
}

function updateDetailAccountUi() {
  const accountLink = document.getElementById("accountLink");
  const userMenu = document.getElementById("userMenu");
  const userMenuName = document.getElementById("userMenuName");
  const userAvatar = document.getElementById("userAvatar");

  const mobileUserSummary = document.getElementById("mobileUserSummary");
  const mobileUserName = document.getElementById("mobileUserName");
  const mobileUserAvatar = document.getElementById("mobileUserAvatar");
  const mobileAccountLink = document.getElementById("mobileAccountLink");
  const mobileProfileLink = document.getElementById("mobileProfileLink");
  const mobileLogoutButton = document.getElementById("mobileLogoutButton");

  if (detailUser) {
    const fullName = detailUser.fullName?.trim() || "User";
    const firstName = fullName.split(/\s+/)[0] || "User";
    const initials = detailInitials(fullName);

    accountLink.hidden = true;
    userMenu.hidden = false;
    userMenuName.textContent = firstName;
    userAvatar.textContent = initials;

    mobileUserSummary.hidden = false;
    mobileUserName.textContent = firstName;
    mobileUserAvatar.textContent = initials;
    mobileAccountLink.hidden = true;
    mobileProfileLink.hidden = false;
    mobileLogoutButton.hidden = false;
  } else {
    accountLink.hidden = false;
    userMenu.hidden = true;

    mobileUserSummary.hidden = true;
    mobileAccountLink.hidden = false;
    mobileProfileLink.hidden = true;
    mobileLogoutButton.hidden = true;
  }
}

async function restoreDetailSession() {
  const token = detailUserToken();

  if (!token) {
    updateDetailAccountUi();
    return;
  }

  try {
    const response = await fetch(`${USER_API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) throw new Error("Session expired");

    detailUser = await response.json();
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(detailUser));
  } catch {
    detailClearSession();
  }

  updateDetailAccountUi();
}

function openDetailMobileMenu() {
  document.getElementById("mobileMenu")?.classList.add("open");
  document.getElementById("mobileMenuOverlay")?.classList.add("open");
  document.getElementById("mobileMenu")?.setAttribute("aria-hidden", "false");
  document.getElementById("mobileMenuButton")?.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeDetailMobileMenu() {
  document.getElementById("mobileMenu")?.classList.remove("open");
  document.getElementById("mobileMenuOverlay")?.classList.remove("open");
  document.getElementById("mobileMenu")?.setAttribute("aria-hidden", "true");
  document.getElementById("mobileMenuButton")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function toggleDetailUserMenu() {
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (!dropdown || !button) return;

  const open = dropdown.hidden;
  dropdown.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function closeDetailUserMenu() {
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (dropdown) dropdown.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
}

function logoutDetailUser() {
  detailClearSession();
  updateDetailAccountUi();
  closeDetailUserMenu();
  detailToast("You have been logged out.", "info");
}

function detailBikeId() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function fetchDetailBike(id) {
  try {
    const direct = await fetch(`${BIKE_API}/${id}`, { cache: "no-store" });

    if (direct.ok) {
      return await direct.json();
    }
  } catch {
    // Fall through to list lookup.
  }

  const listResponse = await fetch(BIKE_API, { cache: "no-store" });

  if (!listResponse.ok) {
    throw new Error(`Vehicle API returned ${listResponse.status}`);
  }

  const list = await listResponse.json();
  const items = Array.isArray(list) ? list : [];
  const found = items.find((bike) => Number(bike.id) === id);

  if (!found) {
    throw new Error("Vehicle not found");
  }

  return found;
}

function renderDetailBike(bike) {
  detailBike = bike;

  const category = detailCategory(bike);
  const fuel = detailFuel(bike);

  const image = document.getElementById("vehicleDetailImage");
  const fallback = document.getElementById("vehicleDetailImageFallback");

  const imageUrl = detailImageSrc(bike.imageUrl);

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `${bike.name} ${category}`;
    image.hidden = false;
    fallback.hidden = true;

    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
  } else {
    image.hidden = true;
    fallback.hidden = false;
  }

  const titleElement = document.getElementById("vehicleDetailName");
  const vehicleName = String(bike.name || "Vehicle").trim();

  titleElement.textContent = vehicleName;
  titleElement.classList.remove(
    "vehicle-title-long",
    "vehicle-title-very-long"
  );

  if (vehicleName.length > 28) {
    titleElement.classList.add("vehicle-title-very-long");
  } else if (vehicleName.length > 18) {
    titleElement.classList.add("vehicle-title-long");
  }

  document.title = `${vehicleName} | BikeRental`;

  const typePill = document.getElementById("vehicleTypePill");
  typePill.textContent = category;

  const fuelPill = document.getElementById("vehicleFuelPill");
  fuelPill.textContent = `${fuel === "Electric" ? "⚡" : fuel === "Petrol" ? "⛽" : "•"} ${fuel}`;
  fuelPill.classList.remove("fuel-petrol", "fuel-electric");
  if (fuel === "Petrol") fuelPill.classList.add("fuel-petrol");
  if (fuel === "Electric") fuelPill.classList.add("fuel-electric");

  document.getElementById("vehicleTypeText").textContent = category;
  document.getElementById("vehicleFuelText").textContent = fuel;

  const hourly = Number(bike.pricePerHour);
  const daily = Number(bike.pricePerDay);

  document.getElementById("vehicleHourlyPrice").textContent =
    Number.isFinite(hourly) && hourly > 0 ? `${money(hourly)} / hour` : "Not configured";

  document.getElementById("vehicleDailyPrice").textContent =
    Number.isFinite(daily) && daily >= 0 ? `${money(daily)} / day` : "—";

  const hourlyCard = document.getElementById("hourlyPriceCard");
  hourlyCard.classList.toggle("is-muted", !(Number.isFinite(hourly) && hourly > 0));

  const availabilityBadge = document.getElementById("vehicleAvailabilityBadge");
  const availabilityText = document.getElementById("vehicleAvailabilityText");
  const bookButton = document.getElementById("vehicleBookButton");
  const unavailableNote = document.getElementById("vehicleDetailUnavailableNote");

  if (bike.available) {
    availabilityBadge.textContent = "Available";
    availabilityBadge.className = "vehicle-detail-availability is-available";
    availabilityText.textContent = "Available now";
    bookButton.disabled = false;
    bookButton.textContent = "Book This Vehicle";
    unavailableNote.hidden = true;
  } else {
    availabilityBadge.textContent = "Unavailable";
    availabilityBadge.className = "vehicle-detail-availability is-unavailable";
    availabilityText.textContent = "Currently unavailable";
    bookButton.disabled = true;
    bookButton.textContent = "Currently Unavailable";
    unavailableNote.hidden = false;
  }

  document.getElementById("vehicleDetailLoading").hidden = true;
  document.getElementById("vehicleDetailError").hidden = true;
  document.getElementById("vehicleDetailContent").hidden = false;
}

function showDetailError(message) {
  document.getElementById("vehicleDetailLoading").hidden = true;
  document.getElementById("vehicleDetailContent").hidden = true;
  document.getElementById("vehicleDetailError").hidden = false;
  document.getElementById("vehicleDetailErrorText").textContent = message;
}

function bookDetailBike() {
  if (!detailBike || !detailBike.available) return;

  window.location.href = `vehicles.html?book=${encodeURIComponent(detailBike.id)}#vehicles`;
}

async function initVehicleDetails() {
  const id = detailBikeId();

  if (!id) {
    showDetailError("The vehicle link is missing a valid vehicle ID.");
    return;
  }

  try {
    const bike = await fetchDetailBike(id);
    renderDetailBike(bike);
  } catch (error) {
    showDetailError(error.message || "Please go back and try another vehicle.");
  }
}

document.getElementById("mobileMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const drawer = document.getElementById("mobileMenu");
  if (drawer?.classList.contains("open")) closeDetailMobileMenu();
  else openDetailMobileMenu();
});

document.getElementById("mobileMenuClose")?.addEventListener("click", closeDetailMobileMenu);
document.getElementById("mobileMenuOverlay")?.addEventListener("click", closeDetailMobileMenu);

document.getElementById("userMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDetailUserMenu();
});

document.getElementById("logoutButton")?.addEventListener("click", logoutDetailUser);
document.getElementById("mobileLogoutButton")?.addEventListener("click", logoutDetailUser);
document.getElementById("vehicleBookButton")?.addEventListener("click", bookDetailBike);

document.addEventListener("click", closeDetailUserMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetailUserMenu();
    closeDetailMobileMenu();
  }
});

Promise.all([
  initVehicleDetails(),
  restoreDetailSession()
]);
