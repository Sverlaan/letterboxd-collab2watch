////////////////////////////////////////// Dark/Light Mode //////////////////////////////////////////

// Toggle the theme between dark and light
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-bs-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    // Set the new theme
    document.documentElement.setAttribute("data-bs-theme", newTheme);

    // Save the theme preference in localStorage
    localStorage.setItem("theme", newTheme);

    // Update both icons
    updateIcon(newTheme);
}

// Update both icons based on the current theme
function updateIcon(theme) {
    const icons = [
        document.getElementById("theme-icon"),
        document.getElementById("theme-icon-desktop")
    ];

    icons.forEach(icon => {
        if (!icon) return;
        if (theme === "dark") {
            icon.classList.remove("bi-sun");
            icon.classList.add("bi-moon");
        } else {
            icon.classList.remove("bi-moon");
            icon.classList.add("bi-sun");
        }
    });
}


// Apply the stored theme on page load
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-bs-theme", savedTheme);
    updateIcon(savedTheme);
});


