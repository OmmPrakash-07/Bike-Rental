const HOME_USER_TOKEN_KEY = "bikeRentalUserToken";
const HOME_USER_PROFILE_KEY = "bikeRentalUserProfile";

function homeReadProfile() {
  try {
    const raw = localStorage.getItem(HOME_USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function homeUpdateAccountUi() {
  const token = localStorage.getItem(HOME_USER_TOKEN_KEY) || "";
  const user = token ? homeReadProfile() : null;

  const accountLink = document.getElementById("accountLink");
  const userMenu = document.getElementById("userMenu");
  const userAvatar = document.getElementById("userAvatar");
  const userMenuName = document.getElementById("userMenuName");
  const mobileUserSummary = document.getElementById("mobileUserSummary");
  const mobileUserAvatar = document.getElementById("mobileUserAvatar");
  const mobileUserName = document.getElementById("mobileUserName");
  const mobileAccountLink = document.getElementById("mobileAccountLink");
  const mobileProfileLink = document.getElementById("mobileProfileLink");
  const mobileLogoutButton = document.getElementById("mobileLogoutButton");

  if (token && user) {
    const fullName = String(user.fullName || "User").trim() || "User";
    const names = fullName.split(/\s+/);
    const firstName = names[0] || "User";
    const initials = names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : firstName[0];

    if (accountLink) accountLink.hidden = true;
    if (userMenu) userMenu.hidden = false;
    if (userMenuName) userMenuName.textContent = firstName;
    if (userAvatar) userAvatar.textContent = initials.toUpperCase();
    if (mobileUserSummary) mobileUserSummary.hidden = false;
    if (mobileUserName) mobileUserName.textContent = firstName;
    if (mobileUserAvatar) mobileUserAvatar.textContent = initials.toUpperCase();
    if (mobileAccountLink) mobileAccountLink.hidden = true;
    if (mobileProfileLink) mobileProfileLink.hidden = false;
    if (mobileLogoutButton) mobileLogoutButton.hidden = false;
  } else {
    if (accountLink) accountLink.hidden = false;
    if (userMenu) userMenu.hidden = true;
    if (mobileUserSummary) mobileUserSummary.hidden = true;
    if (mobileAccountLink) mobileAccountLink.hidden = false;
    if (mobileProfileLink) mobileProfileLink.hidden = true;
    if (mobileLogoutButton) mobileLogoutButton.hidden = true;
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
  drawer.classList.contains("open") ? closeMobileMenu() : openMobileMenu();
}

function toggleUserMenu(event) {
  event?.stopPropagation();
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (!dropdown || !button) return;
  const open = dropdown.hidden;
  dropdown.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function closeUserMenu() {
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (dropdown) dropdown.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
}

function logoutUser() {
  localStorage.removeItem(HOME_USER_TOKEN_KEY);
  localStorage.removeItem(HOME_USER_PROFILE_KEY);
  closeMobileMenu();
  closeUserMenu();
  homeUpdateAccountUi();
}

document.addEventListener("click", closeUserMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeUserMenu();
    closeMobileMenu();
  }
});

homeUpdateAccountUi();


/* =========================================================
   INDEX ONLY — LONG-RIDE SCOOTER SAVINGS
   Uses the current /api/bikes data and daily prices.
========================================================= */

const LONG_RIDE_SCOOTERS = [
  {
    name: "Honda Activa",
    aliases: ["Honda Activa"],
    fallbackDaily: 700,
    fallbackFuel: "Petrol"
  },
  {
    name: "Suzuki Access 125",
    aliases: ["Suzuki Access 125", "Suzuki Access"],
    fallbackDaily: 799,
    fallbackFuel: "Petrol"
  },
  {
    name: "Yamaha RayZR 125",
    aliases: ["Yamaha RayZR 125", "Yamaha RayZR"],
    fallbackDaily: 940,
    fallbackFuel: "Petrol"
  },
  {
    name: "Bajaj Chetak",
    aliases: ["Bajaj Chetak"],
    fallbackDaily: 549,
    fallbackFuel: "Electric"
  }
];

const LONG_RIDE_PACKAGES = [
  { days: 7, discount: 0.10 },
  { days: 15, discount: 0.20 },
  { days: 30, discount: 0.30 }
];

function longRideImageUrl(imageUrl) {
  const base = String(window.BIKE_RENTAL_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

  if (!imageUrl) return "";

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  return `${base}/${String(imageUrl).replace(/^\//, "")}`;
}

function longRideMoney(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function longRidePackagePrice(dailyRate, days, discount) {
  const raw = Number(dailyRate) * days * (1 - discount);

  // Round to the nearest ₹10 so the package price stays clean.
  return Math.round(raw / 10) * 10;
}

function longRideFindBike(bikes, config) {
  const aliases = config.aliases.map((item) => item.toLowerCase());

  return bikes.find((bike) => {
    const name = String(bike?.name || "").trim().toLowerCase();
    return aliases.includes(name);
  }) || null;
}


function longRideSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function longRideCardMarkup(config, bike) {
  const daily = Number(bike?.pricePerDay) || config.fallbackDaily;
  const fuel = String(
    bike?.fuelType ||
    config.fallbackFuel ||
    "Petrol"
  ).trim();

  const image = longRideImageUrl(bike?.imageUrl || "");
  const electric = fuel.toLowerCase() === "electric";
  const scooterSlug = longRideSlug(config.name);

  const priceRows = LONG_RIDE_PACKAGES.map((pkg) => {
    const price = longRidePackagePrice(
      daily,
      pkg.days,
      pkg.discount
    );

    return `
      <div class="long-ride-price-row">
        <strong>${pkg.days} Days</strong>
        <b>${longRideMoney(price)}</b>
        <span>Save ${Math.round(pkg.discount * 100)}%</span>
      </div>
    `;
  }).join("");

  const imageMarkup = image
    ? `<img class="long-ride-scooter-image long-ride-scooter-image--${scooterSlug}" src="${image}" alt="${config.name} scooter" loading="lazy">`
    : `<div class="long-ride-image-fallback">Scooter</div>`;

  return `
    <article class="long-ride-card long-ride-card--${scooterSlug}">
      <div class="long-ride-image-wrap">
        ${imageMarkup}
      </div>

      <div class="long-ride-card-body">
        <div class="long-ride-meta">
          <span class="long-ride-fuel ${electric ? "electric" : ""}">
            ${electric ? "⚡" : "⛽"} ${fuel}
          </span>
          <span class="long-ride-daily">${longRideMoney(daily)} / day</span>
        </div>

        <h3>${config.name}</h3>

        <div class="long-ride-prices">
          ${priceRows}
        </div>

        <a class="long-ride-card-link" href="vehicles.html">
          View scooter →
        </a>
      </div>
    </article>
  `;
}

async function loadLongRideScooterDeals() {
  const container = document.getElementById("longRideDeals");

  // Section does not exist outside index.html, so this safely does nothing.
  if (!container) return;

  const base = String(
    window.BIKE_RENTAL_CONFIG?.API_BASE_URL || ""
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${base}/api/bikes`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Bike API returned ${response.status}`);
    }

    const payload = await response.json();
    const bikes = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    container.innerHTML = LONG_RIDE_SCOOTERS.map((config) => {
      const bike = longRideFindBike(bikes, config);
      return longRideCardMarkup(config, bike);
    }).join("");
  } catch (error) {
    console.warn("Could not load live long-ride scooter prices:", error);

    // Still render the section using current known fallback daily prices.
    container.innerHTML = LONG_RIDE_SCOOTERS.map((config) =>
      longRideCardMarkup(config, null)
    ).join("");
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    loadLongRideScooterDeals
  );
} else {
  loadLongRideScooterDeals();
}
