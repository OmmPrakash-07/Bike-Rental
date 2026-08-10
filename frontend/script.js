const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const BOOKING_API = `${API_BASE}/api/bookings`;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const ADMIN_TOKEN_KEY = "bikeRentalAdminToken";

function adminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

async function adminFetch(url, options = {}) {
    const token = adminToken();
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        window.location.href = "login.html";
    }
    return response;
}

let editId = null;
let editImageUrl = "";
let bikesCache = [];
let bookingsCache = [];
let previewObjectUrl = null;

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

function clearFieldError(id) {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    if (input) {
        input.classList.remove("input-error");
        input.removeAttribute("aria-invalid");
    }
    if (error) error.textContent = "";
}

function setFieldError(id, message) {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    if (input) {
        input.classList.add("input-error");
        input.setAttribute("aria-invalid", "true");
    }
    if (error) error.textContent = message;
}

function validateBikeForm() {
    ["name", "type", "price", "image"].forEach(clearFieldError);

    const name = document.getElementById("name").value.trim().replace(/\s+/g, " ");
    const type = document.getElementById("type").value.trim().replace(/\s+/g, " ");
    const price = Number(document.getElementById("price").value);
    const file = document.getElementById("image").files[0];
    let firstInvalid = null;

    if (name.length < 2) {
        setFieldError("name", "Vehicle name must be at least 2 characters.");
        firstInvalid ??= "name";
    } else if (name.length > 80) {
        setFieldError("name", "Vehicle name must be 80 characters or fewer.");
        firstInvalid ??= "name";
    }

    if (!type) {
        setFieldError("type", "Vehicle type is required.");
        firstInvalid ??= "type";
    } else if (type.length > 30) {
        setFieldError("type", "Vehicle type must be 30 characters or fewer.");
        firstInvalid ??= "type";
    }

    if (!Number.isFinite(price) || price <= 0) {
        setFieldError("price", "Enter a price greater than ₹0.");
        firstInvalid ??= "price";
    } else if (price > 1000000) {
        setFieldError("price", "Price per day looks too high. Maximum is ₹10,00,000.");
        firstInvalid ??= "price";
    }

    if (file) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setFieldError("image", "Choose a JPG, PNG, WEBP or GIF image.");
            firstInvalid ??= "image";
        } else if (file.size > MAX_IMAGE_BYTES) {
            setFieldError("image", "Image must be 5 MB or smaller.");
            firstInvalid ??= "image";
        }
    }

    if (firstInvalid) {
        document.getElementById(firstInvalid).focus();
        return null;
    }

    return { name, type, price, file };
}

function updateStats() {
    const available = bikesCache.filter(bike => bike.available).length;
    const pending = bookingsCache.filter(booking => booking.status === "PENDING").length;

    document.getElementById("totalBikeCount").textContent = bikesCache.length;
    document.getElementById("availableBikeCount").textContent = available;
    document.getElementById("unavailableBikeCount").textContent = bikesCache.length - available;
    document.getElementById("pendingBookingCount").textContent = pending;

    const badge = document.getElementById("pendingBookingBadge");
    badge.textContent = pending;
    badge.hidden = pending === 0;
}

function renderBikes() {
    const table = document.getElementById("bikeTable");
    const query = document.getElementById("bikeSearch").value.trim().toLowerCase();
    const filter = document.getElementById("availabilityFilter").value;

    const filtered = bikesCache.filter(bike => {
        const matchesSearch = !query || [bike.id, bike.name, bike.type]
            .some(value => String(value ?? "").toLowerCase().includes(query));
        const matchesStatus = filter === "ALL"
            || (filter === "AVAILABLE" && bike.available)
            || (filter === "UNAVAILABLE" && !bike.available);
        return matchesSearch && matchesStatus;
    });

    table.innerHTML = "";

    if (!filtered.length) {
        table.innerHTML = `<tr><td class="empty-row" colspan="7">No vehicles match this filter.</td></tr>`;
        return;
    }

    filtered.forEach(bike => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="id-chip">#${bike.id}</span></td>
            <td><strong>${escapeHtml(bike.name)}</strong></td>
            <td>${escapeHtml(bike.type)}</td>
            <td>₹${Number(bike.pricePerDay).toFixed(2)}</td>
            <td><span class="status-pill ${bike.available ? "available" : "unavailable"}">${bike.available ? "Available" : "Unavailable"}</span></td>
            <td>${bike.imageUrl
                ? `<img class="table-bike-image" src="${escapeHtml(imageSrc(bike.imageUrl))}" alt="${escapeHtml(bike.name)}">`
                : `<span class="no-image">No image</span>`}</td>
            <td class="action-cell">
                <button class="table-btn" type="button" onclick="editBike(${bike.id})">Edit</button>
                <button class="table-btn danger" type="button" onclick="deleteBike(${bike.id})">Delete</button>
                ${bike.available
                    ? `<button class="table-btn danger-soft" type="button" onclick="makeUnavailable(${bike.id})">Offline Rent</button>`
                    : `<button class="table-btn warning" type="button" onclick="makeAvailable(${bike.id})">Make Available</button>`}
            </td>`;
        table.appendChild(row);
    });
}

async function loadBikes() {
    const table = document.getElementById("bikeTable");
    table.innerHTML = `<tr><td class="empty-row" colspan="7">Loading vehicles…</td></tr>`;
    try {
        const res = await adminFetch(BIKE_API, { cache: "no-store" });
        if (!res.ok) throw new Error(await errorMessage(res));
        bikesCache = await res.json();
        renderBikes();
        updateStats();
    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td class="empty-row error-text" colspan="7">Backend unavailable: ${escapeHtml(error.message)}</td></tr>`;
    }
}

async function saveBike(event) {
    event.preventDefault();
    const values = validateBikeForm();
    if (!values) return;

    const button = document.getElementById("saveBikeButton");
    const normalText = editId ? "Update Bike" : "Save Bike";
    setButtonLoading(button, true, editId ? "Updating…" : "Saving…", normalText);

    try {
        let imageUrl = editImageUrl;

        if (values.file) {
            const formData = new FormData();
            formData.append("file", values.file);
            const uploadRes = await adminFetch(`${BIKE_API}/upload`, { method: "POST", body: formData });
            if (!uploadRes.ok) throw new Error(await errorMessage(uploadRes));
            imageUrl = `uploads/${await uploadRes.text()}`;
        }

        const bikeData = {
            name: values.name,
            type: values.type,
            pricePerDay: values.price,
            imageUrl
        };
        const url = editId ? `${BIKE_API}/${editId}` : BIKE_API;
        const method = editId ? "PUT" : "POST";

        const res = await adminFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bikeData)
        });
        if (!res.ok) throw new Error(await errorMessage(res));

        showToast(editId ? "Vehicle updated successfully." : "Vehicle added successfully.");
        resetBikeForm();
        await loadBikes();
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        setButtonLoading(button, false, editId ? "Updating…" : "Saving…", editId ? "Update Bike" : "Save Bike");
    }
}

function editBike(id) {
    const bike = bikesCache.find(item => item.id === id);
    if (!bike) return;

    ["name", "type", "price", "image"].forEach(clearFieldError);
    document.getElementById("name").value = bike.name;
    document.getElementById("type").value = bike.type;
    document.getElementById("price").value = bike.pricePerDay;
    document.getElementById("image").value = "";

    editId = bike.id;
    editImageUrl = bike.imageUrl || "";
    document.getElementById("formTitle").textContent = `Edit Bike #${bike.id}`;
    document.getElementById("saveBikeButton").textContent = "Update Bike";
    document.getElementById("cancelEditButton").hidden = false;

    if (bike.imageUrl) {
        showImagePreview(imageSrc(bike.imageUrl), `Current image for ${bike.name}`);
    } else {
        hideImagePreview();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("name").focus(), 250);
}

function cancelEdit() {
    resetBikeForm();
}

function resetBikeForm() {
    editId = null;
    editImageUrl = "";
    document.getElementById("bikeForm").reset();
    document.getElementById("formTitle").textContent = "Add Bike";
    document.getElementById("saveBikeButton").textContent = "Save Bike";
    document.getElementById("cancelEditButton").hidden = true;
    ["name", "type", "price", "image"].forEach(clearFieldError);
    hideImagePreview();
}

function showImagePreview(src, text) {
    const wrap = document.getElementById("imagePreviewWrap");
    document.getElementById("imagePreview").src = src;
    document.getElementById("imagePreviewText").textContent = text;
    wrap.hidden = false;
}

function hideImagePreview() {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
    const wrap = document.getElementById("imagePreviewWrap");
    wrap.hidden = true;
    document.getElementById("imagePreview").removeAttribute("src");
    document.getElementById("imagePreviewText").textContent = "";
}

function handleImageChange(event) {
    clearFieldError("image");
    const file = event.target.files[0];
    if (!file) {
        if (editImageUrl) showImagePreview(imageSrc(editImageUrl), "Current vehicle image");
        else hideImagePreview();
        return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setFieldError("image", "Choose a JPG, PNG, WEBP or GIF image.");
        event.target.value = "";
        hideImagePreview();
        return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
        setFieldError("image", "Image must be 5 MB or smaller.");
        event.target.value = "";
        hideImagePreview();
        return;
    }

    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    showImagePreview(previewObjectUrl, `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`);
}

async function deleteBike(id) {
    const bike = bikesCache.find(item => item.id === id);
    if (!confirm(`Delete ${bike?.name || `bike #${id}`}? This cannot be undone.`)) return;
    try {
        const res = await adminFetch(`${BIKE_API}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast("Vehicle deleted.");
        if (editId === id) resetBikeForm();
        await loadBikes();
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function makeAvailable(id) {
    if (!confirm("Make this bike available? An approved booking will be completed; a pending booking will be rejected.")) return;
    try {
        const res = await adminFetch(`${BIKE_API}/${id}/available`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast("Vehicle is available again.");
        await Promise.all([loadBikes(), loadBookings()]);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function makeUnavailable(id) {
    if (!confirm("Mark this vehicle unavailable for an offline rental?")) return;
    try {
        const res = await adminFetch(`${BIKE_API}/${id}/unavailable`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast("Vehicle marked unavailable.");
        await loadBikes();
    } catch (error) {
        showToast(error.message, "error");
    }
}

function bookingStatusClass(status) {
    return String(status || "").toLowerCase();
}

function renderBookings() {
    const table = document.getElementById("bookingTable");
    const query = document.getElementById("bookingSearch").value.trim().toLowerCase();
    const filter = document.getElementById("bookingStatusFilter").value;

    const filtered = bookingsCache.filter(b => {
        const matchesSearch = !query || [b.id, b.customerName, b.phone, b.bikeName]
            .some(value => String(value ?? "").toLowerCase().includes(query));
        const matchesStatus = filter === "ALL" || b.status === filter;
        return matchesSearch && matchesStatus;
    });

    table.innerHTML = "";
    if (!filtered.length) {
        table.innerHTML = `<tr><td class="empty-row" colspan="9">No bookings match this filter.</td></tr>`;
        return;
    }

    filtered.forEach(b => {
        let actions = "—";
        if (b.status === "PENDING") {
            actions = `<div class="booking-actions"><button class="table-btn success" type="button" onclick="approveBooking(${b.id})">Approve</button><button class="table-btn danger" type="button" onclick="rejectBooking(${b.id})">Reject</button></div>`;
        }

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="id-chip">#${b.id}</span></td>
            <td><strong>${escapeHtml(b.customerName)}</strong></td>
            <td>${escapeHtml(b.phone)}</td>
            <td>${escapeHtml(b.bikeName)}</td>
            <td>${escapeHtml(b.date)}</td>
            <td>${b.durationDays ?? "—"}</td>
            <td>₹${Number(b.totalAmount || 0).toFixed(2)}</td>
            <td><span class="booking-status ${bookingStatusClass(b.status)}">${escapeHtml(b.status)}</span></td>
            <td>${actions}</td>`;
        table.appendChild(row);
    });
}

async function loadBookings() {
    const table = document.getElementById("bookingTable");
    table.innerHTML = `<tr><td class="empty-row" colspan="9">Loading bookings…</td></tr>`;
    try {
        const res = await adminFetch(BOOKING_API, { cache: "no-store" });
        if (!res.ok) throw new Error(await errorMessage(res));
        bookingsCache = await res.json();
        renderBookings();
        updateStats();
    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td class="empty-row error-text" colspan="9">${escapeHtml(error.message)}</td></tr>`;
    }
}

function toggleBookingPanel(forceOpen) {
    const panel = document.getElementById("bookingPanel");
    const backdrop = document.getElementById("panelBackdrop");
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !panel.classList.contains("active");

    panel.classList.toggle("active", shouldOpen);
    backdrop.classList.toggle("active", shouldOpen);
    panel.setAttribute("aria-hidden", String(!shouldOpen));
    document.body.classList.toggle("panel-open", shouldOpen);
    if (shouldOpen) loadBookings();
}

async function approveBooking(id) {
    if (!confirm(`Approve booking #${id}?`)) return;
    try {
        const res = await adminFetch(`${BOOKING_API}/${id}/approve`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast(`Booking #${id} approved.`);
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function rejectBooking(id) {
    if (!confirm(`Reject booking #${id}? The vehicle will become available again.`)) return;
    try {
        const res = await adminFetch(`${BOOKING_API}/${id}/reject`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast(`Booking #${id} rejected.`, "info");
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function clearBookings() {
    if (!confirm("Delete ALL booking history? Active vehicles held by bookings will be released. This cannot be undone.")) return;
    try {
        const res = await adminFetch(`${BOOKING_API}/clear`, { method: "DELETE" });
        if (!res.ok) throw new Error(await errorMessage(res));
        showToast("All bookings cleared.", "info");
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function refreshAdminData() {
    const button = document.getElementById("refreshAdminButton");
    setButtonLoading(button, true, "Refreshing…", "↻ Refresh");
    await Promise.all([loadBikes(), loadBookings()]);
    setButtonLoading(button, false, "Refreshing…", "↻ Refresh");
}

function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = "login.html";
}

document.getElementById("bikeForm").addEventListener("submit", saveBike);
document.getElementById("image").addEventListener("change", handleImageChange);
document.getElementById("bikeSearch").addEventListener("input", renderBikes);
document.getElementById("availabilityFilter").addEventListener("change", renderBikes);
document.getElementById("bookingSearch").addEventListener("input", renderBookings);
document.getElementById("bookingStatusFilter").addEventListener("change", renderBookings);
["name", "type", "price"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => clearFieldError(id));
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("bookingPanel").classList.contains("active")) {
        toggleBookingPanel(false);
    }
});

Promise.all([loadBikes(), loadBookings()]);
