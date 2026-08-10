const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "bikeRentalAdminToken";

function setFieldError(id, message) {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    input.classList.add("input-error");
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
}
function clearFieldError(id) {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    input.classList.remove("input-error");
    input.removeAttribute("aria-invalid");
    error.textContent = "";
}
function setLoginError(message = "") {
    const box = document.getElementById("loginError");
    box.hidden = !message;
    box.textContent = message;
}
async function responseError(res) {
    try { const data = await res.json(); return data.message || data.error || "Login failed."; }
    catch { return "Invalid username or password."; }
}
async function login(event) {
    event.preventDefault();
    clearFieldError("username"); clearFieldError("password"); setLoginError();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    let firstInvalid = null;
    if (!username) { setFieldError("username", "Username is required."); firstInvalid = "username"; }
    if (!password) { setFieldError("password", "Password is required."); firstInvalid ??= "password"; }
    if (firstInvalid) { document.getElementById(firstInvalid).focus(); return; }

    const button = document.getElementById("loginButton");
    button.disabled = true; button.textContent = "Signing In…";
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) { setLoginError(await responseError(res)); return; }
        const auth = await res.json();
        if (!auth.token || auth.role !== "ADMIN") { setLoginError("Admin login response is invalid."); return; }
        localStorage.setItem(ADMIN_TOKEN_KEY, auth.token);
        window.location.href = "admin.html";
    } catch (error) {
        console.error(error);
        setLoginError("Backend is not reachable. Check the API URL and deployment status.");
    } finally {
        button.disabled = false; button.textContent = "Sign In";
    }
}

document.getElementById("loginForm").addEventListener("submit", login);
document.getElementById("username").addEventListener("input", () => { clearFieldError("username"); setLoginError(); });
document.getElementById("password").addEventListener("input", () => { clearFieldError("password"); setLoginError(); });
document.getElementById("togglePasswordButton").addEventListener("click", () => {
    const input = document.getElementById("password");
    const button = document.getElementById("togglePasswordButton");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Hide" : "Show";
    input.focus();
});
