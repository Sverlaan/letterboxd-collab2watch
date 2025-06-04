// global list of all users
let allUsers = [];
let selectedUsernames = [];

////////////////////////////////////////// Fetch User Data //////////////////////////////////////////
async function fetchUserData(username) {
    try {
        const response = await fetch(`/init_user/${username}`);
        if (!response.ok) throw new Error("User not found");
        const data = await response.json();

        // Reset the username header text after a successful fetch
        document.getElementById("inputUsername").placeholder = "Enter Letterboxd username";

        // Create and insert user card
        createUserCard(username, data);

        // Fetch extended user data
        const response2 = await fetch(`/fetch_user_data/${username}`);
        if (!response2.ok) throw new Error("Could not fetch user data");
        const data2 = await response2.json();

        // Update stats text
        const statsEl = document.getElementById(`user-stats-${username}`);
        statsEl.textContent = `Watched: ${data.num_movies_watched} Watchlist: ${data.watchlist_length}`;

        // Swap spinner for close button
        const spinner = document.getElementById(`spinner-${username}`);
        const closeBtn = document.getElementById(`close-btn-${username}`);
        const toggleIcon = document.getElementById(`toggle-icon-${username}`);
        if (spinner) spinner.classList.add('d-none');
        if (closeBtn) closeBtn.classList.remove('d-none');
        if (toggleIcon) toggleIcon.classList.remove('d-none');

        // Add user object to allUsers list
        allUsers.push(data);
        selectedUsernames.push(data.username);

        const category = getSelectedCategory();
        await Recommend(category);

    } catch (error) {
        console.error(error);
        document.getElementById("inputUsername").placeholder = "User not found";
    }
}



function createUserCard(username, user) {
    const col = document.createElement("div");
    col.className = "mb-2 d-flex justify-content-center";
    col.id = `user-${username}`;
    col.innerHTML = `
        <div class="card user-card w-100 p-3" style="max-width: 700px; position: relative;">
            <div class="d-flex align-items-center justify-content-between">
                
                <!-- Left: Avatar and Text -->
                <div class="d-flex align-items-center">
                    <img src="${user.avatar}" class="rounded-circle me-3" 
                         style="width: 80px; height: 80px; object-fit: cover;" 
                         alt="${user.name}'s avatar">
                    <div>
                        <h5 class="mb-1 text-start">
                            <a href="${user.url}" target="_blank" class="text-decoration-none">${user.name}</a>
                        </h5>
                        <p id="user-stats-${username}" class="mb-1 text-muted text-start">Fetching user data...</p>
                    </div>
                </div>

                <!-- Right: Spinner, Toggle Icon, Close -->
                <div class="d-flex align-items-center justify-content-end">
                    <div id="spinner-${username}">
                        <div class="spinner-border text-secondary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <i 
                        class="bi bi-eye ms-3 toggle-icon text-neon-green d-none"
                        id="toggle-icon-${username}" 
                        data-username="${username}"
                        title="Toggle Selection"
                        style="cursor: pointer; font-size: 1.6rem;"
                    ></i>
                    <button 
                        type="button"
                        class="btn-close ms-3 d-none" 
                        aria-label="Close"
                        data-username="${username}"
                        id="close-btn-${username}">
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById("userRow").appendChild(col);

    // Close button logic
    const closeBtn = col.querySelector(`#close-btn-${username}`);
    if (closeBtn) {
        closeBtn.addEventListener('click', async (e) => {
            const usernameToRemove = e.target.getAttribute('data-username');
            const cardToRemove = document.getElementById(`user-${usernameToRemove}`);
            if (cardToRemove) {
                cardToRemove.remove();
                allUsers = allUsers.filter(user => user.username !== usernameToRemove);
                selectedUsernames = selectedUsernames.filter(u => u !== usernameToRemove);

                const category = getSelectedCategory();
                await Recommend(category);
            }
        });
    }

    // Toggle selection logic
    const toggleIcon = col.querySelector(`#toggle-icon-${username}`);
    if (toggleIcon) {
        toggleIcon.addEventListener('click', async () => {
            const isSelected = selectedUsernames.includes(username);

            if (isSelected) {
                selectedUsernames = selectedUsernames.filter(u => u !== username);
                toggleIcon.classList.remove("text-neon-green");
                toggleIcon.classList.replace("bi-eye", "bi-eye-slash");
            } else {
                selectedUsernames.push(username);
                toggleIcon.classList.add("text-neon-green");
                toggleIcon.classList.replace("bi-eye-slash", "bi-eye");
            }
            const category = getSelectedCategory();
            await Recommend(category);
        });
    }
}



async function InitializeAndTrain() {
    try {
        usernames = allUsers.map(user => user.username);
        const userParam = usernames.join(",");

        const response = await fetch(`/preprocess_data/${userParam}`);
        if (!response.ok) throw new Error("Something went wrong preprocessing data");

        const response2 = await fetch(`/train_model`);
        if (!response2.ok) throw new Error("Something went wrong training model");

    } catch (error) {
        console.error(error);
    }
}


async function Recommend(selectedCategory) {

    document.getElementById("go-spinner").style.display = "block"; // Show loading spinner
    //document.getElementById("contentContainer").classList.add('d-none');

    await InitializeAndTrain();

    // Get filter settings
    const { minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear } = GetFilterSettings();
    const allUsernames = getAllUsernames();
    
    // Get Recommendations
    await FetchAndCreateRecommendationCards(allUsernames, selectedUsernames, selectedCategory, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    document.getElementById("go-spinner").style.display = "none"; // Hide loading spinner

}

function getAllUsernames() {
    const allUsernames = allUsers.map(user => user.username);
    return allUsernames;
}


async function FetchAndCreateRecommendationCards(allUsernames, selectedUsernames, selectedCategory, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        const errorContainer = document.getElementById("ErrorMessage");

        if (allUsernames.length === 0) {
            console.error("No users selected for recommendations.");
            const realRecommendContent = document.getElementById("RecommendedCardsContainer");
            realRecommendContent.innerHTML = ""
            errorContainer.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    Please add at least one user in the sidebar to get recommendations
                </div>
            `;
            errorContainer.style.display = "block"; // Show error message
            return;
        }

        if (selectedUsernames.length === 0) {
            const realRecommendContent = document.getElementById("RecommendedCardsContainer");
            // Add header text
            realRecommendContent.innerHTML = "";
            errorContainer.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    Please select at least one user to get recommendations
                </div>
            `;
            errorContainer.style.display = "block"; // Show error message

            return;
        }

        // You can join them with commas (or however your backend expects)
        const response = await fetch(`/fetch_recommendations/${allUsernames.join(",")}/${selectedUsernames.join(",")}/${selectedCategory}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting recommendations");
        const data = await response.json();

        const realRecommendContent = document.getElementById("RecommendedCardsContainer");
        realRecommendContent.innerHTML = "";  // Clear content efficiently

        if (data.length === 0) {
            errorContainer.innerHTML = `
                <div class="alert alert-info" role="alert">
                    No results found for the selected users and filters
                </div>
            `;
            errorContainer.style.display = "block"; // Show error message
            return;
        }
        errorContainer.style.display = "none"; // Hide error message if data is found

        const fragment = document.createDocumentFragment(); // Create a Document Fragment

        let index = 0;
        data.forEach(movie => {
            index += 1;

            const card = document.createElement("div");
            card.classList.add("col");
            card.innerHTML = `
                <div class="card h-100 hover-zoom position-relative overflow-hidden">
                    <img src="${movie.poster}" 
                        class="card-img-top open-movie-modal rounded w-100"
                        alt="${movie.title}"
                        slug="${movie.slug}">
            
                    <button 
                        type="button"
                        class="btn-close blacklist-btn position-absolute top-0 end-0 m-2 d-none"
                        aria-label="Blacklist"
                        data-slug="${movie.slug}"
                        data-title="${movie.title}"
                        data-year="${movie.year}">
                    </button>
                </div>
            `;
        
        
            fragment.appendChild(card);

            let hoverTimeout;

            card.querySelector(".hover-zoom").addEventListener("mouseenter", () => {
                hoverTimeout = setTimeout(() => {
                    card.querySelector(".blacklist-btn").classList.remove("d-none");
                }, 400); // 1 second delay
            });

            card.querySelector(".hover-zoom").addEventListener("mouseleave", () => {
                clearTimeout(hoverTimeout);
                card.querySelector(".blacklist-btn").classList.add("d-none");
            });

            const btn = card.querySelector('.blacklist-btn');
            if (btn) {
                btn.addEventListener('click', async (e) => {
                    //e.stopPropagation(); // Prevent modal click if using open-movie-modal

                    const slug = btn.dataset.slug;
                    const title = btn.dataset.title;
                    const year = btn.dataset.year;
                    await blacklistMovie(slug, title, year);
                });
            }
        });

        // Append all movie elements to the DOM in one go
        realRecommendContent.appendChild(fragment);


    } catch (error) {
        console.error(error);
    }
}










////////////////////////////////////////////// Explain Movie (currently not used) //////////////////////////////////////////
async function explainMovie(slug, title, year) {

    usernames = getAllUsernames();

    let description = "";

    for (const username of usernames) {
        let response = await fetch(`/fetch_explanation/${username}/${slug}`);
        if (!response.ok) throw new Error("Something went wrong getting explanation");
        let data = await response.json();
        if (data.success){
            explainModalTitle.textContent = `We recommend ${title} (${year})`;
            description += `<h6>Since ${username} likes:</h6>`;
            description += "<ul>";
            for (let movie of data.movies) {
                description += `<li>${movie.title} (${movie.year})</li>`;
            }
            description += "</ul>";
        }
    }

    // Set the modal text using innerHTML to preserve formatting
    explainModalText.innerHTML = description;

    // Show the modal
    let modal = new bootstrap.Modal(document.getElementById("explainModal"));
    modal.show();
}




