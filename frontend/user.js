const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const BOOKING_API = `${API_BASE}/api/bookings`;
const USER_API = `${API_BASE}/api/users`;
const USER_TOKEN_KEY = "bikeRentalUserToken";
const USER_PROFILE_KEY = "bikeRentalUserProfile";

let bikes = [];
let selectedBike = null;
let currentUser = null;
let lastFocusedElement = null;
let bikeAvailability = null;
let dailyAvailability = null;
let selectedTimePeriod = "AM";
let availabilityRequestSequence = 0;
let dailyAvailabilityRequestSequence = 0;

// Premium circular pickup-date wheel state.
let dateWheelFocusDate = null;
let dateWheelCommittedDate = "";
let dateWheelTouchStart = null;
let dateWheelScrollLock = false;
const DATE_WHEEL_MAX_DAYS_AHEAD = 90;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${API_BASE}/${imageUrl.replace(/^\//, "")}`;
}

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

function userToken() {
  return localStorage.getItem(USER_TOKEN_KEY) || "";
}

function saveUserSession(auth) {
  localStorage.setItem(USER_TOKEN_KEY, auth.token);
  if (auth.user)
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(auth.user));
}

function clearUserSession() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  currentUser = null;
}

async function authFetch(url, options = {}) {
  const token = userToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && token) {
    clearUserSession();
    updateAccountUi();
  }
  return response;
}

async function errorMessage(res) {
  try {
    const data = await res.json();
    return data.message || data.error || `Request failed (${res.status})`;
  } catch {
    try {
      const text = await res.text();
      return text || `Request failed (${res.status})`;
    } catch {
      return `Request failed (${res.status})`;
    }
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function setButtonLoading(button, loading, loadingText, normalText) {
  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
  button.classList.toggle("is-loading", loading);
}

function updateAccountUi() {
  const accountLink = document.getElementById("accountLink");
  const myBookingsLink = document.getElementById("myBookingsLink");
  const userMenu = document.getElementById("userMenu");
  const userAvatar = document.getElementById("userAvatar");
  const userMenuName = document.getElementById("userMenuName");

  const authNotice = document.getElementById("myBookingsAuthNotice");
  const bookingsContent = document.getElementById("myBookingsContent");

  const mobileUserSummary = document.getElementById("mobileUserSummary");
  const mobileUserAvatar = document.getElementById("mobileUserAvatar");
  const mobileUserName = document.getElementById("mobileUserName");
  const mobileAccountLink = document.getElementById("mobileAccountLink");
  const mobileProfileLink = document.getElementById("mobileProfileLink");
  const mobileLogoutButton = document.getElementById("mobileLogoutButton");

  if (currentUser) {
    accountLink.hidden = true;
    myBookingsLink.hidden = false;
    userMenu.hidden = false;

    const fullName = currentUser.fullName?.trim() || "User";
    const names = fullName.split(/\s+/);
    const firstName = names[0] || "User";

    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`
        : firstName[0];

    userMenuName.textContent = firstName;
    userAvatar.textContent = initials.toUpperCase();

    if (mobileUserSummary) mobileUserSummary.hidden = false;
    if (mobileUserName) mobileUserName.textContent = firstName;
    if (mobileUserAvatar) mobileUserAvatar.textContent = initials.toUpperCase();
    if (mobileAccountLink) mobileAccountLink.hidden = true;
    if (mobileProfileLink) mobileProfileLink.hidden = false;
    if (mobileLogoutButton) mobileLogoutButton.hidden = false;

    authNotice.hidden = true;
    bookingsContent.hidden = false;
  } else {
    accountLink.hidden = false;
    accountLink.textContent = "Login / Sign Up";

    myBookingsLink.hidden = true;
    userMenu.hidden = true;

    if (mobileUserSummary) mobileUserSummary.hidden = true;
    if (mobileAccountLink) mobileAccountLink.hidden = false;
    if (mobileProfileLink) mobileProfileLink.hidden = true;
    if (mobileLogoutButton) mobileLogoutButton.hidden = true;

    closeUserMenu();

    authNotice.hidden = false;
    bookingsContent.hidden = true;
  }
}

function toggleUserMenu(event) {
  event.stopPropagation();

  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");

  const willOpen = dropdown.hidden;

  dropdown.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function closeUserMenu() {
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");

  if (dropdown) {
    dropdown.hidden = true;
  }

  if (button) {
    button.setAttribute("aria-expanded", "false");
  }
}

function openMobileMenu() {
  const drawer = document.getElementById("mobileMenu");
  const overlay = document.getElementById("mobileMenuOverlay");
  const button = document.getElementById("mobileMenuButton");

  if (!drawer || !overlay || !button) return;

  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  button.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeMobileMenu() {
  const drawer = document.getElementById("mobileMenu");
  const overlay = document.getElementById("mobileMenuOverlay");
  const button = document.getElementById("mobileMenuButton");

  if (!drawer || !overlay || !button) return;

  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  button.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function toggleMobileMenu(event) {
  event?.stopPropagation();
  const drawer = document.getElementById("mobileMenu");
  if (!drawer) return;

  if (drawer.classList.contains("open")) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

document.addEventListener("click", closeUserMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeUserMenu();
    closeMobileMenu();
    closeMobileFleetSheets();
  }
});

async function restoreUserSession() {
  const token = userToken();
  if (!token) {
    updateAccountUi();
    return;
  }

  try {
    const res = await authFetch(`${USER_API}/me`, { cache: "no-store" });
    if (!res.ok) throw new Error(await errorMessage(res));
    currentUser = await res.json();
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(currentUser));
    updateAccountUi();
    await loadMyBookings();
  } catch (error) {
    console.warn("User session could not be restored:", error.message);
    clearUserSession();
    updateAccountUi();
  }
}

function requireUser(returnTarget = "vehicles.html#vehicles") {
  if (currentUser && userToken()) return true;
  localStorage.setItem("bikeRentalReturnTo", returnTarget);
  window.location.href = "account.html?mode=login";
  return false;
}

function logoutUser() {
  clearUserSession();
  updateAccountUi();
  document.getElementById("myBookingsList").innerHTML = "";
  showToast("You have been logged out.", "info");
}

let vehicleCategoryFilter = "ALL";
let vehicleFuelFilter = "ALL";
let vehicleSearchQuery = "";
let vehicleSortMode = "DEFAULT";

function normalizedVehicleCategory(bike) {
  const type = String(bike?.type || "").trim().toLowerCase();
  if (type.includes("scoot") || type.includes("scooty") || type.includes("scooter")) return "SCOOTY";
  if (type.includes("bike") || type.includes("bullet") || type.includes("motorcycle") || type.includes("motorbike")) return "BIKE";
  return "OTHER";
}

function normalizedFuelType(bike) {
  const fuel = String(bike?.fuelType || "").trim().toUpperCase();
  if (fuel === "PETROL") return "PETROL";
  if (fuel === "ELECTRIC") return "ELECTRIC";
  return "UNSET";
}

function normalizedSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function vehicleMatchesSearch(bike) {
  const query = normalizedSearchText(vehicleSearchQuery);
  if (!query) return true;

  const category = normalizedVehicleCategory(bike);
  const fuel = normalizedFuelType(bike);

  const searchable = normalizedSearchText([
    bike?.name,
    bike?.type,
    category === "BIKE" ? "bike motorcycle bullet" : "",
    category === "SCOOTY" ? "scooty scooter" : "",
    fuel === "PETROL" ? "petrol fuel" : "",
    fuel === "ELECTRIC" ? "electric ev" : ""
  ].filter(Boolean).join(" "));

  return query
    .split(" ")
    .filter(Boolean)
    .every((term) => searchable.includes(term));
}

function filteredVehicles() {
  return bikes.filter((bike) => {
    const categoryMatches =
      vehicleCategoryFilter === "ALL" ||
      normalizedVehicleCategory(bike) === vehicleCategoryFilter;

    const fuelMatches =
      vehicleFuelFilter === "ALL" ||
      normalizedFuelType(bike) === vehicleFuelFilter;

    return categoryMatches && fuelMatches && vehicleMatchesSearch(bike);
  });
}

function safeSortNumber(value, fallback = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function sortedVehicles(items = filteredVehicles()) {
  const list = [...items];

  switch (vehicleSortMode) {
    case "PRICE_DAY_ASC":
      return list.sort((a, b) =>
        safeSortNumber(a.pricePerDay) - safeSortNumber(b.pricePerDay)
      );

    case "PRICE_DAY_DESC":
      return list.sort((a, b) =>
        safeSortNumber(b.pricePerDay, -1) - safeSortNumber(a.pricePerDay, -1)
      );

    case "PRICE_HOUR_ASC":
      return list.sort((a, b) =>
        safeSortNumber(a.pricePerHour) - safeSortNumber(b.pricePerHour)
      );

    case "PRICE_HOUR_DESC":
      return list.sort((a, b) =>
        safeSortNumber(b.pricePerHour, -1) - safeSortNumber(a.pricePerHour, -1)
      );

    case "NAME_ASC":
      return list.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
          sensitivity: "base"
        })
      );

    case "AVAILABLE_FIRST":
      return list.sort((a, b) => {
        const availabilityDifference = Number(Boolean(b.available)) - Number(Boolean(a.available));
        if (availabilityDifference !== 0) return availabilityDifference;
        return Number(a?.id || 0) - Number(b?.id || 0);
      });

    default:
      return list;
  }
}

function setCountText(id, value, singular, plural = `${singular}s`) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = `${value} ${value === 1 ? singular : plural}`;
}

function updateVehicleFilterCounts() {
  const bikeCount = bikes.filter((bike) => normalizedVehicleCategory(bike) === "BIKE").length;
  const scootyCount = bikes.filter((bike) => normalizedVehicleCategory(bike) === "SCOOTY").length;
  const petrolCount = bikes.filter((bike) => normalizedFuelType(bike) === "PETROL").length;
  const electricCount = bikes.filter((bike) => normalizedFuelType(bike) === "ELECTRIC").length;

  setCountText("allVehicleCount", bikes.length, "ride");
  setCountText("bikeVehicleCount", bikeCount, "bike");
  setCountText("scootyVehicleCount", scootyCount, "scooty", "scooties");
  setCountText("allFuelCount", bikes.length, "ride");
  setCountText("petrolVehicleCount", petrolCount, "ride");
  setCountText("electricVehicleCount", electricCount, "ride");
}

function updateVehicleFilterUi() {
  document.querySelectorAll("[data-category-filter]").forEach((button) => {
    const active = button.dataset.categoryFilter === vehicleCategoryFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-fuel-filter]").forEach((button) => {
    const active = button.dataset.fuelFilter === vehicleFuelFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const clearButton = document.getElementById("clearVehicleFiltersButton");
  if (clearButton) clearButton.hidden = vehicleCategoryFilter === "ALL" && vehicleFuelFilter === "ALL";

  const result = document.getElementById("vehicleFilterResult");
  if (result) {
    const categoryLabel =
      vehicleCategoryFilter === "BIKE"
        ? "bikes"
        : vehicleCategoryFilter === "SCOOTY"
          ? "scooties"
          : "vehicles";

    const fuelLabel =
      vehicleFuelFilter === "PETROL"
        ? "Petrol "
        : vehicleFuelFilter === "ELECTRIC"
          ? "Electric "
          : "";

    const searchLabel = normalizedSearchText(vehicleSearchQuery)
      ? ` matching “${escapeHtml(vehicleSearchQuery.trim())}”`
      : "";

    result.innerHTML =
      `<strong>${filteredVehicles().length}</strong> ${fuelLabel}${categoryLabel}${searchLabel} found`;
  }

  document.querySelectorAll("[data-mobile-category-filter]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.mobileCategoryFilter === vehicleCategoryFilter
    );
  });

  document.querySelectorAll("[data-mobile-fuel-filter]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.mobileFuelFilter === vehicleFuelFilter
    );
  });

  updateVehicleDiscoveryUi();
}

function setVehicleCategoryFilter(value) {
  vehicleCategoryFilter = ["ALL", "BIKE", "SCOOTY"].includes(value) ? value : "ALL";
  renderBikes();
}

function setVehicleFuelFilter(value) {
  vehicleFuelFilter = ["ALL", "PETROL", "ELECTRIC"].includes(value) ? value : "ALL";
  renderBikes();
}

function clearVehicleFilters() {
  vehicleCategoryFilter = "ALL";
  vehicleFuelFilter = "ALL";
  renderBikes();
}

function setVehicleSearchQuery(value) {
  vehicleSearchQuery = String(value || "");
  renderBikes();
}

function clearVehicleSearch() {
  vehicleSearchQuery = "";

  const input = document.getElementById("vehicleSearchInput");
  if (input) {
    input.value = "";
    input.focus();
  }

  renderBikes();
}

function setVehicleSortMode(value) {
  const allowed = [
    "DEFAULT",
    "PRICE_DAY_ASC",
    "PRICE_DAY_DESC",
    "PRICE_HOUR_ASC",
    "PRICE_HOUR_DESC",
    "NAME_ASC",
    "AVAILABLE_FIRST"
  ];

  vehicleSortMode = allowed.includes(value) ? value : "DEFAULT";
  renderBikes();
}

function vehicleSortLabel() {
  const labels = {
    DEFAULT: "Recommended",
    PRICE_DAY_ASC: "Daily price: Low to High",
    PRICE_DAY_DESC: "Daily price: High to Low",
    PRICE_HOUR_ASC: "Hourly price: Low to High",
    PRICE_HOUR_DESC: "Hourly price: High to Low",
    NAME_ASC: "Name: A to Z",
    AVAILABLE_FIRST: "Available first"
  };

  return labels[vehicleSortMode] || labels.DEFAULT;
}

function updateVehicleDiscoveryUi() {
  const input = document.getElementById("vehicleSearchInput");
  if (input && input.value !== vehicleSearchQuery) {
    input.value = vehicleSearchQuery;
  }

  const clearSearchButton = document.getElementById("clearVehicleSearchButton");
  if (clearSearchButton) {
    clearSearchButton.hidden = !normalizedSearchText(vehicleSearchQuery);
  }

  const sortSelect = document.getElementById("vehicleSortSelect");
  if (sortSelect && sortSelect.value !== vehicleSortMode) {
    sortSelect.value = vehicleSortMode;
  }

  const summary = document.getElementById("activeDiscoverySummary");
  const summaryText = document.getElementById("activeDiscoveryText");

  if (!summary || !summaryText) return;

  const searchActive = Boolean(normalizedSearchText(vehicleSearchQuery));
  const sortActive = vehicleSortMode !== "DEFAULT";

  summary.hidden = !searchActive && !sortActive;

  if (summary.hidden) {
    summaryText.textContent = "";
    return;
  }

  const parts = [];

  if (searchActive) {
    parts.push(`Search: “${vehicleSearchQuery.trim()}”`);
  }

  if (sortActive) {
    parts.push(`Sort: ${vehicleSortLabel()}`);
  }

  summaryText.textContent = parts.join(" • ");

  updateMobileFleetToolbarUi();
}

function activeVehicleFilterCount() {
  let count = 0;
  if (vehicleCategoryFilter !== "ALL") count++;
  if (vehicleFuelFilter !== "ALL") count++;
  return count;
}

function updateMobileFleetToolbarUi() {
  const count = activeVehicleFilterCount();
  const countBadge = document.getElementById("mobileFilterCount");
  const resultCount = document.getElementById("mobileFilterResultCount");
  const sortLabel = document.getElementById("mobileSortButtonLabel");

  if (countBadge) {
    countBadge.textContent = String(count);
    countBadge.hidden = count === 0;
  }

  if (resultCount) {
    resultCount.textContent = String(filteredVehicles().length);
  }

  if (sortLabel) {
    const shortLabels = {
      DEFAULT: "Recommended",
      AVAILABLE_FIRST: "Available first",
      PRICE_DAY_ASC: "Day ₹ low → high",
      PRICE_DAY_DESC: "Day ₹ high → low",
      PRICE_HOUR_ASC: "Hour ₹ low → high",
      PRICE_HOUR_DESC: "Hour ₹ high → low",
      NAME_ASC: "Name A → Z"
    };

    sortLabel.textContent = shortLabels[vehicleSortMode] || "Recommended";
  }

  document.querySelectorAll("[data-mobile-sort]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.mobileSort === vehicleSortMode
    );
  });
}

function resetVehicleDiscovery() {
  vehicleSearchQuery = "";
  vehicleSortMode = "DEFAULT";

  const input = document.getElementById("vehicleSearchInput");
  if (input) input.value = "";

  const select = document.getElementById("vehicleSortSelect");
  if (select) select.value = "DEFAULT";

  renderBikes();
}



function mobileFleetSheetElements() {
  return {
    overlay: document.getElementById("mobileFleetSheetOverlay"),
    filterSheet: document.getElementById("mobileFilterSheet"),
    sortSheet: document.getElementById("mobileSortSheet"),
    filterButton: document.getElementById("mobileFilterButton"),
    sortButton: document.getElementById("mobileSortButton")
  };
}

function openMobileFleetSheet(type) {
  const {
    overlay,
    filterSheet,
    sortSheet,
    filterButton,
    sortButton
  } = mobileFleetSheetElements();

  if (!overlay || !filterSheet || !sortSheet) return;

  const openFilter = type === "filter";

  filterSheet.classList.toggle("is-open", openFilter);
  sortSheet.classList.toggle("is-open", !openFilter);

  filterSheet.setAttribute("aria-hidden", String(!openFilter));
  sortSheet.setAttribute("aria-hidden", String(openFilter));

  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");

  filterButton?.setAttribute("aria-expanded", String(openFilter));
  sortButton?.setAttribute("aria-expanded", String(!openFilter));

  document.body.classList.add("mobile-fleet-sheet-open");
  updateMobileFleetToolbarUi();
}

function closeMobileFleetSheets() {
  const {
    overlay,
    filterSheet,
    sortSheet,
    filterButton,
    sortButton
  } = mobileFleetSheetElements();

  filterSheet?.classList.remove("is-open");
  sortSheet?.classList.remove("is-open");
  overlay?.classList.remove("is-open");

  filterSheet?.setAttribute("aria-hidden", "true");
  sortSheet?.setAttribute("aria-hidden", "true");
  overlay?.setAttribute("aria-hidden", "true");

  filterButton?.setAttribute("aria-expanded", "false");
  sortButton?.setAttribute("aria-expanded", "false");

  document.body.classList.remove("mobile-fleet-sheet-open");
}

function chooseMobileSort(value) {
  setVehicleSortMode(value);
  closeMobileFleetSheets();
}

function resetAllVehicleDiscovery() {
  vehicleCategoryFilter = "ALL";
  vehicleFuelFilter = "ALL";
  vehicleSearchQuery = "";
  vehicleSortMode = "DEFAULT";

  const input = document.getElementById("vehicleSearchInput");
  if (input) input.value = "";

  const select = document.getElementById("vehicleSortSelect");
  if (select) select.value = "DEFAULT";

  renderBikes();
}

function renderVehicleStats(visibleBikes = filteredVehicles()) {
  const stats = document.getElementById("vehicleStats");
  if (!stats) return;
  if (!bikes.length) { stats.innerHTML = ""; return; }
  const available = visibleBikes.filter((bike) => bike.available).length;
  stats.innerHTML = `
    <div class="stat-chip"><strong>${visibleBikes.length}</strong><span>Showing</span></div>
    <div class="stat-chip available-chip"><strong>${available}</strong><span>Available</span></div>
    <div class="stat-chip"><strong>${visibleBikes.length - available}</strong><span>Unavailable</span></div>`;
}


function renderBikes() {
  const container = document.getElementById("bikeContainer");
  if (!container) return;

  updateVehicleFilterCounts();
  updateVehicleFilterUi();
  const visibleBikes = sortedVehicles(filteredVehicles());
  renderVehicleStats(visibleBikes);
  container.innerHTML = "";

  if (!bikes.length) {
    container.innerHTML = `<div class="empty-state">No vehicles have been added yet.</div>`;
    return;
  }

  if (!visibleBikes.length) {
    const categoryText = vehicleCategoryFilter === "BIKE" ? "bike" : vehicleCategoryFilter === "SCOOTY" ? "scooty" : "vehicle";
    const fuelText = vehicleFuelFilter === "PETROL" ? "petrol " : vehicleFuelFilter === "ELECTRIC" ? "electric " : "";
    container.innerHTML = `
      <div class="empty-state vehicle-filter-empty">
        <div class="filter-empty-icon">⌕</div>
        <strong>No ${escapeHtml(fuelText + categoryText)} found.</strong>
        <small>${normalizedSearchText(vehicleSearchQuery) ? "Try another search or reset your filters." : "Try another vehicle or fuel filter."}</small>
        <button class="retry-btn" type="button" onclick="resetAllVehicleDiscovery()">Show All Vehicles</button>
      </div>`;
    return;
  }

  visibleBikes.forEach((bike, index) => {
    const card = document.createElement("article");
    const category = normalizedVehicleCategory(bike);
    const fuel = normalizedFuelType(bike);
    const displayName = String(bike.name || "Vehicle").trim() || "Vehicle";

    card.className = [
      "card",
      "vehicle-card",
      bike.available ? "is-available" : "is-unavailable",
      `vehicle-card-${category.toLowerCase()}`,
      `vehicle-card-${fuel.toLowerCase()}`,
      "reveal",
      `delay-${Math.min(index + 1, 4)}`
    ].join(" ");

    const availabilityBadge = `
      <span class="vehicle-card-availability ${bike.available ? "available" : "unavailable"}">
        <span class="vehicle-card-status-dot"></span>
        ${bike.available ? "Available" : "Unavailable"}
      </span>`;

    const image = bike.imageUrl
      ? `
        <a class="vehicle-card-image-link"
           href="vehicle.html?id=${encodeURIComponent(bike.id)}"
           aria-label="View ${escapeHtml(displayName)} details">
          <div class="card-image-wrap">
            ${availabilityBadge}
            <span class="vehicle-card-image-accent" aria-hidden="true"></span>
            <img loading="lazy"
                 src="${escapeHtml(imageSrc(bike.imageUrl))}"
                 alt="${escapeHtml(displayName)}">
            <span class="vehicle-card-image-cta">View ride →</span>
          </div>
        </a>`
      : `
        <div class="card-image-wrap vehicle-card-placeholder-wrap">
          ${availabilityBadge}
          <span class="vehicle-card-image-accent" aria-hidden="true"></span>
          <div class="image-placeholder">🏍️</div>
        </div>`;

    const hourlyPrice = Number(bike.pricePerHour);
    const hourlyConfigured = Number.isFinite(hourlyPrice) && hourlyPrice > 0;
    const dailyPrice = Number(bike.pricePerDay);
    const safeDailyPrice = Number.isFinite(dailyPrice) && dailyPrice >= 0 ? dailyPrice : 0;

    const priceHtml = hourlyConfigured
      ? `
        <div class="vehicle-price-grid">
          <div class="vehicle-price-item vehicle-price-primary">
            <span class="vehicle-price-label">Hourly</span>
            <div class="vehicle-price-value"><strong>₹${hourlyPrice.toFixed(0)}</strong><span class="vehicle-price-unit">per hour</span></div>
          </div>
          <div class="vehicle-price-item">
            <span class="vehicle-price-label">Daily</span>
            <div class="vehicle-price-value"><strong>₹${safeDailyPrice.toFixed(0)}</strong><span class="vehicle-price-unit">per day</span></div>
          </div>
        </div>`
      : `
        <div class="vehicle-price-grid">
          <div class="vehicle-price-item vehicle-price-primary">
            <span class="vehicle-price-label">Daily</span>
            <div class="vehicle-price-value"><strong>₹${safeDailyPrice.toFixed(0)}</strong><span class="vehicle-price-unit">per day</span></div>
          </div>
          <div class="vehicle-price-item is-muted">
            <span class="vehicle-price-label">Hourly</span>
            <div class="vehicle-price-value"><strong>—</strong><span class="vehicle-price-unit">Not set</span></div>
          </div>
        </div>`;
    const categoryLabel = category === "SCOOTY" ? "Scooty" : category === "BIKE" ? "Bike" : String(bike.type || "Vehicle");
    const fuelLabel = fuel === "PETROL" ? "Petrol" : fuel === "ELECTRIC" ? "Electric" : "Fuel not set";
    const rawModelYear = bike.modelYear;
    const parsedModelYear = Number(rawModelYear);
    const modelYearText =
      rawModelYear !== null &&
      rawModelYear !== undefined &&
      String(rawModelYear).trim() !== "" &&
      Number.isInteger(parsedModelYear) &&
      parsedModelYear >= 1900 &&
      parsedModelYear <= 2100
        ? ` • ${escapeHtml(String(parsedModelYear))}`
        : "";

    card.innerHTML = `
      ${image}
      <div class="card-body vehicle-card-body">
        <div class="vehicle-card-topline">
          <div class="vehicle-card-meta">
            <span class="vehicle-meta-pill vehicle-type-pill">${escapeHtml(categoryLabel)}</span>
            <span class="vehicle-meta-pill fuel-${fuel.toLowerCase()}">${fuel === "ELECTRIC" ? "⚡" : fuel === "PETROL" ? "⛽" : "•"} ${escapeHtml(fuelLabel)}</span>
          </div>
          <span class="vehicle-card-id">#${escapeHtml(String(bike.id ?? ""))}</span>
        </div>

        <a class="card-name vehicle-card-name-link"
           href="vehicle.html?id=${encodeURIComponent(bike.id)}">
          ${escapeHtml(displayName)}
        </a>

        <p class="card-type vehicle-card-description">
          ${escapeHtml(String(bike.type || "Vehicle"))}${fuel !== "UNSET" ? ` • ${escapeHtml(fuelLabel)}` : ""}${modelYearText}
        </p>

        ${priceHtml}

        <div class="vehicle-card-actions">
          <a
            class="vehicle-details-btn"
            href="vehicle.html?id=${encodeURIComponent(bike.id)}"
          >
            View Details
          </a>
          <button
            class="${bike.available ? "btn-primary vehicle-card-book-btn" : "unavailable-btn vehicle-card-book-btn"}"
            ${bike.available ? `onclick="openBookingModal(${bike.id})"` : "disabled"}>
            ${bike.available ? "Book Now →" : "Unavailable"}
          </button>
        </div>
      </div>`;

    const img = card.querySelector("img");
    if (img) {
      img.addEventListener("error", () => {
        const wrap = img.closest(".card-image-wrap");
        if (wrap) wrap.innerHTML = `<div class="image-placeholder">🏍️</div>`;
      }, { once: true });
    }
    container.appendChild(card);
  });
}


let bookingQueryHandled = false;

function maybeOpenBookingFromQuery() {
  if (bookingQueryHandled) return;

  const params = new URLSearchParams(window.location.search);
  const rawBookId = params.get("book");

  if (!rawBookId) return;

  const bikeId = Number(rawBookId);
  if (!Number.isInteger(bikeId) || bikeId <= 0) return;

  const bike = bikes.find((item) => Number(item.id) === bikeId);
  if (!bike) return;

  bookingQueryHandled = true;

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("book");
  window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash || "#vehicles"}`);

  if (!bike.available) {
    showToast(`${bike.name} is currently unavailable.`, "info");
    return;
  }

  setTimeout(() => openBookingModal(bikeId), 120);
}

async function loadBikes({ quiet = false } = {}) {
  const container = document.getElementById("bikeContainer");
  if (!container) return;
  if (!quiet) container.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>`;

  try {
    const res = await fetch(BIKE_API, { cache: "no-store" });
    if (!res.ok) throw new Error(await errorMessage(res));
    bikes = await res.json();
    if (!Array.isArray(bikes)) bikes = [];
    renderBikes();
    maybeOpenBookingFromQuery();
  } catch (error) {
    console.error(error);
    const stats = document.getElementById("vehicleStats");
    if (stats) stats.innerHTML = "";
    container.innerHTML = `<div class="empty-state error-state"><strong>Could not load vehicles.</strong><small>${escapeHtml(error.message)}</small><button class="retry-btn" type="button" onclick="refreshBikes()">Try Again</button></div>`;
  }
}

async function refreshBikes() {
  const button = document.getElementById("refreshBikesButton");
  setButtonLoading(button, true, "↻ Refreshing…", "↻ Refresh");
  await loadBikes({ quiet: true });
  setButtonLoading(button, false, "↻ Refreshing…", "↻ Refresh");
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(`${inputId}Error`);
  if (input) {
    input.classList.remove("input-error");
    input.removeAttribute("aria-invalid");
  }
  if (error) error.textContent = "";
}

function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(`${inputId}Error`);
  if (input) {
    input.classList.add("input-error");
    input.setAttribute("aria-invalid", "true");
  }
  if (error) error.textContent = message;
}

function selectedRentalType() {
  return (
    document.querySelector('input[name="rentalType"]:checked')?.value || ""
  );
}

function dateWheelStartOfDay(value = new Date()) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0,
  );
}

function dateWheelAddDays(value, amount) {
  const next = dateWheelStartOfDay(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateWheelIso(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateWheelFromIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateWheelClamp(value) {
  const today = dateWheelStartOfDay();
  const max = dateWheelAddDays(today, DATE_WHEEL_MAX_DAYS_AHEAD);
  const candidate = dateWheelStartOfDay(value);

  if (candidate < today) return today;
  if (candidate > max) return max;
  return candidate;
}

function dateWheelFormatLong(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function dateWheelFormatMonthYear(value) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  })
    .format(value)
    .toUpperCase();
}

function dateWheelFormatWeekday(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
  }).format(value);
}

function dateWheelFormatShortWeekday(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
  })
    .format(value)
    .toUpperCase();
}

function dateWheelIsSameDay(a, b) {
  return Boolean(
    a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate(),
  );
}

function renderPickupDateWheel() {
  const wheel = document.getElementById("pickupDateWheel");
  const ring = document.getElementById("dateWheelRing");
  const day = document.getElementById("dateWheelDay");
  const monthYear = document.getElementById("dateWheelMonthYear");
  const weekday = document.getElementById("dateWheelWeekday");
  const formatted = document.getElementById("dateWheelFormatted");
  const state = document.getElementById("dateWheelSelectionState");

  if (!wheel || !ring || !dateWheelFocusDate) return;

  const today = dateWheelStartOfDay();
  const max = dateWheelAddDays(today, DATE_WHEEL_MAX_DAYS_AHEAD);
  const selectedIso = dateWheelCommittedDate;
  const focusIso = dateWheelIso(dateWheelFocusDate);

  day.textContent = String(dateWheelFocusDate.getDate()).padStart(2, "0");
  monthYear.textContent = dateWheelFormatMonthYear(dateWheelFocusDate);
  weekday.textContent = dateWheelFormatWeekday(dateWheelFocusDate);

  const committed = selectedIso === focusIso;
  wheel.classList.toggle("has-selection", committed);

  if (formatted) {
    formatted.textContent = committed
      ? dateWheelFormatLong(dateWheelFocusDate)
      : "Tap the highlighted date to select";
  }

  if (state) {
    state.textContent = committed ? "Selected" : "Tap to select";
    state.classList.toggle("selected", committed);
  }

  // Eight positions around the ring. The focused date sits in the
  // orange selector on the right, matching the selected mockup.
  const offsets = [-3, -2, -1, 0, 1, 2, 3, 4];
  const angles = [-45, 0, 45, 90, 135, 180, 225, 270];

  ring.innerHTML = offsets
    .map((offset, index) => {
      const itemDate = dateWheelAddDays(dateWheelFocusDate, offset);
      const itemIso = dateWheelIso(itemDate);
      const disabled = itemDate < today || itemDate > max;
      const isFocus = offset === 0;
      const isToday = dateWheelIsSameDay(itemDate, today);
      const isCommitted = itemIso === selectedIso;

      return `
        <button
          class="date-wheel-slot${isFocus ? " is-focus" : ""}${
            isToday ? " is-today" : ""
          }${isCommitted ? " is-committed" : ""}"
          type="button"
          style="--slot-angle:${angles[index]}deg"
          data-date="${itemIso}"
          ${disabled ? "disabled" : ""}
          onclick="choosePickupDateFromWheel('${itemIso}')"
          aria-label="${escapeHtml(dateWheelFormatLong(itemDate))}${
            isCommitted ? ", selected" : ""
          }"
        >
          <strong>${itemDate.getDate()}</strong>
          <span>${escapeHtml(dateWheelFormatShortWeekday(itemDate))}</span>
        </button>`;
    })
    .join("");

  document
    .querySelector(".date-wheel-prev")
    ?.toggleAttribute("disabled", dateWheelFocusDate <= today);
  document
    .querySelector(".date-wheel-next")
    ?.toggleAttribute("disabled", dateWheelFocusDate >= max);
}

function commitPickupDate(value) {
  const date = dateWheelClamp(value);
  const input = document.getElementById("pickupDate");
  if (!input) return;

  dateWheelFocusDate = date;
  dateWheelCommittedDate = dateWheelIso(date);
  input.value = dateWheelCommittedDate;

  clearFieldError("pickupDate");
  renderPickupDateWheel();
  handlePickupDateChange();
}

function choosePickupDateFromWheel(isoDate) {
  const date = dateWheelFromIso(isoDate);
  if (!date) return;
  commitPickupDate(date);
}

function spinPickupDate(direction) {
  const delta = Number(direction) < 0 ? -1 : 1;
  const base = dateWheelFocusDate || dateWheelStartOfDay();
  const next = dateWheelClamp(dateWheelAddDays(base, delta));

  if (dateWheelIsSameDay(base, next) && delta !== 0) return;

  dateWheelFocusDate = next;
  commitPickupDate(next);
}

function selectPickupDateToday() {
  commitPickupDate(dateWheelStartOfDay());
}

function initializePickupDateWheel() {
  const input = document.getElementById("pickupDate");
  const wheel = document.getElementById("pickupDateWheel");
  if (!input || !wheel) return;

  input.value = "";
  dateWheelCommittedDate = "";
  dateWheelFocusDate = dateWheelStartOfDay();
  renderPickupDateWheel();

  if (wheel.dataset.dateWheelReady === "true") return;
  wheel.dataset.dateWheelReady = "true";

  wheel.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 5 && Math.abs(event.deltaX) < 5) return;
      event.preventDefault();
      if (dateWheelScrollLock) return;

      dateWheelScrollLock = true;
      const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

      spinPickupDate(movement > 0 ? 1 : -1);
      window.setTimeout(() => {
        dateWheelScrollLock = false;
      }, 130);
    },
    { passive: false },
  );

  wheel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dateWheelTouchStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  });

  wheel.addEventListener("pointerup", (event) => {
    if (!dateWheelTouchStart || dateWheelTouchStart.id !== event.pointerId) {
      dateWheelTouchStart = null;
      return;
    }

    const dx = event.clientX - dateWheelTouchStart.x;
    const dy = event.clientY - dateWheelTouchStart.y;
    dateWheelTouchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 34) return;

    const dominant = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
    spinPickupDate(dominant < 0 ? 1 : -1);
  });

  wheel.addEventListener("pointercancel", () => {
    dateWheelTouchStart = null;
  });

  wheel.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      spinPickupDate(1);
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      spinPickupDate(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitPickupDate(dateWheelFocusDate || dateWheelStartOfDay());
    }
  });
}

function formatPickupTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return "";
  }

  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatShortDate(dateText) {
  if (!dateText) return "";

  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (!Number.isFinite(date.getTime())) return dateText;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isoTimePart(dateTimeText) {
  const match = String(dateTimeText || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function timePeriodFor(time) {
  const hour = Number(String(time || "").split(":")[0]);
  return Number.isFinite(hour) && hour >= 12 ? "PM" : "AM";
}

function setTimePeriod(period) {
  selectedTimePeriod = period === "PM" ? "PM" : "AM";

  const amButton = document.getElementById("timePeriodAm");
  const pmButton = document.getElementById("timePeriodPm");

  if (amButton) {
    const active = selectedTimePeriod === "AM";
    amButton.classList.toggle("active", active);
    amButton.setAttribute("aria-selected", String(active));
  }

  if (pmButton) {
    const active = selectedTimePeriod === "PM";
    pmButton.classList.toggle("active", active);
    pmButton.setAttribute("aria-selected", String(active));
  }

  renderPickupSlots();
}

function resetAvailabilityUi(message = "Select a pickup date to load time slots.") {
  bikeAvailability = null;
  availabilityRequestSequence += 1;

  const pickupTime = document.getElementById("pickupTime");
  const grid = document.getElementById("pickupTimeGrid");
  const bookedSummary = document.getElementById("bookedTimeSummary");
  const statusPill = document.getElementById("availabilityStatusPill");
  const subtext = document.getElementById("pickupSlotSubtext");

  if (pickupTime) pickupTime.value = "";

  if (grid) {
    grid.innerHTML = `<div class="pickup-slot-empty">${escapeHtml(message)}</div>`;
  }

  if (bookedSummary) {
    bookedSummary.hidden = true;
    bookedSummary.innerHTML = "";
  }

  if (statusPill) {
    statusPill.textContent = "Waiting";
    statusPill.className = "availability-status-pill";
  }

  if (subtext) {
    subtext.textContent = "Choose a date, duration and pickup time.";
  }
}

function parseHourlyDuration(value) {
  const text = String(value ?? "").trim();
  const hours = Number(text);

  if (
    !text ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 12
  ) {
    return null;
  }

  return hours;
}

function updateSubmitAvailabilityState() {
  const button = document.getElementById("submitBookingButton");
  if (!button || button.classList.contains("is-loading")) return;

  if (selectedRentalType() === "DAILY") {
    button.disabled = !dailyAvailability?.available;
    return;
  }

  button.disabled = false;
}

function renderAvailabilityLoading() {
  const grid = document.getElementById("pickupTimeGrid");
  const statusPill = document.getElementById("availabilityStatusPill");
  const bookedSummary = document.getElementById("bookedTimeSummary");

  if (grid) {
    grid.innerHTML = `
      <div class="pickup-slot-loading">
        <span class="slot-loading-dot"></span>
        Checking live availability…
      </div>`;
  }

  if (statusPill) {
    statusPill.textContent = "Checking…";
    statusPill.className = "availability-status-pill checking";
  }

  if (bookedSummary) {
    bookedSummary.hidden = true;
    bookedSummary.innerHTML = "";
  }
}

function bookedRangeText(slot) {
  if (!slot) return "";
  if (slot.allDay) return "All day booked";

  const start = formatPickupTime(isoTimePart(slot.startDateTime));
  const end = formatPickupTime(isoTimePart(slot.endDateTime));

  if (slot.startsBeforeDate && slot.endsAfterDate) {
    return "Booked all day";
  }

  if (slot.startsBeforeDate) {
    return `Booked until ${end || "later"}`;
  }

  if (slot.endsAfterDate) {
    return `Booked from ${start || "earlier"} into next day`;
  }

  return `${start || "Booked"} – ${end || "later"}`;
}

function renderBookedTimeSummary() {
  const summary = document.getElementById("bookedTimeSummary");
  if (!summary) return;

  const slots = Array.isArray(bikeAvailability?.bookedSlots)
    ? bikeAvailability.bookedSlots
    : [];

  if (!slots.length) {
    summary.hidden = false;
    summary.className = "booked-time-summary clear-day";
    summary.innerHTML = `
      <span class="booked-summary-icon">✓</span>
      <div>
        <strong>No existing bookings on this date</strong>
        <small>Your selected duration is still checked against every pickup slot.</small>
      </div>`;
    return;
  }

  summary.hidden = false;
  summary.className = "booked-time-summary";
  summary.innerHTML = `
    <span class="booked-summary-icon">i</span>
    <div>
      <strong>Already booked</strong>
      <div class="booked-range-list">
        ${slots
          .map(
            (slot) =>
              `<span>${escapeHtml(bookedRangeText(slot))}</span>`,
          )
          .join("")}
      </div>
      <small>Customer details are private. Only occupied time is shown.</small>
    </div>`;
}

function renderPickupSlots() {
  const grid = document.getElementById("pickupTimeGrid");
  const pickupTime = document.getElementById("pickupTime");
  const statusPill = document.getElementById("availabilityStatusPill");
  const subtext = document.getElementById("pickupSlotSubtext");

  if (!grid) return;

  if (!bikeAvailability) {
    return;
  }

  const allSlots = Array.isArray(bikeAvailability.pickupSlots)
    ? bikeAvailability.pickupSlots
    : [];

  const visibleSlots = allSlots.filter(
    (slot) => timePeriodFor(slot.time) === selectedTimePeriod,
  );

  const availableCount = allSlots.filter((slot) => slot.available).length;

  if (statusPill) {
    if (!bikeAvailability.operationallyAvailable) {
      statusPill.textContent = "Vehicle unavailable";
      statusPill.className = "availability-status-pill unavailable";
    } else if (availableCount > 0) {
      statusPill.textContent = `${availableCount} open`;
      statusPill.className = "availability-status-pill available";
    } else {
      statusPill.textContent = "Fully booked";
      statusPill.className = "availability-status-pill unavailable";
    }
  }

  if (subtext) {
    const hours = Number(bikeAvailability.durationHours || 1);
    subtext.textContent = `${formatShortDate(
      bikeAvailability.date,
    )} • checking a ${hours}-hour rental`;
  }

  if (!visibleSlots.length) {
    grid.innerHTML = `<div class="pickup-slot-empty">No ${selectedTimePeriod} pickup slots.</div>`;
    renderBookedTimeSummary();
    return;
  }

  const selectedTime = pickupTime?.value || "";

  grid.innerHTML = visibleSlots
    .map((slot) => {
      const selected = selectedTime === slot.time && slot.available;
      const label = formatPickupTime(slot.time);
      const [displayTime, period] = label.split(" ");

      let stateText = "Available";
      let stateClass = "available";

      if (!slot.available) {
        stateClass = "unavailable";
        if (slot.reason === "PAST") {
          stateText = "Passed";
        } else if (slot.reason === "VEHICLE_UNAVAILABLE") {
          stateText = "Unavailable";
        } else {
          stateText = "Not available";
        }
      }

      if (selected) {
        stateText = "Selected";
        stateClass = "selected";
      }

      return `
        <button
          class="pickup-time-card ${stateClass}"
          type="button"
          ${slot.available ? `onclick="selectPickupTime('${slot.time}')"` : "disabled"}
          aria-pressed="${selected}"
          aria-label="${escapeHtml(label)} ${escapeHtml(stateText)}"
        >
          <strong>${escapeHtml(displayTime)}</strong>
          <span>${escapeHtml(period)}</span>
          <small>
            <i aria-hidden="true"></i>
            ${escapeHtml(stateText)}
          </small>
        </button>`;
    })
    .join("");

  renderBookedTimeSummary();
}

async function loadBikeAvailability({ preserveSelection = false } = {}) {
  const date = document.getElementById("pickupDate")?.value || "";
  const rentalType = selectedRentalType();
  const durationHours = parseHourlyDuration(
    document.getElementById("durationHours")?.value,
  );
  const pickupTime = document.getElementById("pickupTime");

  if (!selectedBike || !date || rentalType !== "HOURLY") {
    resetAvailabilityUi();
    return;
  }

  if (durationHours === null) {
    resetAvailabilityUi("Choose between 1 and 12 hours.");
    return;
  }

  const previousSelection = preserveSelection ? pickupTime?.value || "" : "";
  if (pickupTime && !preserveSelection) pickupTime.value = "";

  const requestId = ++availabilityRequestSequence;
  bikeAvailability = null;
  renderAvailabilityLoading();

  try {
    const url = `${BIKE_API}/${selectedBike.id}/availability?date=${encodeURIComponent(
      date,
    )}&durationHours=${encodeURIComponent(durationHours)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(await errorMessage(res));
    }

    const data = await res.json();

    if (requestId !== availabilityRequestSequence) return;

    bikeAvailability = data;

    if (pickupTime && previousSelection) {
      const stillAvailable = data.pickupSlots?.some(
        (slot) => slot.time === previousSelection && slot.available,
      );

      pickupTime.value = stillAvailable ? previousSelection : "";
    }

    const periodHasOpenSlot = data.pickupSlots?.some(
      (slot) =>
        slot.available && timePeriodFor(slot.time) === selectedTimePeriod,
    );

    if (!periodHasOpenSlot) {
      const otherPeriod = selectedTimePeriod === "AM" ? "PM" : "AM";
      const otherHasOpenSlot = data.pickupSlots?.some(
        (slot) => slot.available && timePeriodFor(slot.time) === otherPeriod,
      );

      if (otherHasOpenSlot) {
        selectedTimePeriod = otherPeriod;
      }
    }

    setTimePeriod(selectedTimePeriod);
  } catch (error) {
    if (requestId !== availabilityRequestSequence) return;

    console.error("Availability error:", error);
    bikeAvailability = null;

    const grid = document.getElementById("pickupTimeGrid");
    const statusPill = document.getElementById("availabilityStatusPill");
    const subtext = document.getElementById("pickupSlotSubtext");

    if (grid) {
      grid.innerHTML = `
        <div class="pickup-slot-empty error">
          <strong>Could not load live availability.</strong>
          <span>${escapeHtml(error.message)}</span>
          <button type="button" onclick="loadBikeAvailability()">Try Again</button>
        </div>`;
    }

    if (statusPill) {
      statusPill.textContent = "Unavailable";
      statusPill.className = "availability-status-pill unavailable";
    }

    if (subtext) {
      subtext.textContent = "Please retry before choosing a pickup time.";
    }
  }
}

function resetDailyAvailabilityUi(
  message = "Choose a date and duration to check this range before booking.",
) {
  dailyAvailability = null;
  dailyAvailabilityRequestSequence += 1;

  const panel = document.getElementById("dailyAvailabilityPanel");
  if (panel) {
    panel.className = "daily-availability-panel";
    panel.innerHTML = `
      <div class="daily-availability-icon" aria-hidden="true">i</div>
      <div>
        <strong>Daily availability</strong>
        <small>${escapeHtml(message)}</small>
      </div>`;
  }

  updateSubmitAvailabilityState();
}

function renderDailyAvailabilityLoading() {
  dailyAvailability = null;
  updateSubmitAvailabilityState();

  const panel = document.getElementById("dailyAvailabilityPanel");
  if (!panel) return;

  panel.className = "daily-availability-panel checking";
  panel.innerHTML = `
    <div class="daily-availability-icon is-loading" aria-hidden="true"></div>
    <div>
      <strong>Checking daily availability</strong>
      <small>Please wait while we check this date range.</small>
    </div>`;
}

function dailyRangeDateLabel(dateText) {
  if (!dateText) return "";

  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (!Number.isFinite(date.getTime())) return dateText;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function dailyAvailabilityRangeLabel(data) {
  return `${dailyRangeDateLabel(data.startDate)} – ${dailyRangeDateLabel(
    data.endDate,
  )}`;
}

function dailyAvailabilityMessage(data) {
  if (!data?.operationallyAvailable) {
    return "This vehicle is currently unavailable.";
  }

  if (data?.reason === "BOOKED") {
    return "This vehicle is already booked during part of this date range.";
  }

  return "Daily availability could not be confirmed.";
}

function renderDailyAvailabilityResult(data) {
  const panel = document.getElementById("dailyAvailabilityPanel");
  if (!panel) return;

  const days = Number(data?.durationDays || 1);

  if (data?.available) {
    panel.className = "daily-availability-panel available";
    panel.innerHTML = `
      <div class="daily-availability-icon" aria-hidden="true">✓</div>
      <div>
        <strong>Available for ${days} day${days === 1 ? "" : "s"}</strong>
        <small>${escapeHtml(dailyAvailabilityRangeLabel(data))}</small>
      </div>`;
  } else {
    panel.className = "daily-availability-panel unavailable";
    panel.innerHTML = `
      <div class="daily-availability-icon" aria-hidden="true">!</div>
      <div>
        <strong>Daily range unavailable</strong>
        <small>${escapeHtml(dailyAvailabilityMessage(data))}</small>
      </div>`;
  }

  updateSubmitAvailabilityState();
}

function renderDailyAvailabilityError(message) {
  const panel = document.getElementById("dailyAvailabilityPanel");
  if (!panel) return;

  panel.className = "daily-availability-panel error";
  panel.innerHTML = `
    <div class="daily-availability-icon" aria-hidden="true">!</div>
    <div>
      <strong>Could not check daily availability</strong>
      <small>${escapeHtml(message)} Try again before booking.</small>
      <button type="button" onclick="loadDailyAvailability()">Retry</button>
    </div>`;

  updateSubmitAvailabilityState();
}

async function loadDailyAvailability() {
  const date = document.getElementById("pickupDate")?.value || "";
  const rentalType = selectedRentalType();
  const durationDaysInput = document.getElementById("durationDays");
  const durationDaysText = durationDaysInput?.value?.trim() || "";
  const durationDays = Number(durationDaysText);

  if (!selectedBike || !date || rentalType !== "DAILY") {
    resetDailyAvailabilityUi();
    return;
  }

  if (
    !durationDaysText ||
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 30
  ) {
    resetDailyAvailabilityUi("Choose between 1 and 30 days.");
    return;
  }

  const requestId = ++dailyAvailabilityRequestSequence;
  dailyAvailability = null;
  renderDailyAvailabilityLoading();
  updateSubmitAvailabilityState();

  try {
    const url = `${BIKE_API}/${selectedBike.id}/availability/daily?date=${encodeURIComponent(
      date,
    )}&durationDays=${encodeURIComponent(durationDays)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(await errorMessage(res));
    }

    const data = await res.json();

    if (requestId !== dailyAvailabilityRequestSequence) return;

    dailyAvailability = data;
    renderDailyAvailabilityResult(data);
  } catch (error) {
    if (requestId !== dailyAvailabilityRequestSequence) return;

    console.error("Daily availability error:", error);
    dailyAvailability = null;
    renderDailyAvailabilityError(error.message);
  }
}

function selectPickupTime(time) {
  const slot = bikeAvailability?.pickupSlots?.find(
    (item) => item.time === time,
  );

  if (!slot?.available) {
    showToast("That pickup time is not available.", "error");
    return;
  }

  const pickupTime = document.getElementById("pickupTime");
  if (pickupTime) pickupTime.value = time;

  clearFieldError("pickupTime");
  renderPickupSlots();
  updateBookingEstimate();
}

function clearRentalChoice() {
  const hourly = document.getElementById("rentalHourly");
  const daily = document.getElementById("rentalDaily");
  const hourlyFields = document.getElementById("hourlyRentalFields");
  const dailyFields = document.getElementById("dailyRentalFields");

  if (hourly) hourly.checked = false;
  if (daily) daily.checked = false;

  if (hourlyFields) hourlyFields.hidden = true;
  if (dailyFields) dailyFields.hidden = true;

  const pickupTime = document.getElementById("pickupTime");
  const durationHours = document.getElementById("durationHours");
  const durationDays = document.getElementById("durationDays");

  if (pickupTime) pickupTime.value = "";
  if (durationHours) durationHours.value = "1";
  if (durationDays) durationDays.value = "1";

  selectedTimePeriod = "AM";
  setTimePeriod("AM");
  resetAvailabilityUi();
  resetDailyAvailabilityUi();

  ["pickupTime", "durationHours", "durationDays"].forEach(clearFieldError);
}

function handlePickupDateChange() {
  clearFieldError("pickupDate");

  const pickupDate = document.getElementById("pickupDate");
  const stage = document.getElementById("rentalOptionsStage");

  if (!pickupDate || !stage) return;

  const date = pickupDate.value;

  if (!date || date < localToday()) {
    stage.hidden = true;
    clearRentalChoice();
    updateBookingEstimate();
    return;
  }

  stage.hidden = false;

  if (selectedRentalType() === "HOURLY") {
    resetDailyAvailabilityUi();
    loadBikeAvailability();
  } else if (selectedRentalType() === "DAILY") {
    resetAvailabilityUi("Hourly availability is shown when Hours is selected.");
    loadDailyAvailability();
  } else {
    resetAvailabilityUi("Choose Hours to see live pickup slots.");
    resetDailyAvailabilityUi();
  }

  updateBookingEstimate();
}

function updateRentalFields() {
  const rentalType = selectedRentalType();

  const hourlyFields = document.getElementById("hourlyRentalFields");
  const dailyFields = document.getElementById("dailyRentalFields");

  hourlyFields.hidden = rentalType !== "HOURLY";
  dailyFields.hidden = rentalType !== "DAILY";

  if (rentalType === "HOURLY") {
    clearFieldError("durationDays");
    resetDailyAvailabilityUi();
    loadBikeAvailability();
  }

  if (rentalType === "DAILY") {
    clearFieldError("pickupTime");
    clearFieldError("durationHours");
    resetAvailabilityUi("Hourly availability is shown when Hours is selected.");
    loadDailyAvailability();
  }

  updateBookingEstimate();
  updateSubmitAvailabilityState();
}

function calculateHourlyPreview(dateText, pickupTime, requestedHours) {
  if (!dateText || !pickupTime || !Number.isFinite(requestedHours)) {
    return null;
  }

  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = pickupTime.split(":").map(Number);

  const start = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (!Number.isFinite(start.getTime())) return null;

  const requestedEnd = new Date(
    start.getTime() + requestedHours * 60 * 60 * 1000,
  );

  const closing = new Date(year, month - 1, day, 22, 0, 0, 0);
  let finalEnd = requestedEnd;
  let billableHours = requestedHours;

  if (requestedEnd > closing) {
    const nextOpening = new Date(year, month - 1, day + 1, 8, 0, 0, 0);
    const minimumOvernightEnd = new Date(
      start.getTime() + 12 * 60 * 60 * 1000,
    );

    finalEnd = new Date(
      Math.max(
        requestedEnd.getTime(),
        nextOpening.getTime(),
        minimumOvernightEnd.getTime(),
      ),
    );

    billableHours = Math.round(
      (finalEnd.getTime() - start.getTime()) / (60 * 60 * 1000),
    );
  }

  return {
    start,
    end: finalEnd,
    billableHours,
    overnight: finalEnd.toDateString() !== start.toDateString(),
  };
}

function focusBookingField(inputId) {
  if (inputId === "pickupDate") {
    document.getElementById("pickupDateWheel")?.focus();
    return;
  }

  if (inputId === "pickupTime") {
    document.getElementById("pickupTimeGrid")?.focus();
    return;
  }

  document.getElementById(inputId)?.focus();
}

function validateBookingForm() {
  [
    "pickupDate",
    "pickupTime",
    "durationHours",
    "durationDays",
  ].forEach(clearFieldError);

  const date = document.getElementById("pickupDate").value;
  const rentalType = selectedRentalType();

  let firstInvalid = null;

  if (!date) {
    setFieldError("pickupDate", "Select a pickup date.");
    firstInvalid ??= "pickupDate";
  } else if (date < localToday()) {
    setFieldError("pickupDate", "Pickup date cannot be in the past.");
    firstInvalid ??= "pickupDate";
  }

  if (firstInvalid) {
    focusBookingField(firstInvalid);
    return null;
  }

  if (!rentalType) {
    showToast("Choose Hours or Days for your rental.", "error");

    const firstRentalOption =
      !document.getElementById("rentalHourly").disabled
        ? document.getElementById("rentalHourly")
        : document.getElementById("rentalDaily");

    firstRentalOption?.focus();
    return null;
  }

  if (rentalType === "HOURLY") {
    const hourlyPrice = Number(selectedBike?.pricePerHour);

    if (!Number.isFinite(hourlyPrice) || hourlyPrice <= 0) {
      showToast(
        "Hourly rental is not configured for this vehicle.",
        "error",
      );
      return null;
    }

    const pickupTime = document.getElementById("pickupTime").value;
    const durationHours = parseHourlyDuration(
      document.getElementById("durationHours").value,
    );

    if (durationHours === null) {
      setFieldError(
        "durationHours",
        "Choose between 1 and 12 hours.",
      );
      firstInvalid ??= "durationHours";
    }

    if (!pickupTime) {
      setFieldError("pickupTime", "Choose an available pickup time.");
      firstInvalid ??= "pickupTime";
    } else {
      const selectedSlot = bikeAvailability?.pickupSlots?.find(
        (slot) => slot.time === pickupTime,
      );

      if (!selectedSlot?.available) {
        setFieldError(
          "pickupTime",
          "This pickup time is no longer available. Choose another slot.",
        );
        firstInvalid ??= "pickupTime";
      }
    }

    if (firstInvalid) {
      focusBookingField(firstInvalid);
      return null;
    }

    return {
      date,
      rentalType: "HOURLY",
      pickupTime,
      durationHours,
    };
  }

  const durationDays = Number(
    document.getElementById("durationDays").value,
  );

  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 30
  ) {
    setFieldError(
      "durationDays",
      "Choose between 1 and 30 days.",
    );
    firstInvalid ??= "durationDays";
  }

  if (firstInvalid) {
    focusBookingField(firstInvalid);
    return null;
  }

  if (
    !dailyAvailability ||
    dailyAvailability.startDate !== date ||
    Number(dailyAvailability.durationDays) !== durationDays
  ) {
    setFieldError(
      "durationDays",
      "Check daily availability before booking.",
    );
    focusBookingField("durationDays");
    return null;
  }

  if (!dailyAvailability.available) {
    setFieldError(
      "durationDays",
      dailyAvailabilityMessage(dailyAvailability),
    );
    focusBookingField("durationDays");
    return null;
  }

  return {
    date,
    rentalType: "DAILY",
    durationDays,
  };
}

function openBookingModal(bikeId) {
  if (!requireUser("vehicles.html#vehicles")) return;

  selectedBike = bikes.find((bike) => bike.id === bikeId);

  if (!selectedBike || !selectedBike.available) {
    showToast(
      "This vehicle is currently unavailable. Refreshing the list.",
      "error",
    );

    loadBikes({ quiet: true });
    return;
  }

  lastFocusedElement = document.activeElement;

  document.getElementById("bookingForm").reset();

  [
    "pickupDate",
    "pickupTime",
    "durationHours",
    "durationDays",
  ].forEach(clearFieldError);

  document.getElementById("selectedBikeId").value =
    selectedBike.id;

  const hourlyPrice = Number(selectedBike.pricePerHour);
  const hourlyConfigured =
    Number.isFinite(hourlyPrice) && hourlyPrice > 0;

  document.getElementById("selectedBikeSummary").textContent =
    hourlyConfigured
      ? `${selectedBike.name} • ₹${hourlyPrice.toFixed(0)}/hour • ₹${Number(
          selectedBike.pricePerDay,
        ).toFixed(0)}/day`
      : `${selectedBike.name} • ₹${Number(
          selectedBike.pricePerDay,
        ).toFixed(0)}/day`;

  document.getElementById("bookingAccountSummary").innerHTML = `
        <strong>${escapeHtml(currentUser.fullName)}</strong>
        <span>${escapeHtml(currentUser.phone)} • ${escapeHtml(
          currentUser.email,
        )}</span>`;

  const pickupInput = document.getElementById("pickupDate");
  const rentalStage = document.getElementById("rentalOptionsStage");
  const hourlyOption = document.getElementById("rentalHourly");

  // The native date field has been replaced by a custom circular
  // wheel. Keep pickupDate as the hidden canonical YYYY-MM-DD value
  // so all existing validation/backend payload logic stays unchanged.
  pickupInput.value = "";
  initializePickupDateWheel();

  rentalStage.hidden = true;

  hourlyOption.disabled = !hourlyConfigured;
  hourlyOption.checked = false;

  document.getElementById("rentalDaily").checked = false;
  document.getElementById("hourlyRentalFields").hidden = true;
  document.getElementById("dailyRentalFields").hidden = true;

  document.getElementById("pickupTime").value = "";
  document.getElementById("durationHours").value = "1";
  document.getElementById("durationDays").value = "1";

  selectedTimePeriod = "AM";
  setTimePeriod("AM");
  resetAvailabilityUi();
  resetDailyAvailabilityUi();
  updateBookingEstimate();

  showModal("bookingModal");

  setTimeout(() => document.getElementById("pickupDateWheel")?.focus(), 80);
}

function closeBookingModal() {
  hideModal("bookingModal");
}

function updateBookingEstimate() {
  if (!selectedBike) return;

  const estimate = document.getElementById("bookingEstimate");
  const date = document.getElementById("pickupDate").value;

  if (!date) {
    estimate.innerHTML = `
      <span>Estimated rental total</span>
      <strong>Choose a pickup date</strong>
      <small>Rental type and duration will appear after you select the date.</small>`;
    return;
  }

  const rentalType = selectedRentalType();

  if (!rentalType) {
    estimate.innerHTML = `
      <span>Estimated rental total</span>
      <strong>Choose Hours or Days</strong>
      <small>Select how long you need the vehicle.</small>`;
    return;
  }

  if (rentalType === "HOURLY") {
    const hourlyPrice = Number(selectedBike.pricePerHour);

    if (!Number.isFinite(hourlyPrice) || hourlyPrice <= 0) {
      estimate.innerHTML = `
        <span>Hourly rental</span>
        <strong>Not available</strong>
        <small>This vehicle does not have an hourly price yet.</small>`;
      return;
    }

    const hours = parseHourlyDuration(
      document.getElementById("durationHours").value,
    );

    if (hours === null) {
      estimate.innerHTML = `
        <span>Hourly rental</span>
        <strong>Choose 1–12 hours</strong>
        <small>Select a whole-hour duration before booking.</small>`;
      return;
    }

    const pickupTime =
      document.getElementById("pickupTime").value;

    const preview = calculateHourlyPreview(
      date,
      pickupTime,
      hours,
    );

    const billableHours = preview?.billableHours || hours;
    const total = hourlyPrice * billableHours;

    let timingText = "Choose an available pickup time.";

    if (pickupTime && preview) {
      const returnTime = preview.end.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      });

      const returnLabel = preview.overnight
        ? `Tomorrow ${returnTime}`
        : returnTime;

      timingText = `Pickup ${formatPickupTime(
        pickupTime,
      )} • Return ${returnLabel}`;
    }

    const overnightNote =
      preview && preview.billableHours !== hours
        ? ` • Overnight rule: ${preview.billableHours} billable hours`
        : "";

    estimate.innerHTML = `
      <span>Estimated rental total</span>
      <strong>₹${total.toFixed(2)}</strong>
      <small>
        ${billableHours} hour${billableHours === 1 ? "" : "s"} ×
        ₹${hourlyPrice.toFixed(2)}/hour
        • ${escapeHtml(timingText)}${escapeHtml(overnightNote)}
      </small>`;

    return;
  }

  const rawDays = Number(
    document.getElementById("durationDays").value,
  );

  const days = Number.isFinite(rawDays)
    ? Math.min(30, Math.max(1, Math.trunc(rawDays)))
    : 1;

  const dailyPrice = Number(selectedBike.pricePerDay);
  const total = dailyPrice * days;

  estimate.innerHTML = `
    <span>Estimated rental total</span>
    <strong>₹${total.toFixed(2)}</strong>
    <small>
      ${days} day${days === 1 ? "" : "s"} ×
      ₹${dailyPrice.toFixed(2)}/day
    </small>`;
}

async function submitBooking(event) {
  event.preventDefault();

  if (!selectedBike || !requireUser("vehicles.html#vehicles")) return;

  const values = validateBookingForm();

  if (!values) return;

  const button = document.getElementById("submitBookingButton");

  setButtonLoading(
    button,
    true,
    "Sending Request…",
    "Send Booking Request",
  );

  try {
    const payload = {
      bikeId: selectedBike.id,
      date: values.date,
      rentalType: values.rentalType,
    };

    if (values.rentalType === "HOURLY") {
      payload.pickupTime = values.pickupTime;
      payload.durationHours = values.durationHours;
    } else {
      payload.durationDays = values.durationDays;
    }

    const res = await authFetch(BOOKING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      showToast(
        "Your login expired. Please sign in again.",
        "error",
      );

      setTimeout(
        () =>
          (window.location.href =
            "account.html?mode=login"),
        700,
      );

      return;
    }

    if (!res.ok) {
      throw new Error(await errorMessage(res));
    }

    const booking = await res.json();

    closeBookingModal();
    showBookingSuccess(booking);

    document.getElementById("bookingLookupId").value =
      booking.id;

    await Promise.all([
      loadBikes({ quiet: true }),
      loadMyBookings(),
    ]);
  } catch (error) {
    console.error(error);

    showToast(error.message, "error");

    if (
      /unavailable|already booked|selected time|conflict|reserved/i.test(
        error.message,
      )
    ) {
      await loadBikes({ quiet: true });

      if (selectedRentalType() === "HOURLY") {
        await loadBikeAvailability();
      } else if (selectedRentalType() === "DAILY") {
        await loadDailyAvailability();
      }
    }
  } finally {
    setButtonLoading(
      button,
      false,
      "Sending Request…",
      "Send Booking Request",
    );
    updateSubmitAvailabilityState();
  }
}

function showBookingSuccess(booking) {
  const rentalType = String(
    booking.rentalType || "DAILY",
  ).toUpperCase();

  const isHourly = rentalType === "HOURLY";

  const pickupText =
    isHourly && booking.pickupTime
      ? `${booking.date} • ${formatPickupTime(booking.pickupTime)}`
      : booking.date;

  const durationText = isHourly
    ? `${booking.durationHours ?? "—"} hour${
        booking.durationHours === 1 ? "" : "s"
      }`
    : `${booking.durationDays ?? "—"} day${
        booking.durationDays === 1 ? "" : "s"
      }`;

  document.getElementById("successDetails").innerHTML = `
        <p class="booking-id-label">Your Booking ID</p>

        <div class="booking-id-row">
          <div class="booking-id">#${booking.id}</div>
          <button
            class="copy-id-btn"
            type="button"
            onclick="copyBookingId(${booking.id})"
          >
            Copy ID
          </button>
        </div>

        <div class="success-summary">
            <div>
              <span>Bike</span>
              <strong>${escapeHtml(booking.bikeName)}</strong>
            </div>

            <div>
              <span>Pickup</span>
              <strong>${escapeHtml(pickupText)}</strong>
            </div>

            <div>
              <span>Rental</span>
              <strong>${escapeHtml(rentalType)}</strong>
            </div>

            <div>
              <span>Duration</span>
              <strong>${escapeHtml(durationText)}</strong>
            </div>

            <div>
              <span>Estimated total</span>
              <strong>₹${Number(booking.totalAmount).toFixed(2)}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong class="status-${String(
                booking.status,
              ).toLowerCase()}">
                ${escapeHtml(booking.status)}
              </strong>
            </div>
        </div>

        <p>
          This booking belongs to your signed-in account.
          Other users cannot open it by guessing the Booking ID.
        </p>`;

  showModal("successModal");
}

async function copyBookingId(id) {
  try {
    await navigator.clipboard.writeText(String(id));
    showToast(`Booking ID ${id} copied.`);
  } catch {
    showToast(`Your Booking ID is ${id}.`, "info");
  }
}

function closeSuccessModal() {
  hideModal("successModal");
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

async function loadMyBookings() {
  if (!currentUser || !userToken()) return;

  const list = document.getElementById("myBookingsList");

  list.innerHTML =
    `<div class="lookup-loading">Loading your bookings…</div>`;

  try {
    const res = await authFetch(
      `${BOOKING_API}/my`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      throw new Error(await errorMessage(res));
    }

    const bookings = await res.json();

    if (!bookings.length) {
      list.innerHTML =
        `<div class="empty-state compact-empty">You have no bookings yet.</div>`;
      return;
    }

    list.innerHTML = bookings
      .map((booking) => {
        const rentalType = String(
          booking.rentalType || "DAILY",
        ).toUpperCase();

        const isHourly = rentalType === "HOURLY";

        const pickupText =
          isHourly && booking.pickupTime
            ? `${booking.date} • ${formatPickupTime(
                booking.pickupTime,
              )}`
            : booking.date;

        const durationText = isHourly
          ? `${booking.durationHours ?? "—"} hour${
              booking.durationHours === 1 ? "" : "s"
            }`
          : `${booking.durationDays ?? "—"} day${
              booking.durationDays === 1 ? "" : "s"
            }`;

        return `
          <article class="my-booking-card">

            <div class="my-booking-top">
              <span class="booking-number">
                #${booking.id}
              </span>

              <span
                class="status-badge status-${statusClass(
                  booking.status,
                )}"
              >
                ${escapeHtml(booking.status)}
              </span>
            </div>

            <h3>${escapeHtml(booking.bikeName)}</h3>

            <div class="my-booking-meta">
              <span>
                Pickup
                <strong>${escapeHtml(pickupText)}</strong>
              </span>

              <span>
                ${escapeHtml(rentalType)} •
                ${escapeHtml(durationText)}
              </span>

              <span>
                ₹${Number(
                  booking.totalAmount || 0,
                ).toFixed(2)}
              </span>
            </div>

            <button
              class="booking-detail-btn"
              type="button"
              onclick="openOwnedBooking(${booking.id})"
            >
              View details
            </button>

          </article>`;
      })
      .join("");
  } catch (error) {
    list.innerHTML = `
      <div class="empty-state error-state">
        <strong>Could not load your bookings.</strong>
        <small>${escapeHtml(error.message)}</small>
      </div>`;
  }
}

function scrollToMyBookings() {
  if (!requireUser("#my-bookings")) return;
  document
    .getElementById("my-bookings")
    .scrollIntoView({ behavior: "smooth", block: "start" });
  loadMyBookings();
}

async function openOwnedBooking(id) {
  document.getElementById("bookingLookupId").value = id;
  document
    .getElementById("booking-status")
    .scrollIntoView({ behavior: "smooth", block: "center" });
  await checkBookingStatus();
}

async function checkBookingStatus(event) {
  if (event) event.preventDefault();

  if (!requireUser("#booking-status")) return;

  const input = document.getElementById("bookingLookupId");
  const error = document.getElementById("bookingLookupError");
  const result = document.getElementById("bookingLookupResult");
  const button = document.getElementById("bookingLookupButton");

  const id = Number(input.value);

  input.classList.remove("input-error");
  input.removeAttribute("aria-invalid");
  error.textContent = "";

  if (!Number.isInteger(id) || id <= 0) {
    input.classList.add("input-error");
    input.setAttribute("aria-invalid", "true");
    error.textContent =
      "Enter a valid positive Booking ID.";
    result.hidden = true;
    input.focus();
    return;
  }

  setButtonLoading(
    button,
    true,
    "Checking…",
    "Check Status",
  );

  result.hidden = false;

  result.innerHTML =
    `<div class="lookup-loading">Checking booking #${id}…</div>`;

  try {
    const res = await authFetch(
      `${BOOKING_API}/${id}`,
      { cache: "no-store" },
    );

    if (res.status === 404) {
      throw new Error(
        "Booking not found in your account.",
      );
    }

    if (!res.ok) {
      throw new Error(await errorMessage(res));
    }

    const booking = await res.json();

    const rentalType = String(
      booking.rentalType || "DAILY",
    ).toUpperCase();

    const isHourly = rentalType === "HOURLY";

    const pickupText =
      isHourly && booking.pickupTime
        ? `${booking.date} • ${formatPickupTime(
            booking.pickupTime,
          )}`
        : booking.date;

    const durationText = isHourly
      ? `${booking.durationHours ?? "—"} hour${
          booking.durationHours === 1 ? "" : "s"
        }`
      : `${booking.durationDays ?? "—"} day${
          booking.durationDays === 1 ? "" : "s"
        }`;

    result.innerHTML = `
      <div class="lookup-grid">

        <div>
          <span>Booking</span>
          <strong>#${booking.id}</strong>
        </div>

        <div>
          <span>Bike</span>
          <strong>${escapeHtml(booking.bikeName)}</strong>
        </div>

        <div>
          <span>Pickup</span>
          <strong>${escapeHtml(pickupText)}</strong>
        </div>

        <div>
          <span>Rental</span>
          <strong>${escapeHtml(rentalType)}</strong>
        </div>

        <div>
          <span>Duration</span>
          <strong>${escapeHtml(durationText)}</strong>
        </div>

        <div>
          <span>Total</span>
          <strong>
            ₹${Number(
              booking.totalAmount || 0,
            ).toFixed(2)}
          </strong>
        </div>

        <div>
          <span>Status</span>
          <strong
            class="status-badge status-${statusClass(
              booking.status,
            )}"
          >
            ${escapeHtml(booking.status)}
          </strong>
        </div>

      </div>`;
  } catch (error) {
    result.innerHTML = `
      <div class="lookup-error">
        <strong>Cannot open booking #${id}.</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>`;
  } finally {
    setButtonLoading(
      button,
      false,
      "Checking…",
      "Check Status",
    );
  }
}

function showModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (!modal.classList.contains("open")) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.open"))
    document.body.classList.remove("modal-open");
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

document
  .getElementById("bookingForm")
  .addEventListener("submit", submitBooking);

document
  .getElementById("bookingLookupForm")
  .addEventListener("submit", checkBookingStatus);

document
  .getElementById("pickupDate")
  .addEventListener("change", handlePickupDateChange);

document
  .getElementById("rentalHourly")
  .addEventListener("change", updateRentalFields);

document
  .getElementById("rentalDaily")
  .addEventListener("change", updateRentalFields);

document
  .getElementById("durationHours")
  .addEventListener("change", async () => {
    clearFieldError("durationHours");
    clearFieldError("pickupTime");
    updateBookingEstimate();

    if (selectedRentalType() === "HOURLY") {
      await loadBikeAvailability();
    }
  });

document
  .getElementById("durationDays")
  .addEventListener("input", () => {
    clearFieldError("durationDays");
    if (selectedRentalType() === "DAILY") {
      loadDailyAvailability();
    }
    updateBookingEstimate();
  });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeBookingModal();
    closeSuccessModal();
  }
});

Promise.all([loadBikes(), restoreUserSession()]);
