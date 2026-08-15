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


let vehicleCutoutObjectUrl = null;

function vehicleCutoutSetLoading(loading) {
  const loader = document.getElementById("vehicleCutoutLoader");
  const frame = document.getElementById("vehicleDetailImageFrame");

  if (loader) loader.hidden = !loading;
  if (frame) frame.classList.toggle("is-processing", loading);
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Vehicle image could not be decoded"));
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not create cutout image")),
      "image/png",
      0.96
    );
  });
}

function averageCornerColor(data, width, height) {
  const sampleSize = Math.max(4, Math.min(18, Math.round(Math.min(width, height) * 0.018)));

  const origins = [
    [0, 0],
    [Math.max(0, width - sampleSize), 0],
    [0, Math.max(0, height - sampleSize)],
    [Math.max(0, width - sampleSize), Math.max(0, height - sampleSize)]
  ];

  const samples = [];

  for (const [startX, startY] of origins) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let y = startY; y < Math.min(height, startY + sampleSize); y++) {
      for (let x = startX; x < Math.min(width, startX + sampleSize); x++) {
        const i = (y * width + x) * 4;

        if (data[i + 3] < 20) continue;

        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }

    if (count) {
      samples.push({
        r: r / count,
        g: g / count,
        b: b / count
      });
    }
  }

  if (!samples.length) {
    return { r: 255, g: 255, b: 255, consistent: false };
  }

  const avg = samples.reduce(
    (acc, item) => ({
      r: acc.r + item.r,
      g: acc.g + item.g,
      b: acc.b + item.b
    }),
    { r: 0, g: 0, b: 0 }
  );

  avg.r /= samples.length;
  avg.g /= samples.length;
  avg.b /= samples.length;

  const spread = Math.max(
    ...samples.map((item) =>
      Math.sqrt(
        (item.r - avg.r) ** 2 +
        (item.g - avg.g) ** 2 +
        (item.b - avg.b) ** 2
      )
    )
  );

  return {
    ...avg,
    consistent: spread < 55
  };
}

function isLikelyStudioBackground(r, g, b, background) {
  const distance = Math.sqrt(
    (r - background.r) ** 2 +
    (g - background.g) ** 2 +
    (b - background.b) ** 2
  );

  const brightness = (r + g + b) / 3;
  const backgroundBrightness =
    (background.r + background.g + background.b) / 3;

  // Designed for white / light-gray studio backgrounds.
  return (
    background.consistent &&
    backgroundBrightness > 150 &&
    brightness > 120 &&
    distance < 58
  );
}

async function createAutomaticVehicleCutout(imageUrl) {
  const response = await fetch(imageUrl, {
    cache: "force-cache",
    mode: "cors"
  });

  if (!response.ok) {
    throw new Error(`Vehicle image returned ${response.status}`);
  }

  const sourceBlob = await response.blob();
  const sourceUrl = URL.createObjectURL(sourceBlob);

  try {
    const sourceImage = await loadImageElement(sourceUrl);

    const naturalWidth = sourceImage.naturalWidth || sourceImage.width;
    const naturalHeight = sourceImage.naturalHeight || sourceImage.height;

    if (!naturalWidth || !naturalHeight) {
      throw new Error("Vehicle image dimensions are invalid");
    }

    const maxDimension = 1100;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!context) {
      throw new Error("Canvas is not supported");
    }

    context.drawImage(sourceImage, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // If the source already contains transparent pixels, keep it as-is.
    let transparentSampleFound = false;
    const alphaStep = Math.max(1, Math.floor((width * height) / 2500));

    for (let p = 0; p < width * height; p += alphaStep) {
      if (pixels[p * 4 + 3] < 245) {
        transparentSampleFound = true;
        break;
      }
    }

    if (!transparentSampleFound) {
      const background = averageCornerColor(pixels, width, height);

      if (background.consistent) {
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const enqueueIfBackground = (index) => {
          if (index < 0 || index >= total || visited[index]) return;

          const offset = index * 4;

          if (
            isLikelyStudioBackground(
              pixels[offset],
              pixels[offset + 1],
              pixels[offset + 2],
              background
            )
          ) {
            visited[index] = 1;
            queue[tail++] = index;
          }
        };

        // Seed flood-fill from all outer edges.
        for (let x = 0; x < width; x++) {
          enqueueIfBackground(x);
          enqueueIfBackground((height - 1) * width + x);
        }

        for (let y = 0; y < height; y++) {
          enqueueIfBackground(y * width);
          enqueueIfBackground(y * width + (width - 1));
        }

        while (head < tail) {
          const index = queue[head++];
          const x = index % width;
          const y = Math.floor(index / width);

          const offset = index * 4;
          pixels[offset + 3] = 0;

          if (x > 0) enqueueIfBackground(index - 1);
          if (x + 1 < width) enqueueIfBackground(index + 1);
          if (y > 0) enqueueIfBackground(index - width);
          if (y + 1 < height) enqueueIfBackground(index + width);
        }

        context.putImageData(imageData, 0, 0);
      }
    }

    const cutoutBlob = await canvasToBlob(canvas);
    return URL.createObjectURL(cutoutBlob);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function applyVehicleDetailImage(imageUrl, altText) {
  const image = document.getElementById("vehicleDetailImage");
  const fallback = document.getElementById("vehicleDetailImageFallback");
  const frame = document.getElementById("vehicleDetailImageFrame");

  if (!image || !fallback || !frame) return;

  if (vehicleCutoutObjectUrl) {
    URL.revokeObjectURL(vehicleCutoutObjectUrl);
    vehicleCutoutObjectUrl = null;
  }

  if (!imageUrl) {
    image.hidden = true;
    fallback.hidden = false;
    frame.classList.add("is-fallback");
    vehicleCutoutSetLoading(false);
    return;
  }

  image.alt = altText;
  image.hidden = true;
  fallback.hidden = true;
  frame.classList.remove("is-fallback", "cutout-ready", "cutout-fallback");
  vehicleCutoutSetLoading(true);

  try {
    vehicleCutoutObjectUrl = await createAutomaticVehicleCutout(imageUrl);

    image.src = vehicleCutoutObjectUrl;
    image.hidden = false;
    frame.classList.add("cutout-ready");
  } catch (error) {
    console.warn("Automatic vehicle cutout unavailable; using original image.", error);

    // Safe fallback: still show the admin-uploaded main image.
    image.src = imageUrl;
    image.hidden = false;
    frame.classList.add("cutout-fallback");
  } finally {
    vehicleCutoutSetLoading(false);
  }

  image.onerror = () => {
    image.hidden = true;
    fallback.hidden = false;
    frame.classList.add("is-fallback");
    vehicleCutoutSetLoading(false);
  };
}


const VEHICLE_SPEC_GROUPS = [
  {
    title: "Performance",
    fields: [
      ["displacementCc", "Displacement", value => `${value} cc`],
      ["maxPower", "Max Power", value => value],
      ["maxTorque", "Max Torque", value => value],
      ["topSpeedKmph", "Top Speed", value => `${value} km/h`],
      ["mileageKmpl", "Mileage", value => `${value} km/l`],
      ["claimedRangeKm", "Claimed Range", value => `${value} km`],
      ["motorPower", "Motor Power", value => value]
    ]
  },
  {
    title: "Engine & Transmission",
    fields: [
      ["engineType", "Engine Type", value => value],
      ["cylinders", "Cylinders", value => String(value)],
      ["coolingSystem", "Cooling", value => value],
      ["transmission", "Transmission", value => value],
      ["clutchType", "Clutch", value => value],
      ["startingType", "Starting", value => value]
    ]
  },
  {
    title: "Fuel / Battery",
    fields: [
      ["fuelTankLitres", "Fuel Tank", value => `${value} L`],
      ["batteryCapacityKwh", "Battery Capacity", value => `${value} kWh`],
      ["chargingTime", "Charging Time", value => value]
    ]
  },
  {
    title: "Brakes & Safety",
    fields: [
      ["frontBrake", "Front Brake", value => value],
      ["rearBrake", "Rear Brake", value => value],
      ["absType", "ABS", value => value]
    ]
  },
  {
    title: "Wheels & Tyres",
    fields: [
      ["frontTyre", "Front Tyre", value => value],
      ["rearTyre", "Rear Tyre", value => value],
      ["wheelType", "Wheel Type", value => value]
    ]
  },
  {
    title: "Suspension",
    fields: [
      ["frontSuspension", "Front Suspension", value => value],
      ["rearSuspension", "Rear Suspension", value => value]
    ]
  },
  {
    title: "Dimensions",
    fields: [
      ["kerbWeightKg", "Kerb Weight", value => `${value} kg`],
      ["seatHeightMm", "Seat Height", value => `${value} mm`],
      ["groundClearanceMm", "Ground Clearance", value => `${value} mm`]
    ]
  }
];

function hasDetailSpecValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatDetailSpecValue(field, value) {
  try {
    return field[2](value);
  } catch {
    return String(value);
  }
}

function renderVehicleSpecifications(bike) {
  const section = document.getElementById("vehicleSpecificationSection");
  const highlights = document.getElementById("vehicleSpecHighlights");
  const groups = document.getElementById("vehicleSpecGroups");

  if (!section || !highlights || !groups) return;

  const availableFields = [];

  VEHICLE_SPEC_GROUPS.forEach((group) => {
    group.fields.forEach((field) => {
      if (hasDetailSpecValue(bike?.[field[0]])) {
        availableFields.push(field);
      }
    });
  });

  if (!availableFields.length) {
    section.hidden = true;
    return;
  }

  const fuel = String(bike?.fuelType || "").toUpperCase();

  const preferredHighlightKeys =
    fuel === "ELECTRIC"
      ? ["claimedRangeKm", "motorPower", "topSpeedKmph", "batteryCapacityKwh"]
      : ["displacementCc", "maxPower", "topSpeedKmph", "mileageKmpl"];

  const highlightFields = preferredHighlightKeys
    .map((key) =>
      availableFields.find((field) => field[0] === key)
    )
    .filter(Boolean)
    .slice(0, 4);

  highlights.innerHTML = highlightFields
    .map((field) => {
      const key = field[0];
      const label = field[1];
      const value = formatDetailSpecValue(field, bike[key]);

      return `
        <article class="vehicle-spec-highlight">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `;
    })
    .join("");

  groups.innerHTML = VEHICLE_SPEC_GROUPS
    .map((group) => {
      const rows = group.fields
        .filter((field) => hasDetailSpecValue(bike?.[field[0]]))
        .map((field) => {
          const key = field[0];
          const label = field[1];
          const value = formatDetailSpecValue(field, bike[key]);

          return `
            <div class="vehicle-spec-row">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `;
        })
        .join("");

      if (!rows) return "";

      return `
        <article class="vehicle-spec-group">
          <h3>${escapeHtml(group.title)}</h3>
          <div class="vehicle-spec-row-list">
            ${rows}
          </div>
        </article>
      `;
    })
    .join("");

  section.hidden = false;
}

function renderDetailBike(bike) {
  detailBike = bike;

  const category = detailCategory(bike);
  const fuel = detailFuel(bike);

  const imageUrl = detailImageSrc(bike.imageUrl);

  applyVehicleDetailImage(
    imageUrl,
    `${bike.name || "Vehicle"} ${category}`
  );

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

  const yearPill = document.getElementById("vehicleYearPill");
  if (yearPill) {
    const modelYear = Number(bike.modelYear);
    yearPill.hidden = !Number.isInteger(modelYear);
    if (Number.isInteger(modelYear)) {
      yearPill.textContent = String(modelYear);
    }
  }

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

  renderVehicleSpecifications(bike);

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
