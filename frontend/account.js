const API_BASE = window.BIKE_RENTAL_CONFIG.API_BASE_URL.replace(/\/$/, "");
const AUTH_API = `${API_BASE}/api/user-auth`;
const USER_API = `${API_BASE}/api/users/me`;
const TOKEN_KEY = "bikeRentalUserToken";
const PROFILE_KEY = "bikeRentalUserProfile";

let pendingOtpEmail = "";
let resendTimerId = null;

function errorMessage(res) {
    return res.json()
        .then(data => data.message || data.error || `Request failed (${res.status})`)
        .catch(() => `Request failed (${res.status})`);
}

function fieldError(id, message = "") {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    if (input) input.classList.toggle("input-error", Boolean(message));
    if (error) error.textContent = message;
}

function authError(message = "", type = "error") {
    const box = document.getElementById("authError");
    box.hidden = !message;
    box.textContent = message;
    box.classList.toggle("success", type === "success");
}

function saveSession(auth) {
    localStorage.setItem(TOKEN_KEY, auth.token);
    if (auth.user) localStorage.setItem(PROFILE_KEY, JSON.stringify(auth.user));
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
}

function hideOtpPanel() {
    document.getElementById("emailOtpPanel").hidden = true;
    document.getElementById("authTabs").hidden = false;
    pendingOtpEmail = "";
    if (resendTimerId) clearInterval(resendTimerId);
    resendTimerId = null;
}

function setMode(mode) {
    hideOtpPanel();
    const signup = mode === "signup";
    document.getElementById("userLoginForm").hidden = signup;
    document.getElementById("userSignupForm").hidden = !signup;
    document.getElementById("loginTab").classList.toggle("active", !signup);
    document.getElementById("signupTab").classList.toggle("active", signup);
    document.getElementById("loginTab").setAttribute("aria-selected", String(!signup));
    document.getElementById("signupTab").setAttribute("aria-selected", String(signup));
    authError();
}

function startResendCountdown(seconds = 60) {
    if (resendTimerId) clearInterval(resendTimerId);
    const button = document.getElementById("resendOtpButton");
    const hint = document.getElementById("resendOtpHint");
    let remaining = Math.max(0, Number(seconds) || 0);

    const render = () => {
        button.disabled = remaining > 0;
        hint.textContent = remaining > 0 ? `Resend available in ${remaining}s` : "Didn't receive it?";
    };

    render();
    if (remaining <= 0) return;

    resendTimerId = setInterval(() => {
        remaining -= 1;
        render();
        if (remaining <= 0) {
            clearInterval(resendTimerId);
            resendTimerId = null;
        }
    }, 1000);
}

function showOtpPanel(email, resendAfterSeconds = 60, message = "") {
    pendingOtpEmail = email.trim().toLowerCase();
    document.getElementById("authTabs").hidden = true;
    document.getElementById("userLoginForm").hidden = true;
    document.getElementById("userSignupForm").hidden = true;
    document.getElementById("emailOtpPanel").hidden = false;
    document.getElementById("otpEmailDisplay").textContent = pendingOtpEmail;
    document.getElementById("emailOtp").value = "";
    fieldError("emailOtp");
    authError(message);
    startResendCountdown(resendAfterSeconds);
    setTimeout(() => document.getElementById("emailOtp").focus(), 50);
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

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        fieldError("loginEmail", "Enter a valid email address.");
        invalid = true;
    }
    if (!password) {
        fieldError("loginPassword", "Password is required.");
        invalid = true;
    }
    if (invalid) return;

    const button = document.getElementById("userLoginButton");
    button.disabled = true;
    button.textContent = "Signing in…";

    try {
        const res = await fetch(`${AUTH_API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const message = await errorMessage(res);
            if (res.status === 403 && message.toLowerCase().includes("verification")) {
                showOtpPanel(email, 0, "Your email is not verified. Request a new code to continue.");
                return;
            }
            throw new Error(message);
        }

        saveSession(await res.json());
        redirectAfterAuth();
    } catch (error) {
        authError(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Login";
    }
}

async function signup(event) {
    event.preventDefault();
    authError();
    ["signupName", "signupEmail", "signupPhone", "signupPassword", "signupConfirmPassword"].forEach(id => fieldError(id));

    const fullName = document.getElementById("signupName").value.trim().replace(/\s+/g, " ");
    const email = document.getElementById("signupEmail").value.trim();
    const phone = document.getElementById("signupPhone").value.replace(/\D/g, "");
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirmPassword").value;
    let invalid = false;

    if (fullName.length < 2 || fullName.length > 80) {
        fieldError("signupName", "Enter a valid full name.");
        invalid = true;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        fieldError("signupEmail", "Enter a valid email address.");
        invalid = true;
    }
    if (!/^\d{10}$/.test(phone)) {
        fieldError("signupPhone", "Enter exactly 10 digits.");
        invalid = true;
    }
    if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        fieldError("signupPassword", "Use 8–72 characters with a letter and a number.");
        invalid = true;
    }
    if (password !== confirm) {
        fieldError("signupConfirmPassword", "Passwords do not match.");
        invalid = true;
    }
    if (invalid) return;

    const button = document.getElementById("userSignupButton");
    button.disabled = true;
    button.textContent = "Sending OTP…";

    try {
        const res = await fetch(`${AUTH_API}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email, phone, password })
        });
        if (!res.ok) throw new Error(await errorMessage(res));

        const challenge = await res.json();
        showOtpPanel(challenge.email || email, challenge.resendAfterSeconds || 60);
    } catch (error) {
        authError(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Create Account";
    }
}

async function verifyEmail(event) {
    event.preventDefault();
    authError();
    fieldError("emailOtp");

    const otp = document.getElementById("emailOtp").value.replace(/\D/g, "");
    if (!/^\d{6}$/.test(otp)) {
        fieldError("emailOtp", "Enter the 6-digit code.");
        return;
    }
    if (!pendingOtpEmail) {
        authError("Verification session expired. Return to login and request a new code.");
        return;
    }

    const button = document.getElementById("verifyEmailButton");
    button.disabled = true;
    button.textContent = "Verifying…";

    try {
        const res = await fetch(`${AUTH_API}/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail, otp })
        });
        if (!res.ok) throw new Error(await errorMessage(res));

        saveSession(await res.json());
        redirectAfterAuth();
    } catch (error) {
        authError(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Verify Email";
    }
}

async function resendOtp() {
    if (!pendingOtpEmail) return;

    const button = document.getElementById("resendOtpButton");
    button.disabled = true;
    button.textContent = "Sending…";
    authError();

    try {
        const res = await fetch(`${AUTH_API}/resend-email-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingOtpEmail })
        });
        if (!res.ok) throw new Error(await errorMessage(res));

        const challenge = await res.json();
        authError("A new verification code has been sent.", "success");
        startResendCountdown(challenge.resendAfterSeconds || 60);
    } catch (error) {
        authError(error.message);
        button.disabled = false;
    } finally {
        button.textContent = "Resend code";
    }
}

async function showExistingSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
        const res = await fetch(USER_API, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store"
        });
        if (!res.ok) throw new Error();

        const profile = await res.json();
        document.getElementById("authForms").hidden = true;
        document.getElementById("signedInPanel").hidden = false;
        document.getElementById("signedInName").textContent = profile.fullName;
        document.getElementById("signedInEmail").textContent = `${profile.email} • +91 ${profile.phone}`;
    } catch {
        clearSession();
    }
}

document.getElementById("loginTab").addEventListener("click", () => setMode("login"));
document.getElementById("signupTab").addEventListener("click", () => setMode("signup"));
document.getElementById("userLoginForm").addEventListener("submit", login);
document.getElementById("userSignupForm").addEventListener("submit", signup);
document.getElementById("emailOtpForm").addEventListener("submit", verifyEmail);
document.getElementById("resendOtpButton").addEventListener("click", resendOtp);
document.getElementById("backToLoginButton").addEventListener("click", () => setMode("login"));

document.getElementById("signupPhone").addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
    fieldError("signupPhone");
});

document.getElementById("emailOtp").addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
    fieldError("emailOtp");
});

document.querySelectorAll("[data-password-target]").forEach(button => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordTarget);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Hide" : "Show";
}));

document.querySelectorAll("input").forEach(input => input.addEventListener("input", () => fieldError(input.id)));
document.getElementById("accountLogoutButton").addEventListener("click", () => {
    clearSession();
    window.location.reload();
});

const mode = new URLSearchParams(window.location.search).get("mode");
setMode(mode === "signup" ? "signup" : "login");
showExistingSession();
