window.onload = () => {
  const toggleButton = document.querySelector(".toggle-sidebar");
  const sidebar = document.querySelector(".sidebar");
  const contentWrapper = document.querySelector(".content-wrapper");
  const cropModal = document.getElementById("cropModal");

  if (!toggleButton || !sidebar || !contentWrapper) return;

  function dispatchSidebarEvent(collapsed) {
    const event = new CustomEvent("sidebarToggle", {
      detail: {
        collapsed: collapsed,
        isMobile: window.innerWidth <= 768,
      },
    });
    window.dispatchEvent(event);
  }

  function updateSidebarState() {
    const wasCollapsed = sidebar.classList.contains("collapsed");

    if (window.innerWidth <= 768) {
      sidebar.classList.add("collapsed");
    } else {
      sidebar.classList.remove("collapsed");
    }

    const isCollapsed = sidebar.classList.contains("collapsed");
    if (wasCollapsed !== isCollapsed) {
      dispatchSidebarEvent(isCollapsed);
    }

  }

  toggleButton.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    sidebar.classList.remove("mobile-open");
    const isCollapsed = sidebar.classList.contains("collapsed");
    dispatchSidebarEvent(isCollapsed);
  });

  const currentPath = window.location.pathname;
  document.querySelectorAll(".nav-item").forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    }
  });

  updateSidebarState();
  window.addEventListener("resize", updateSidebarState);
};
