const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");

async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Enter username and password.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const result = await res.text();

        if (res.ok && result === "SUCCESS") {
            localStorage.setItem("isLoggedIn", "true");
            window.location.href = "index.html";
        } else {
            alert("❌ Invalid username or password");
        }
    } catch (err) {
        console.error(err);
        alert("⚠️ Backend is not reachable. Check config.js and make sure the server is running.");
    }
}

document.addEventListener("keydown", event => {
    if (event.key === "Enter") login();
});
