const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

const MOBILE_BREAKPOINT = 768;
export const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

export function openSidebar() {
  document.body.classList.add("sidebar-open");
  sidebarToggle.setAttribute("aria-expanded", "true");
}

export function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  sidebarToggle.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  document.body.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
}

export function initSidebar() {
  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);
  window.addEventListener("resize", () => {
    if (!isMobile()) closeSidebar();
  });
}
