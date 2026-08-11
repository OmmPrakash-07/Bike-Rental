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

  if (currentUser) {
    accountLink.hidden = true;
    myBookingsLink.hidden = false;
    userMenu.hidden = false;

    const fullName = currentUser.fullName?.trim() || "User";
    const names = fullName.split(/\s+/);

    userMenuName.textContent = names[0];

    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`
        : names[0][0];

    userAvatar.textContent = initials.toUpperCase();

    authNotice.hidden = true;
    bookingsContent.hidden = false;
  } else {
    accountLink.hidden = false;
    accountLink.textContent = "Login / Sign Up";

    myBookingsLink.hidden = true;
    userMenu.hidden = true;

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

document.addEventListener("click", closeUserMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeUserMenu();
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

function requireUser(returnTarget = "#vehicles") {
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

function renderVehicleStats() {
  const stats = document.getElementById("vehicleStats");
  if (!bikes.length) {
    stats.innerHTML = "";
    return;
  }
  const available = bikes.filter((bike) => bike.available).length;
  stats.innerHTML = `
        <div class="stat-chip"><strong>${bikes.length}</strong><span>Total vehicles</span></div>
        <div class="stat-chip available-chip"><strong>${available}</strong><span>Available now</span></div>
        <div class="stat-chip"><strong>${bikes.length - available}</strong><span>Currently reserved</span></div>`;
}

async function loadBikes({ quiet = false } = {}) {
  const container = document.getElementById("bikeContainer");
  if (!quiet) {
    container.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>`;
  }

  try {
    const res = await fetch(BIKE_API, { cache: "no-store" });
    if (!res.ok) throw new Error(await errorMessage(res));
    bikes = await res.json();
    renderVehicleStats();
    container.innerHTML = "";

    if (!bikes.length) {
      container.innerHTML = `<div class="empty-state">No vehicles have been added yet.</div>`;
      return;
    }

    bikes.forEach((bike, index) => {
      const card = document.createElement("article");
      card.className = `card reveal delay-${Math.min(index + 1, 4)}`;
      const image = bike.imageUrl
        ? `<div class="card-image-wrap"><img loading="lazy" src="${escapeHtml(imageSrc(bike.imageUrl))}" alt="${escapeHtml(bike.name)}"></div>`
        : `<div class="image-placeholder">🏍️</div>`;

      card.innerHTML = `
                <span class="badge ${bike.available ? "available" : "unavailable"}">${bike.available ? "Available" : "Unavailable"}</span>
                ${image}
                <div class="card-body">
                    <div class="card-name">${escapeHtml(bike.name)}</div>
                    <p class="card-type">${escapeHtml(bike.type)}</p>
                    <div class="card-price"><strong>₹${Number(bike.pricePerDay).toFixed(0)}</strong><span>/ day</span></div>
                    <button class="${bike.available ? "btn-primary" : "unavailable-btn"}" ${bike.available ? `onclick="openBookingModal(${bike.id})"` : "disabled"}>
                        ${bike.available ? "Book Now" : "Currently Unavailable"}
                    </button>
                </div>`;

      const img = card.querySelector("img");
      if (img) {
        img.addEventListener(
          "error",
          () => {
            img.closest(".card-image-wrap").innerHTML =
              `<div class="image-placeholder">🏍️</div>`;
          },
          { once: true },
        );
      }
      container.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    document.getElementById("vehicleStats").innerHTML = "";
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

function validateBookingForm() {
  ["pickupDate", "durationDays"].forEach(clearFieldError);
  const date = document.getElementById("pickupDate").value;
  const durationDays = Number(document.getElementById("durationDays").value);
  let firstInvalid = null;

  if (!date) {
    setFieldError("pickupDate", "Select a pickup date.");
    firstInvalid ??= "pickupDate";
  } else if (date < localToday()) {
    setFieldError("pickupDate", "Pickup date cannot be in the past.");
    firstInvalid ??= "pickupDate";
  }

  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 30
  ) {
    setFieldError("durationDays", "Choose between 1 and 30 days.");
    firstInvalid ??= "durationDays";
  }

  if (firstInvalid) {
    document.getElementById(firstInvalid).focus();
    return null;
  }
  return { date, durationDays };
}

function openBookingModal(bikeId) {
  if (!requireUser("#vehicles")) return;

  selectedBike = bikes.find((bike) => bike.id === bikeId);
  if (!selectedBike || !selectedBike.available) {
    showToast(
      "This vehicle is no longer available. Refreshing the list.",
      "error",
    );
    loadBikes({ quiet: true });
    return;
  }

  lastFocusedElement = document.activeElement;
  document.getElementById("bookingForm").reset();
  ["pickupDate", "durationDays"].forEach(clearFieldError);
  document.getElementById("selectedBikeId").value = selectedBike.id;
  document.getElementById("selectedBikeSummary").textContent =
    `${selectedBike.name} • ₹${Number(selectedBike.pricePerDay).toFixed(0)}/day`;
  document.getElementById("bookingAccountSummary").innerHTML = `
        <strong>${escapeHtml(currentUser.fullName)}</strong>
        <span>${escapeHtml(currentUser.phone)} • ${escapeHtml(currentUser.email)}</span>`;
  document.getElementById("durationDays").value = 1;

  const pickupInput = document.getElementById("pickupDate");
  pickupInput.min = localToday();
  pickupInput.value = localToday();
  updateBookingEstimate();
  showModal("bookingModal");
  setTimeout(() => pickupInput.focus(), 50);
}

function closeBookingModal() {
  hideModal("bookingModal");
}

function updateBookingEstimate() {
  if (!selectedBike) return;
  const rawDays = Number(document.getElementById("durationDays").value);
  const days = Number.isFinite(rawDays)
    ? Math.min(30, Math.max(1, Math.trunc(rawDays)))
    : 1;
  const total = Number(selectedBike.pricePerDay) * days;
  document.getElementById("bookingEstimate").innerHTML = `
        <span>Estimated rental total</span>
        <strong>₹${total.toFixed(2)}</strong>
        <small>${days} day${days === 1 ? "" : "s"} × ₹${Number(selectedBike.pricePerDay).toFixed(2)}/day</small>`;
}

async function submitBooking(event) {
  event.preventDefault();
  if (!selectedBike || !requireUser("#vehicles")) return;
  const values = validateBookingForm();
  if (!values) return;

  const button = document.getElementById("submitBookingButton");
  setButtonLoading(button, true, "Sending Request…", "Send Booking Request");

  try {
    const res = await authFetch(BOOKING_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bikeId: selectedBike.id,
        date: values.date,
        durationDays: values.durationDays,
      }),
    });

    if (res.status === 401) {
      showToast("Your login expired. Please sign in again.", "error");
      setTimeout(() => (window.location.href = "account.html?mode=login"), 700);
      return;
    }
    if (!res.ok) throw new Error(await errorMessage(res));
    const booking = await res.json();

    closeBookingModal();
    showBookingSuccess(booking);
    document.getElementById("bookingLookupId").value = booking.id;
    await Promise.all([loadBikes({ quiet: true }), loadMyBookings()]);
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
    if (/unavailable|active booking|reserved/i.test(error.message))
      await loadBikes({ quiet: true });
  } finally {
    setButtonLoading(button, false, "Sending Request…", "Send Booking Request");
  }
}

function showBookingSuccess(booking) {
  document.getElementById("successDetails").innerHTML = `
        <p class="booking-id-label">Your Booking ID</p>
        <div class="booking-id-row"><div class="booking-id">#${booking.id}</div><button class="copy-id-btn" type="button" onclick="copyBookingId(${booking.id})">Copy ID</button></div>
        <div class="success-summary">
            <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
            <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
            <div><span>Duration</span><strong>${booking.durationDays} day${booking.durationDays === 1 ? "" : "s"}</strong></div>
            <div><span>Estimated total</span><strong>₹${Number(booking.totalAmount).toFixed(2)}</strong></div>
            <div><span>Status</span><strong class="status-${String(booking.status).toLowerCase()}">${escapeHtml(booking.status)}</strong></div>
        </div>
        <p>This booking belongs to your signed-in account. Other users cannot open it by guessing the Booking ID.</p>`;
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
  list.innerHTML = `<div class="lookup-loading">Loading your bookings…</div>`;

  try {
    const res = await authFetch(`${BOOKING_API}/my`, { cache: "no-store" });
    if (!res.ok) throw new Error(await errorMessage(res));
    const bookings = await res.json();
    if (!bookings.length) {
      list.innerHTML = `<div class="empty-state compact-empty">You have no bookings yet.</div>`;
      return;
    }
    list.innerHTML = bookings
      .map(
        (booking) => `
            <article class="my-booking-card">
                <div class="my-booking-top"><span class="booking-number">#${booking.id}</span><span class="status-badge status-${statusClass(booking.status)}">${escapeHtml(booking.status)}</span></div>
                <h3>${escapeHtml(booking.bikeName)}</h3>
                <div class="my-booking-meta"><span>Pickup <strong>${escapeHtml(booking.date)}</strong></span><span>${booking.durationDays ?? "—"} day${booking.durationDays === 1 ? "" : "s"}</span><span>₹${Number(booking.totalAmount || 0).toFixed(2)}</span></div>
                <button class="booking-detail-btn" type="button" onclick="openOwnedBooking(${booking.id})">View details</button>
            </article>`,
      )
      .join("");
  } catch (error) {
    list.innerHTML = `<div class="empty-state error-state"><strong>Could not load your bookings.</strong><small>${escapeHtml(error.message)}</small></div>`;
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
    error.textContent = "Enter a valid positive Booking ID.";
    result.hidden = true;
    input.focus();
    return;
  }

  setButtonLoading(button, true, "Checking…", "Check Status");
  result.hidden = false;
  result.innerHTML = `<div class="lookup-loading">Checking booking #${id}…</div>`;

  try {
    const res = await authFetch(`${BOOKING_API}/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      throw new Error("Booking not found in your account.");
    }
    if (!res.ok) throw new Error(await errorMessage(res));
    const booking = await res.json();
    result.innerHTML = `
            <div class="lookup-grid">
                <div><span>Booking</span><strong>#${booking.id}</strong></div>
                <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
                <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
                <div><span>Duration</span><strong>${booking.durationDays ?? "—"} day${booking.durationDays === 1 ? "" : "s"}</strong></div>
                <div><span>Total</span><strong>₹${Number(booking.totalAmount || 0).toFixed(2)}</strong></div>
                <div><span>Status</span><strong class="status-badge status-${statusClass(booking.status)}">${escapeHtml(booking.status)}</strong></div>
            </div>`;
  } catch (error) {
    result.innerHTML = `<div class="lookup-error"><strong>Cannot open booking #${id}.</strong><span>${escapeHtml(error.message)}</span></div>`;
  } finally {
    setButtonLoading(button, false, "Checking…", "Check Status");
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
  .addEventListener("change", () => clearFieldError("pickupDate"));
document.getElementById("durationDays").addEventListener("input", () => {
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
