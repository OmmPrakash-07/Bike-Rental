const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const AUTH_API = `${API_BASE}/api/user-auth`;
const USER_API = `${API_BASE}/api/users/me`;
const TOKEN_KEY = "bikeRentalUserToken";
const PROFILE_KEY = "bikeRentalUserProfile";

function errorMessage(res) {
    return res.json().then(data => data.message || data.error || `Request failed (${res.status})`).catch(() => `Request failed (${res.status})`);
}
function fieldError(id, message = "") {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    if (input) input.classList.toggle("input-error", Boolean(message));
    if (error) error.textContent = message;
}
function authError(message = "") {
    const box = document.getElementById("authError");
    box.hidden = !message;
    box.textContent = message;
}
function saveSession(auth) {
    localStorage.setItem(TOKEN_KEY, auth.token);
    if (auth.user) localStorage.setItem(PROFILE_KEY, JSON.stringify(auth.user));
}
function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
}
function setMode(mode) {
    const signup = mode === "signup";
    document.getElementById("userLoginForm").hidden = signup;
    document.getElementById("userSignupForm").hidden = !signup;
    document.getElementById("loginTab").classList.toggle("active", !signup);
    document.getElementById("signupTab").classList.toggle("active", signup);
    document.getElementById("loginTab").setAttribute("aria-selected", String(!signup));
    document.getElementById("signupTab").setAttribute("aria-selected", String(signup));
    authError();
}
function redirectAfterAuth() {
    const target = localStorage.getItem("bikeRentalReturnTo") || "/";
    localStorage.removeItem("bikeRentalReturnTo");
    window.location.href = target.startsWith("#") ? `/${target}` : target;
}
async function login(event) {
    event.preventDefault();
    authError();
    ["loginEmail", "loginPassword"].forEach(id => fieldError(id));
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    let invalid = false;
    if (!/^\S+@\S+\.\S+$/.test(email)) { fieldError("loginEmail", "Enter a valid email address."); invalid = true; }
    if (!password) { fieldError("loginPassword", "Password is required."); invalid = true; }
    if (invalid) return;
    const button = document.getElementById("userLoginButton");
    button.disabled = true; button.textContent = "Signing in…";
    try {
        const res = await fetch(`${AUTH_API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        if (!res.ok) throw new Error(await errorMessage(res));
        saveSession(await res.json());
        redirectAfterAuth();
    } catch (error) { authError(error.message); }
    finally { button.disabled = false; button.textContent = "Login"; }
}
async function signup(event) {
    event.preventDefault();
    authError();
    ["signupName","signupEmail","signupPhone","signupPassword","signupConfirmPassword"].forEach(id => fieldError(id));
    const fullName = document.getElementById("signupName").value.trim().replace(/\s+/g," ");
    const email = document.getElementById("signupEmail").value.trim();
    const phone = document.getElementById("signupPhone").value.replace(/\D/g,"");
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirmPassword").value;
    let invalid = false;
    if (fullName.length < 2 || fullName.length > 80) { fieldError("signupName", "Enter a valid full name."); invalid = true; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { fieldError("signupEmail", "Enter a valid email address."); invalid = true; }
    if (!/^\d{10}$/.test(phone)) { fieldError("signupPhone", "Enter exactly 10 digits."); invalid = true; }
    if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { fieldError("signupPassword", "Use 8–72 characters with a letter and a number."); invalid = true; }
    if (password !== confirm) { fieldError("signupConfirmPassword", "Passwords do not match."); invalid = true; }
    if (invalid) return;
    const button = document.getElementById("userSignupButton");
    button.disabled = true; button.textContent = "Creating account…";
    try {
        const res = await fetch(`${AUTH_API}/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email, phone, password }) });
        if (!res.ok) throw new Error(await errorMessage(res));
        saveSession(await res.json());
        redirectAfterAuth();
    } catch (error) { authError(error.message); }
    finally { button.disabled = false; button.textContent = "Create Account"; }
}
async function showExistingSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
        const res = await fetch(USER_API, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!res.ok) throw new Error();
        const profile = await res.json();
        document.getElementById("authForms").hidden = true;
        document.getElementById("signedInPanel").hidden = false;
        document.getElementById("signedInName").textContent = profile.fullName;
        document.getElementById("signedInEmail").textContent = `${profile.email} • +91 ${profile.phone}`;
    } catch { clearSession(); }
}
document.getElementById("loginTab").addEventListener("click", () => setMode("login"));
document.getElementById("signupTab").addEventListener("click", () => setMode("signup"));
document.getElementById("userLoginForm").addEventListener("submit", login);
document.getElementById("userSignupForm").addEventListener("submit", signup);
document.getElementById("signupPhone").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g,"").slice(0,10); fieldError("signupPhone"); });
document.querySelectorAll("[data-password-target]").forEach(button => button.addEventListener("click", () => { const input = document.getElementById(button.dataset.passwordTarget); const show = input.type === "password"; input.type = show ? "text" : "password"; button.textContent = show ? "Hide" : "Show"; }));
document.querySelectorAll("input").forEach(input => input.addEventListener("input", () => fieldError(input.id)));
document.getElementById("accountLogoutButton").addEventListener("click", () => { clearSession(); window.location.reload(); });
const mode = new URLSearchParams(window.location.search).get("mode");
setMode(mode === "signup" ? "signup" : "login");
showExistingSession();
