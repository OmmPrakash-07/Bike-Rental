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
           aria-label="View ${escapeHtml(bike.name)} details">
          <div class="card-image-wrap">
            ${availabilityBadge}
            <span class="vehicle-card-image-accent" aria-hidden="true"></span>
            <img loading="lazy"
                 src="${escapeHtml(imageSrc(bike.imageUrl))}"
                 alt="${escapeHtml(bike.name)}">
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
            <div><strong>₹${hourlyPrice.toFixed(0)}</strong><small>/ hour</small></div>
          </div>
          <div class="vehicle-price-item">
            <span class="vehicle-price-label">Daily</span>
            <div><strong>₹${safeDailyPrice.toFixed(0)}</strong><small>/ day</small></div>
          </div>
        </div>`
      : `
        <div class="vehicle-price-grid">
          <div class="vehicle-price-item vehicle-price-primary">
            <span class="vehicle-price-label">Daily</span>
            <div><strong>₹${safeDailyPrice.toFixed(0)}</strong><small>/ day</small></div>
          </div>
          <div class="vehicle-price-item is-muted">
            <span class="vehicle-price-label">Hourly</span>
            <div><strong>—</strong><small>Not set</small></div>
          </div>
        </div>`;
    const categoryLabel = category === "SCOOTY" ? "Scooty" : category === "BIKE" ? "Bike" : String(bike.type || "Vehicle");
    const fuelLabel = fuel === "PETROL" ? "Petrol" : fuel === "ELECTRIC" ? "Electric" : "Fuel not set";

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
          ${escapeHtml(bike.name)}
        </a>

        <p class="card-type vehicle-card-description">
          ${escapeHtml(String(bike.type || "Vehicle"))}${fuel !== "UNSET" ? ` • ${escapeHtml(fuelLabel)}` : ""}
        </p>

        ${priceHtml}

        <div class="vehicle-card-actions">
          <a class="vehicle-details-btn"
             href="vehicle.html?id=${encodeURIComponent(bike.id)}">
            Details
          </a>

          <button
            class="${bike.available ? "btn-primary vehicle-card-book-btn" : "unavailable-btn vehicle-card-book-btn"}"
            ${bike.available ? `onclick="openBookingModal(${bike.id})"` : "disabled"}>
            ${bike.available ? "Book Now" : "Unavailable"}
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

function formatPickupTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return "";
  }

  const [hours, minutes] = time.split(":").map(Number);

  const tempDate = new Date();
  tempDate.setHours(hours, minutes, 0, 0);

  return tempDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
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

  ["pickupTime", "durationHours", "durationDays"].forEach(clearFieldError);
}

function updatePickupTimeMinimum() {
  const pickupDate = document.getElementById("pickupDate");
  const pickupTime = document.getElementById("pickupTime");

  if (!pickupDate || !pickupTime) return;

  pickupTime.removeAttribute("min");

  if (pickupDate.value !== localToday()) {
    return;
  }

  const now = new Date();

  // Move to the next 30-minute slot.
  now.setSeconds(0, 0);

  const remainder = now.getMinutes() % 30;

  if (remainder === 0) {
    now.setMinutes(now.getMinutes() + 30);
  } else {
    now.setMinutes(now.getMinutes() + (30 - remainder));
  }

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  pickupTime.min = `${hours}:${minutes}`;

  if (pickupTime.value && pickupTime.value < pickupTime.min) {
    pickupTime.value = "";
  }
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

  updatePickupTimeMinimum();
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
    updatePickupTimeMinimum();
  }

  if (rentalType === "DAILY") {
    clearFieldError("pickupTime");
    clearFieldError("durationHours");
  }

  updateBookingEstimate();
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
    document.getElementById(firstInvalid).focus();
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
    const durationHours = Number(
      document.getElementById("durationHours").value,
    );

    if (!pickupTime) {
      setFieldError("pickupTime", "Select a pickup time.");
      firstInvalid ??= "pickupTime";
    } else if (date === localToday()) {
      const selectedStart = new Date(`${date}T${pickupTime}:00`);

      if (
        !Number.isFinite(selectedStart.getTime()) ||
        selectedStart.getTime() <= Date.now()
      ) {
        setFieldError(
          "pickupTime",
          "Pickup time must be in the future.",
        );
        firstInvalid ??= "pickupTime";
      }
    }

    const allowedHours = new Set([1, 2, 3, 4, 6, 8, 12]);

    if (!allowedHours.has(durationHours)) {
      setFieldError(
        "durationHours",
        "Choose 1, 2, 3, 4, 6, 8 or 12 hours.",
      );
      firstInvalid ??= "durationHours";
    }

    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
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
    document.getElementById(firstInvalid).focus();
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

  pickupInput.min = localToday();

  // Important: date starts blank so Hours/Days only appears AFTER
  // the customer chooses a pickup date.
  pickupInput.value = "";

  rentalStage.hidden = true;

  hourlyOption.disabled = !hourlyConfigured;
  hourlyOption.checked = false;

  document.getElementById("rentalDaily").checked = false;
  document.getElementById("hourlyRentalFields").hidden = true;
  document.getElementById("dailyRentalFields").hidden = true;

  document.getElementById("pickupTime").value = "";
  document.getElementById("durationHours").value = "1";
  document.getElementById("durationDays").value = "1";

  updateBookingEstimate();

  showModal("bookingModal");

  setTimeout(() => pickupInput.focus(), 50);
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

    const rawHours = Number(
      document.getElementById("durationHours").value,
    );

    const allowedHours = [1, 2, 3, 4, 6, 8, 12];

    const hours = allowedHours.includes(rawHours)
      ? rawHours
      : 1;

    const pickupTime =
      document.getElementById("pickupTime").value;

    const total = hourlyPrice * hours;

    estimate.innerHTML = `
      <span>Estimated rental total</span>
      <strong>₹${total.toFixed(2)}</strong>
      <small>
        ${hours} hour${hours === 1 ? "" : "s"} ×
        ₹${hourlyPrice.toFixed(2)}/hour
        ${
          pickupTime
            ? ` • Pickup ${escapeHtml(formatPickupTime(pickupTime))}`
            : ""
        }
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
    }
  } finally {
    setButtonLoading(
      button,
      false,
      "Sending Request…",
      "Send Booking Request",
    );
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
  .getElementById("pickupTime")
  .addEventListener("input", () => {
    clearFieldError("pickupTime");
    updateBookingEstimate();
  });

document
  .getElementById("durationHours")
  .addEventListener("change", () => {
    clearFieldError("durationHours");
    updateBookingEstimate();
  });

document
  .getElementById("durationDays")
  .addEventListener("input", () => {
    clearFieldError("durationDays");
    updateBookingEstimate();
  });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeBookingModal();
    closeSuccessModal();
  }
});

Promise.all([loadBikes(), restoreUserSession()]);
