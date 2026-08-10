const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const BOOKING_API = `${API_BASE}/api/bookings`;

let bikes = [];
let selectedBike = null;

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

async function errorMessage(res) {
    try {
        const data = await res.json();
        return data.message || data.error || `Request failed (${res.status})`;
    } catch {
        const text = await res.text();
        return text || `Request failed (${res.status})`;
    }
}

async function loadBikes() {
    const container = document.getElementById("bikeContainer");
    container.innerHTML = `<div class="loading-card">Loading vehicles…</div>`;

    try {
        const res = await fetch(BIKE_API);
        if (!res.ok) throw new Error(await errorMessage(res));
        bikes = await res.json();
        container.innerHTML = "";

        if (!bikes.length) {
            container.innerHTML = `<div class="empty-state">No vehicles have been added yet.</div>`;
            return;
        }

        bikes.forEach((bike, index) => {
            const card = document.createElement("article");
            card.className = `card reveal delay-${Math.min(index + 1, 4)}`;
            const image = bike.imageUrl
                ? `<img src="${escapeHtml(imageSrc(bike.imageUrl))}" alt="${escapeHtml(bike.name)}">`
                : `<div class="image-placeholder">🏍️</div>`;

            card.innerHTML = `
                <span class="badge ${bike.available ? "available" : "unavailable"}">${bike.available ? "Available" : "Unavailable"}</span>
                ${image}
                <div class="card-body">
                    <div class="card-name">${escapeHtml(bike.name)}</div>
                    <p>${escapeHtml(bike.type)}</p>
                    <div class="card-price"><strong>₹${Number(bike.pricePerDay).toFixed(0)}</strong> / day</div>
                    <button class="${bike.available ? "btn-primary" : ""}" ${bike.available ? `onclick="openBookingModal(${bike.id})"` : "disabled"}>
                        ${bike.available ? "Book Now" : "Currently Unavailable"}
                    </button>
                </div>`;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="empty-state error-state">Could not reach the backend.<br><small>${escapeHtml(error.message)}</small></div>`;
    }
}

function openBookingModal(bikeId) {
    selectedBike = bikes.find(bike => bike.id === bikeId);
    if (!selectedBike || !selectedBike.available) return;

    document.getElementById("selectedBikeId").value = selectedBike.id;
    document.getElementById("selectedBikeSummary").textContent = `${selectedBike.name} • ₹${Number(selectedBike.pricePerDay).toFixed(0)}/day`;
    document.getElementById("durationDays").value = 1;

    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    document.getElementById("pickupDate").min = localDate;
    document.getElementById("pickupDate").value = localDate;

    updateBookingEstimate();
    showModal("bookingModal");
}

function closeBookingModal() {
    hideModal("bookingModal");
}

function updateBookingEstimate() {
    if (!selectedBike) return;
    const days = Math.max(1, Number(document.getElementById("durationDays").value) || 1);
    const total = Number(selectedBike.pricePerDay) * days;
    document.getElementById("bookingEstimate").innerHTML = `Estimated rental: <strong>₹${total.toFixed(2)}</strong> for ${days} day${days === 1 ? "" : "s"}`;
}

async function submitBooking(event) {
    event.preventDefault();
    if (!selectedBike) return;

    const customerName = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const date = document.getElementById("pickupDate").value;
    const durationDays = Number(document.getElementById("durationDays").value);
    const button = document.getElementById("submitBookingButton");

    if (!/^\d{10}$/.test(phone)) {
        alert("Enter a valid 10-digit phone number.");
        return;
    }

    button.disabled = true;
    button.textContent = "Sending…";

    try {
        const res = await fetch(BOOKING_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customerName,
                phone,
                bikeId: selectedBike.id,
                date,
                durationDays
            })
        });

        if (!res.ok) throw new Error(await errorMessage(res));
        const booking = await res.json();

        closeBookingModal();
        document.getElementById("bookingForm").reset();
        showBookingSuccess(booking);
        await loadBikes();
    } catch (error) {
        alert(`❌ ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = "Send Booking Request";
    }
}

function showBookingSuccess(booking) {
    document.getElementById("successDetails").innerHTML = `
        <p class="booking-id-label">Your Booking ID</p>
        <div class="booking-id">#${booking.id}</div>
        <div class="success-summary">
            <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
            <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
            <div><span>Duration</span><strong>${booking.durationDays} day${booking.durationDays === 1 ? "" : "s"}</strong></div>
            <div><span>Estimated total</span><strong>₹${Number(booking.totalAmount).toFixed(2)}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(booking.status)}</strong></div>
        </div>
        <p>Save this Booking ID. You can use it to check status and show it at the shop after approval.</p>`;
    showModal("successModal");
}

function closeSuccessModal() {
    hideModal("successModal");
}

async function checkBookingStatus() {
    const id = Number(document.getElementById("bookingLookupId").value);
    const result = document.getElementById("bookingLookupResult");

    if (!Number.isInteger(id) || id <= 0) {
        alert("Enter a valid Booking ID.");
        return;
    }

    result.hidden = false;
    result.innerHTML = "Checking…";

    try {
        const res = await fetch(`${BOOKING_API}/${id}`);
        if (!res.ok) throw new Error(await errorMessage(res));
        const booking = await res.json();
        result.innerHTML = `
            <div class="lookup-grid">
                <div><span>Booking</span><strong>#${booking.id}</strong></div>
                <div><span>Bike</span><strong>${escapeHtml(booking.bikeName)}</strong></div>
                <div><span>Pickup</span><strong>${escapeHtml(booking.date)}</strong></div>
                <div><span>Status</span><strong class="status-${String(booking.status).toLowerCase()}">${escapeHtml(booking.status)}</strong></div>
            </div>`;
    } catch (error) {
        result.innerHTML = `<span class="lookup-error">${escapeHtml(error.message)}</span>`;
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
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal.open")) {
        document.body.classList.remove("modal-open");
    }
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeBookingModal();
        closeSuccessModal();
    }
});

loadBikes();
