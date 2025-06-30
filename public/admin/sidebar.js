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

    updateLayoutStyles();
  }

  function updateLayoutStyles() {
    const isCollapsed = sidebar.classList.contains("collapsed");
    contentWrapper.style.marginLeft = isCollapsed ? "70px" : "250px";
    contentWrapper.style.width = isCollapsed
      ? "calc(100% - 70px)"
      : "calc(100% - 250px)";
    if (cropModal && cropModal.style.display === "flex") {
      cropModal.style.left = isCollapsed ? "70px" : "250px";
      cropModal.style.width = isCollapsed
        ? "calc(100% - 70px)"
        : "calc(100% - 250px)";
    }
  }

  toggleButton.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    sidebar.classList.remove("mobile-open");
    updateLayoutStyles();
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



