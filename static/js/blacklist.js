function generateUserCheckboxes() {
    const container = document.getElementById("blacklistUserCheckboxes");
    container.innerHTML = ""; // Clear existing checkboxes

    allUsers.forEach((user, index) => {
        const checkboxId = `blacklistCheckbox_${index}`;

        // Create checkbox input
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = checkboxId;
        checkbox.classList.add("blacklist-user-checkbox");
        checkbox.dataset.username = user.username;

        // Create label for the checkbox
        const label = document.createElement("label");
        label.htmlFor = checkboxId;
        label.textContent = user.name;

        // Append checkbox and label to the container
        const wrapper = document.createElement("div");
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
    });
}


async function blacklistMovie(slug, title, year, weight) {
    weight = parseInt(weight, 10);

    const activeButtons = document.querySelectorAll("#userButtonsContainer button.active");
    const allActiveUsers = Array.from(activeButtons).map(btn => btn.getAttribute("data-user"));

    // Auto-blacklist for a single user
    if (allActiveUsers.length === 1) {
        const user = allActiveUsers[0];

        try {
            console.log(`Adding ${slug} to ${user}'s blacklist...`);
            const response = await fetch(`/add_to_blacklist/${user}/${slug}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) {
                throw new Error(`Failed to add ${slug} to ${user}'s blacklist`);
            }

            await waitForCompareUpdate();

            return;
            
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        }
        return; // Skip modal
    }

    // If multiple users, show modal
    document.getElementById("blacklistModalTitle").textContent = `Add ${title} (${year}) To Blacklist`;
    document.getElementById("blacklistModalText").innerHTML = `For which user would you like to add <b>${title} (${year})</b> to the blacklist?`;

    generateUserCheckboxes();

    const checkboxes = document.querySelectorAll(".blacklist-user-checkbox");
    const addToBlacklistBtn = document.getElementById("addToBlacklistBtn");
    const loadingIndicator = document.getElementById("blacklistLoading");

    addToBlacklistBtn.disabled = true;
    loadingIndicator.style.display = "none";

    // Pre-check box based on weight
    if (weight === -1 && checkboxes[0]) {
        checkboxes[0].checked = true;
        addToBlacklistBtn.disabled = false;
    } else if (weight === 1 && checkboxes[1]) {
        checkboxes[1].checked = true;
        addToBlacklistBtn.disabled = false;
    }

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            addToBlacklistBtn.disabled = !anyChecked;
        });
    });

    const modal = new bootstrap.Modal(document.getElementById("blacklistModal"));
    modal.show();

    addToBlacklistBtn.onclick = async function () {
        const selectedUsers = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.username);

        addToBlacklistBtn.disabled = true;
        addToBlacklistBtn.textContent = "Processing...";
        loadingIndicator.style.display = "block";

        try {
            for (const user of selectedUsers) {
                const response = await fetch(`/add_to_blacklist/${user}/${slug}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                if (!response.ok) {
                    throw new Error(`Failed to add ${slug} to ${user}'s blacklist`);
                }
            }

            await waitForCompareUpdate();
            modal.hide();
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        } finally {
            addToBlacklistBtn.disabled = true;
            addToBlacklistBtn.textContent = "Add to Blacklist";
            loadingIndicator.style.display = "none";
        }
    };
}




document.getElementById("editBlacklistModal").addEventListener("show.bs.modal", async function () {
    const tabsContainer = document.getElementById("blacklistTabs");
    const contentContainer = document.getElementById("blacklistTabContent");

    tabsContainer.innerHTML = "";
    contentContainer.innerHTML = "";

    allUsers.forEach((user, index) => {
        const tabId = `user-tab-${index}`;
        const contentId = `user-content-${index}`;

        // Create tab
        const tab = document.createElement("li");
        tab.classList.add("nav-item");
        tab.innerHTML = `<a class="nav-link${index === 0 ? ' active' : ''}" id="${tabId}" data-bs-toggle="tab" href="#${contentId}" role="tab">${user.name}</a>`;
        tabsContainer.appendChild(tab);

        // Create content pane
        const contentPane = document.createElement("div");
        contentPane.classList.add("tab-pane", "fade");
        if (index === 0) {
            contentPane.classList.add("show", "active");
        }

        contentPane.id = contentId;
        contentPane.role = "tabpanel";
        contentPane.innerHTML = `
            <ul class="list-group" id="blacklistMovies-${user.username}">
                <li class="list-group-item text-muted">Loading...</li>
            </ul>
            <button class="btn btn-sm btn-outline-danger mt-2 reset-blacklist" data-username="${user.username}">Reset Blacklist</button>
        `;
        contentContainer.appendChild(contentPane);
    });

    // Fetch blacklists
    try {
        const usernames = allUsers.map(user => user.username).join(",");
        const response = await fetch(`/fetch_blacklists/${usernames}`);
        if (!response.ok) throw new Error("Failed to fetch blacklists");

        const data = await response.json(); // { username1: [...movies], username2: [...movies], ... }

        allUsers.forEach(user => {
            const movieList = document.getElementById(`blacklistMovies-${user.username}`);
            movieList.innerHTML = "";

            if (data[user.username] && data[user.username].length > 0) {
                data[user.username].forEach(movie => {
                    const li = document.createElement("li");
                    li.className = "list-group-item d-flex justify-content-between align-items-center";
                    li.innerHTML = `${movie.title} (${movie.year})
                        <button class="btn btn-sm btn-danger remove-movie" data-name="${user.name}" data-user="${user.username}" data-movie="${movie.slug}">&#10005;</button>`;
                    movieList.appendChild(li);
                });
            } else {
                movieList.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
            }
        });
    } catch (error) {
        console.error(error);
        allUsers.forEach(user => {
            const movieList = document.getElementById(`blacklistMovies-${user.username}`);
            movieList.innerHTML = '<li class="list-group-item text-danger">Error loading blacklist</li>';
        });
    }
});




document.addEventListener("click", async function (event) {
    if (event.target.classList.contains("remove-movie")) {
        const user = event.target.dataset.user;
        const name = event.target.dataset.name;
        const movieSlug = event.target.dataset.movie;

        const loadingSpinner = document.getElementById("blacklistLoadingSpinner");
        loadingSpinner.style.display = "block";

        try {
            const response = await fetch(`/remove_from_blacklist/${user}/${movieSlug}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to remove movie");

            // Refresh blacklist after removal
            document.getElementById("editBlacklistModal").dispatchEvent(new Event("show.bs.modal"));

            // Wait for compare button action to complete
            await waitForCompareUpdate();
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        } finally {
            loadingSpinner.style.display = "none";
        }
    }

    if (event.target.classList.contains("reset-blacklist")) {
        const user = event.target.dataset.username;
        const movieList = document.getElementById(`blacklistMovies-${user}`);
        const loadingSpinner = document.getElementById("blacklistLoadingSpinner");

        movieList.innerHTML = '<li class="list-group-item text-muted">No blacklisted movies</li>';
        loadingSpinner.style.display = "block";

        try {
            const response = await fetch(`/reset_blacklist/${user}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`Failed to reset ${user} blacklist`);

            // Wait for compare button action to complete
            await waitForCompareUpdate();
        } catch (error) {
            console.error(error);
            alert(`Error resetting ${user} blacklist`);
        } finally {
            loadingSpinner.style.display = "none";
        }
    }
});



async function waitForCompareUpdate() {
    // return new Promise((resolve) => {
    //     function onCompareComplete() {
    //         console.log("Compare button action completed.");
    //         resolve();
    //     }

    //     compareButton.addEventListener("compareComplete", onCompareComplete, { once: true });

        const event = new Event("click", { bubbles: true });
        event.refresh = 1;
        compareButton.dispatchEvent(event);
    // });
}

