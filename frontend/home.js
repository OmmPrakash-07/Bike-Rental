const HOME_USER_TOKEN_KEY = "bikeRentalUserToken";
const HOME_USER_PROFILE_KEY = "bikeRentalUserProfile";

function homeReadProfile() {
  try {
    const raw = localStorage.getItem(HOME_USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function homeUpdateAccountUi() {
  const token = localStorage.getItem(HOME_USER_TOKEN_KEY) || "";
  const user = token ? homeReadProfile() : null;

  const accountLink = document.getElementById("accountLink");
  const userMenu = document.getElementById("userMenu");
  const userAvatar = document.getElementById("userAvatar");
  const userMenuName = document.getElementById("userMenuName");
  const mobileUserSummary = document.getElementById("mobileUserSummary");
  const mobileUserAvatar = document.getElementById("mobileUserAvatar");
  const mobileUserName = document.getElementById("mobileUserName");
  const mobileAccountLink = document.getElementById("mobileAccountLink");
  const mobileProfileLink = document.getElementById("mobileProfileLink");
  const mobileLogoutButton = document.getElementById("mobileLogoutButton");

  if (token && user) {
    const fullName = String(user.fullName || "User").trim() || "User";
    const names = fullName.split(/\s+/);
    const firstName = names[0] || "User";
    const initials = names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : firstName[0];

    if (accountLink) accountLink.hidden = true;
    if (userMenu) userMenu.hidden = false;
    if (userMenuName) userMenuName.textContent = firstName;
    if (userAvatar) userAvatar.textContent = initials.toUpperCase();
    if (mobileUserSummary) mobileUserSummary.hidden = false;
    if (mobileUserName) mobileUserName.textContent = firstName;
    if (mobileUserAvatar) mobileUserAvatar.textContent = initials.toUpperCase();
    if (mobileAccountLink) mobileAccountLink.hidden = true;
    if (mobileProfileLink) mobileProfileLink.hidden = false;
    if (mobileLogoutButton) mobileLogoutButton.hidden = false;
  } else {
    if (accountLink) accountLink.hidden = false;
    if (userMenu) userMenu.hidden = true;
    if (mobileUserSummary) mobileUserSummary.hidden = true;
    if (mobileAccountLink) mobileAccountLink.hidden = false;
    if (mobileProfileLink) mobileProfileLink.hidden = true;
    if (mobileLogoutButton) mobileLogoutButton.hidden = true;
  }
}

function openMobileMenu() {
  const drawer = document.getElementById("mobileMenu");
  const overlay = document.getElementById("mobileMenuOverlay");
  const button = document.getElementById("mobileMenuButton");
  if (!drawer || !overlay || !button) return;
  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  button.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeMobileMenu() {
  const drawer = document.getElementById("mobileMenu");
  const overlay = document.getElementById("mobileMenuOverlay");
  const button = document.getElementById("mobileMenuButton");
  if (!drawer || !overlay || !button) return;
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  button.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function toggleMobileMenu(event) {
  event?.stopPropagation();
  const drawer = document.getElementById("mobileMenu");
  if (!drawer) return;
  drawer.classList.contains("open") ? closeMobileMenu() : openMobileMenu();
}

function toggleUserMenu(event) {
  event?.stopPropagation();
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (!dropdown || !button) return;
  const open = dropdown.hidden;
  dropdown.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function closeUserMenu() {
  const dropdown = document.getElementById("userMenuDropdown");
  const button = document.getElementById("userMenuButton");
  if (dropdown) dropdown.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
}

function logoutUser() {
  localStorage.removeItem(HOME_USER_TOKEN_KEY);
  localStorage.removeItem(HOME_USER_PROFILE_KEY);
  closeMobileMenu();
  closeUserMenu();
  homeUpdateAccountUi();
}

document.addEventListener("click", closeUserMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeUserMenu();
    closeMobileMenu();
  }
});

homeUpdateAccountUi();
