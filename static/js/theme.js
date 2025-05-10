////////////////////////////////////////// Dark/Light Mode //////////////////////////////////////////

// Toggle the theme between dark and light
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-bs-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    // Set the new theme
    document.documentElement.setAttribute("data-bs-theme", newTheme);

    // Save the theme preference in localStorage
    localStorage.setItem("theme", newTheme);

    // Update the icon
    updateIcon(newTheme);
}

// Update the icon based on the current theme
function updateIcon(theme) {
    const icon = document.getElementById("theme-icon");
    if (icon) {
        if (theme === "dark") {
            icon.classList.remove("bi-sun");
            icon.classList.add("bi-moon");
        } else {
            icon.classList.remove("bi-moon");
            icon.classList.add("bi-sun");
        }
    }
}

// Apply the stored theme on page load
document.addEventListener("DOMContentLoaded", function () {
    const savedTheme = localStorage.getItem("theme") || "dark"; // Default to dark
    document.documentElement.setAttribute("data-bs-theme", savedTheme);
    updateIcon(savedTheme);
});
