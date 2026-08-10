const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const BIKE_API = `${API_BASE}/api/bikes`;
const BOOKING_API = `${API_BASE}/api/bookings`;

let editId = null;
let editImageUrl = "";
let bikesCache = [];

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
    const table = document.getElementById("bikeTable");
    try {
        const res = await fetch(BIKE_API);
        if (!res.ok) throw new Error(await errorMessage(res));
        bikesCache = await res.json();
        table.innerHTML = "";

        bikesCache.forEach(bike => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${bike.id}</td>
                <td>${escapeHtml(bike.name)}</td>
                <td>${escapeHtml(bike.type)}</td>
                <td>₹${Number(bike.pricePerDay).toFixed(2)}</td>
                <td><span class="status-pill ${bike.available ? "available" : "unavailable"}">${bike.available ? "Available" : "Unavailable"}</span></td>
                <td>${bike.imageUrl ? `<img src="${escapeHtml(imageSrc(bike.imageUrl))}" width="80" alt="${escapeHtml(bike.name)}">` : "No Image"}</td>
                <td class="action-cell">
                    <button onclick="editBike(${bike.id})">Edit</button>
                    <button class="danger-btn" onclick="deleteBike(${bike.id})">Delete</button>
                    ${bike.available
                        ? `<button class="danger-btn" onclick="makeUnavailable(${bike.id})">Offline Rent</button>`
                        : `<button class="warning-btn" onclick="makeAvailable(${bike.id})">Make Available</button>`}
                </td>`;
            table.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td colspan="7">Backend unavailable: ${escapeHtml(error.message)}</td></tr>`;
    }
}

async function addBike() {
    const name = document.getElementById("name").value.trim();
    const type = document.getElementById("type").value.trim();
    const price = Number(document.getElementById("price").value);
    const file = document.getElementById("image").files[0];

    if (!name || !type || !Number.isFinite(price) || price <= 0) {
        alert("Enter a valid bike name, type and price.");
        return;
    }

    try {
        let imageUrl = editImageUrl;

        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch(`${BIKE_API}/upload`, { method: "POST", body: formData });
            if (!uploadRes.ok) throw new Error(await errorMessage(uploadRes));
            imageUrl = `uploads/${await uploadRes.text()}`;
        }

        const bikeData = { name, type, pricePerDay: price, imageUrl };
        const url = editId ? `${BIKE_API}/${editId}` : BIKE_API;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bikeData)
        });
        if (!res.ok) throw new Error(await errorMessage(res));

        resetBikeForm();
        await loadBikes();
    } catch (error) {
        console.error(error);
        alert(`❌ ${error.message}`);
    }
}

function editBike(id) {
    const bike = bikesCache.find(item => item.id === id);
    if (!bike) return;

    document.getElementById("name").value = bike.name;
    document.getElementById("type").value = bike.type;
    document.getElementById("price").value = bike.pricePerDay;

    editId = bike.id;
    editImageUrl = bike.imageUrl || "";
    document.getElementById("formTitle").textContent = `Edit Bike #${bike.id}`;
    document.getElementById("saveBikeButton").textContent = "Update Bike";
    document.getElementById("cancelEditButton").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
    resetBikeForm();
}

function resetBikeForm() {
    editId = null;
    editImageUrl = "";
    document.getElementById("name").value = "";
    document.getElementById("type").value = "";
    document.getElementById("price").value = "";
    document.getElementById("image").value = "";
    document.getElementById("formTitle").textContent = "Add Bike";
    document.getElementById("saveBikeButton").textContent = "Save Bike";
    document.getElementById("cancelEditButton").hidden = true;
}

async function deleteBike(id) {
    if (!confirm("Delete this bike?")) return;
    try {
        const res = await fetch(`${BIKE_API}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await loadBikes();
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

async function makeAvailable(id) {
    if (!confirm("Make this bike available? Active approved booking will be completed; pending booking will be rejected.")) return;
    try {
        const res = await fetch(`${BIKE_API}/${id}/available`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await Promise.all([loadBikes(), loadBookings()]);
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

async function makeUnavailable(id) {
    if (!confirm("Mark this bike unavailable for an offline rental?")) return;
    try {
        const res = await fetch(`${BIKE_API}/${id}/unavailable`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await loadBikes();
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

async function loadBookings() {
    const table = document.getElementById("bookingTable");
    try {
        const res = await fetch(BOOKING_API);
        if (!res.ok) throw new Error(await errorMessage(res));
        const data = await res.json();
        table.innerHTML = "";

        data.forEach(b => {
            let actions = "—";
            if (b.status === "PENDING") {
                actions = `<button onclick="approveBooking(${b.id})">✅ Approve</button><button class="danger-btn" onclick="rejectBooking(${b.id})">❌ Reject</button>`;
            } else if (b.status === "APPROVED") {
                actions = `<span class="approved-text">Approved</span>`;
            } else if (b.status === "REJECTED") {
                actions = `<span class="rejected-text">Rejected</span>`;
            } else if (b.status === "COMPLETED") {
                actions = `<span class="completed-text">Completed</span>`;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${b.id}</td>
                <td>${escapeHtml(b.customerName)}</td>
                <td>${escapeHtml(b.phone)}</td>
                <td>${escapeHtml(b.bikeName)}</td>
                <td>${escapeHtml(b.date)}</td>
                <td>${b.durationDays ?? "—"}</td>
                <td>₹${Number(b.totalAmount || 0).toFixed(2)}</td>
                <td>${escapeHtml(b.status)}</td>
                <td>${actions}</td>`;
            table.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`;
    }
}

function toggleBookingPanel() {
    document.getElementById("bookingPanel").classList.toggle("active");
    loadBookings();
}

async function approveBooking(id) {
    try {
        const res = await fetch(`${BOOKING_API}/${id}/approve`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

async function rejectBooking(id) {
    try {
        const res = await fetch(`${BOOKING_API}/${id}/reject`, { method: "PUT" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

async function clearBookings() {
    if (!confirm("⚠️ Delete all bookings? Bikes held by these bookings will become available.")) return;
    try {
        const res = await fetch(`${BOOKING_API}/clear`, { method: "DELETE" });
        if (!res.ok) throw new Error(await errorMessage(res));
        await Promise.all([loadBookings(), loadBikes()]);
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

function logout() {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login.html";
}

loadBikes();
loadBookings();
