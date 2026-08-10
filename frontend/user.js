const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const BOOKING_API = `${API_BASE}/api/bookings`;

let bikes = [];
let selectedBike = null;
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

function renderVehicleStats() {
    const stats = document.getElementById("vehicleStats");
    if (!bikes.length) {
        stats.innerHTML = "";
        return;
    }
    const available = bikes.filter(bike => bike.available).length;
    stats.innerHTML = `
        <div class="stat-chip"><strong>${bikes.length}</strong><span>Total vehicles</span></div>
        <div class="stat-chip available-chip"><strong>${available}</strong><span>Available now</span></div>
        <div class="stat-chip"><strong>${bikes.length - available}</strong><span>Currently reserved</span></div>`;
}

async function loadBikes({ quiet = false } = {}) {
    const container = document.getElementById("bikeContainer");
    if (!quiet) {
        container.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>`;
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
                img.addEventListener("error", () => {
                    img.closest(".card-image-wrap").innerHTML = `<div class="image-placeholder">🏍️</div>`;
                }, { once: true });
            }
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        document.getElementById("vehicleStats").innerHTML = "";
        container.innerHTML = `
            <div class="empty-state error-state">
                <strong>Could not load vehicles.</strong>
                <small>${escapeHtml(error.message)}</small>
                <button class="retry-btn" type="button" onclick="refreshBikes()">Try Again</button>
            </div>`;
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

function clearBookingErrors() {
    ["customerName", "phone", "pickupDate", "durationDays"].forEach(clearFieldError);
}

function validateBookingForm() {
    clearBookingErrors();

    const customerName = document.getElementById("customerName").value.trim().replace(/\s+/g, " ");
    const phone = document.getElementById("phone").value.replace(/\D/g, "");
    const date = document.getElementById("pickupDate").value;
    const durationDays = Number(document.getElementById("durationDays").value);
    let firstInvalid = null;

    if (customerName.length < 2) {
        setFieldError("customerName", "Enter at least 2 characters.");
        firstInvalid ??= "customerName";
    } else if (customerName.length > 80) {
        setFieldError("customerName", "Name must be 80 characters or fewer.");
        firstInvalid ??= "customerName";
    } else if (!/[A-Za-z\p{L}]/u.test(customerName)) {
        setFieldError("customerName", "Enter a valid name.");
        firstInvalid ??= "customerName";
    }

    if (!/^\d{10}$/.test(phone)) {
        setFieldError("phone", "Enter exactly 10 digits.");
        firstInvalid ??= "phone";
    }

    if (!date) {
        setFieldError("pickupDate", "Select a pickup date.");
        firstInvalid ??= "pickupDate";
    } else if (date < localToday()) {
        setFieldError("pickupDate", "Pickup date cannot be in the past.");
        firstInvalid ??= "pickupDate";
    }

    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
        setFieldError("durationDays", "Choose between 1 and 30 days.");
        firstInvalid ??= "durationDays";
    }

    if (firstInvalid) {
        document.getElementById(firstInvalid).focus();
        return null;
    }

    return { customerName, phone, date, durationDays };
}

function openBookingModal(bikeId) {
    selectedBike = bikes.find(bike => bike.id === bikeId);
    if (!selectedBike || !selectedBike.available) {
        showToast("This vehicle is no longer available. Refreshing the list.", "error");
        loadBikes({ quiet: true });
        return;
    }

    lastFocusedElement = document.activeElement;
    const form = document.getElementById("bookingForm");
    form.reset();
    clearBookingErrors();

    document.getElementById("selectedBikeId").value = selectedBike.id;
    document.getElementById("selectedBikeSummary").textContent = `${selectedBike.name} • ₹${Number(selectedBike.pricePerDay).toFixed(0)}/day`;
    document.getElementById("durationDays").value = 1;

    const pickupInput = document.getElementById("pickupDate");
    pickupInput.min = localToday();
    pickupInput.value = localToday();

    updateBookingEstimate();
    showModal("bookingModal");
    setTimeout(() => document.getElementById("customerName").focus(), 50);
}

function closeBookingModal() {
    hideModal("bookingModal");
}

function updateBookingEstimate() {
    if (!selectedBike) return;
    const rawDays = Number(document.getElementById("durationDays").value);
    const days = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.trunc(rawDays))) : 1;
    const total = Number(selectedBike.pricePerDay) * days;
    document.getElementById("bookingEstimate").innerHTML = `
        <span>Estimated rental total</span>
        <strong>₹${total.toFixed(2)}</strong>
        <small>${days} day${days === 1 ? "" : "s"} × ₹${Number(selectedBike.pricePerDay).toFixed(2)}/day</small>`;
}

async function submitBooking(event) {
    event.preventDefault();
    if (!selectedBike) return;

    const values = validateBookingForm();
    if (!values) return;

    const button = document.getElementById("submitBookingButton");
    setButtonLoading(button, true, "Sending Request…", "Send Booking Request");

    try {
        const res = await fetch(BOOKING_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...values,
                bikeId: selectedBike.id
            })
        });

        if (!res.ok) throw new Error(await errorMessage(res));
        const booking = await res.json();

        closeBookingModal();
        showBookingSuccess(booking);
        document.getElementById("bookingLookupId").value = booking.id;
        localStorage.setItem("lastBikeRentalBookingId", String(booking.id));
        await loadBikes({ quiet: true });
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
        if (/unavailable|active booking|reserved/i.test(error.message)) {
            await loadBikes({ quiet: true });
        }
    } finally {
        setButtonLoading(button, false, "Sending Request…", "Send Booking Request");
    }
}

function showBookingSuccess(booking) {
    document.getElementById("successDetails").innerHTML = `
        <p class="booking-id-label">Your Booking ID</p>
        <div class="booking-id-row">
            <div class="booking-id">#${booking.id}</div>
            <button class="copy-id-btn" type="button" onclick="copyBookingId(${booking.id})">Copy ID</button>
        </div>
        <div class="success-summary">
            <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
            <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
            <div><span>Duration</span><strong>${booking.durationDays} day${booking.durationDays === 1 ? "" : "s"}</strong></div>
            <div><span>Estimated total</span><strong>₹${Number(booking.totalAmount).toFixed(2)}</strong></div>
            <div><span>Status</span><strong class="status-${String(booking.status).toLowerCase()}">${escapeHtml(booking.status)}</strong></div>
        </div>
        <p>Save this Booking ID. Use it to check your status and show it at the shop after approval.</p>`;
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

async function checkBookingStatus(event) {
    if (event) event.preventDefault();

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
        const res = await fetch(`${BOOKING_API}/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await errorMessage(res));
        const booking = await res.json();
        result.innerHTML = `
            <div class="lookup-grid">
                <div><span>Booking</span><strong>#${booking.id}</strong></div>
                <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
                <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
                <div><span>Duration</span><strong>${booking.durationDays ?? "—"} day${booking.durationDays === 1 ? "" : "s"}</strong></div>
                <div><span>Total</span><strong>₹${Number(booking.totalAmount || 0).toFixed(2)}</strong></div>
                <div><span>Status</span><strong class="status-badge status-${String(booking.status).toLowerCase()}">${escapeHtml(booking.status)}</strong></div>
            </div>`;
        localStorage.setItem("lastBikeRentalBookingId", String(booking.id));
    } catch (error) {
        result.innerHTML = `<div class="lookup-error"><strong>Could not find booking #${id}.</strong><span>${escapeHtml(error.message)}</span></div>`;
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
    if (!document.querySelector(".modal.open")) {
        document.body.classList.remove("modal-open");
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

function wireValidationEvents() {
    document.getElementById("phone").addEventListener("input", event => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
        clearFieldError("phone");
    });

    document.getElementById("customerName").addEventListener("input", () => clearFieldError("customerName"));
    document.getElementById("pickupDate").addEventListener("change", () => clearFieldError("pickupDate"));
    document.getElementById("durationDays").addEventListener("input", () => {
        clearFieldError("durationDays");
        updateBookingEstimate();
    });
}

document.getElementById("bookingForm").addEventListener("submit", submitBooking);
document.getElementById("bookingLookupForm").addEventListener("submit", checkBookingStatus);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeBookingModal();
        closeSuccessModal();
    }
});

wireValidationEvents();

const savedBookingId = localStorage.getItem("lastBikeRentalBookingId");
if (savedBookingId) {
    document.getElementById("bookingLookupId").value = savedBookingId;
}

loadBikes();
