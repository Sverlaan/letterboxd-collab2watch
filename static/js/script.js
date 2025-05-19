// global list of all users
let allUsers = [];

////////////////////////////////////////// Fetch User Data //////////////////////////////////////////
async function fetchUserData(username) {
    try {
        const response = await fetch(`/get_user/${username}`);
        if (!response.ok) throw new Error("User not found");
        const data = await response.json();

        // Create and insert user card
        createUserCard(username, data);

        // Fetch extended user data
        const response2 = await fetch(`/get_user_data/${username}`);
        if (!response2.ok) throw new Error("Could not fetch user data");
        const data2 = await response2.json();
        console.log(data2);

        // Update stats text
        const statsEl = document.getElementById(`user-stats-${username}`);
        statsEl.textContent = `Watched: ${data.num_movies_watched} | Watchlist: ${data.watchlist_length}`;

        // Swap spinner for close button
        const spinner = document.getElementById(`spinner-${username}`);
        const closeBtn = document.getElementById(`close-btn-${username}`);
        if (spinner) spinner.classList.add('d-none');
        if (closeBtn) closeBtn.classList.remove('d-none');

        // Add user object to allUsers list
        allUsers.push(data);

        await Recommend();

    } catch (error) {
        console.error(error);
        document.getElementById("enterUsernameHeader").textContent = "User not found. Try Again:";
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

                <!-- Right: Spinner or Close Button -->
                <div class="d-flex align-items-center justify-content-end">
                    <div id="spinner-${username}">
                        <div class="spinner-border text-secondary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
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

    // Add close button listener (will be revealed after loading)
    const closeBtn = col.querySelector(`#close-btn-${username}`);
    if (closeBtn) {
        closeBtn.addEventListener('click', async (e) => {
            const usernameToRemove = e.target.getAttribute('data-username');
            const cardToRemove = document.getElementById(`user-${usernameToRemove}`);
            if (cardToRemove) {
                cardToRemove.remove();
                allUsers = allUsers.filter(user => user.username !== usernameToRemove);

                if (allUsers.length > 0) {
                    await Recommend();
                }
                else {
                    document.getElementById("contentContainer").classList.add('d-none');
                }
            }
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


async function Recommend() {

    document.getElementById("go-spinner").style.display = "block"; // Show loading spinner
    //document.getElementById("contentContainer").classList.add('d-none');

    console.log("Get recs for active usernames: " + allUsers.map(user => user.username));

    await InitializeAndTrain();

    // Get filter settings
    const { minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear } = GetFilterSettings();
    const activeUsernames = getActiveUsernames();
    
    // Get Recommendations
    await FetchAndCreateRecommendationCards(activeUsernames, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    document.getElementById("contentContainer").classList.remove('d-none');
    document.getElementById("go-spinner").style.display = "none"; // Hide loading spinner

}

function getActiveUsernames() {
    const allUsersNow = allUsers.map(user => user.username);
    return allUsersNow;
}


async function FetchAndCreateRecommendationCards(usernames, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        if (usernames.length === 0) {
            console.error("No users selected for recommendations.");
            const realRecommendContent = document.getElementById("RecommendedCardsContainer");
            realRecommendContent.innerHTML = "";  // Clear content efficiently
            return;
        }

        // You can join them with commas (or however your backend expects)
        const response = await fetch(`/fetch_recommendations/${usernames.join(",")}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting recommendations");
        const data = await response.json();

        const realRecommendContent = document.getElementById("RecommendedCardsContainer");
        realRecommendContent.innerHTML = "";  // Clear content efficiently

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

    usernames = getActiveUsernames();
    console.log(`Explain movie with slug ${slug} for users: ${usernames}`);

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




async function FetchAndCreateRecommendationCardsOLD(usernames, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        if (usernames.length === 0) {
            console.error("No users selected for recommendations.");
            const realRecommendContent = document.getElementById("RecommendContainerReal");
            realRecommendContent.innerHTML = "";  // Clear content efficiently
            return;
        }

        // You can join them with commas (or however your backend expects)
        const response = await fetch(`/fetch_recommendations/${usernames.join(",")}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting recommendations");
        const data = await response.json();

        const weight = 0;

        const realRecommendContent = document.getElementById("RecommendContainerReal");
        realRecommendContent.innerHTML = "";  // Clear content efficiently

        const fragment = document.createDocumentFragment(); // Create a Document Fragment

        let index = 0;
        data.forEach(movie => {
            index += 1;

            // Create a new div for each movie and append to the fragment
            const movieElement = document.createElement("div");
            movieElement.classList.add("row");
            movieElement.innerHTML = `
                <div class="col-auto align-items-center d-flex justify-content-end" style="width: 50px;">
                    <h5 class="text-end">${index}.</h5>
                </div>

                <div class="col">
                    <div class="card rec-card open-movie-modal mb-3" slug="${movie.slug}">
                        <div class="row g-0" >
                            <div class="col-auto">
                                <img src="${movie.poster}" class="rec-card-img rounded-start" alt="${movie.title}" slug="${movie.slug}">
                            </div>

                            <div class="col">
                                <div class="card-body" slug="${movie.slug}">
                                    <h5 class="card-title">${movie.title} (${movie.year})</h5>
                                    <h5 class="text-top text-score p">${movie.score}%</h5>
                                </div>
                            </div>
                            <div class="col-auto p-2 align-items-center  d-flex flex-column justify-content-center" style="margin-right: 20px;">

                                <button 
                                    type="button"
                                    class="btn-close"
                                    aria-label="Blacklist"
                                    id="blacklist_${movie.slug}_${weight}_${index}"
                                    data-slug="${movie.slug}"
                                    data-title="${movie.title}"
                                    data-year="${movie.year}"
                                    data-weight="${weight}">
                                </button>

                            </div>

                        </div>
                    </div>
                </div>
            `;

            fragment.appendChild(movieElement);
        });

        // Append all movie elements to the DOM in one go
        realRecommendContent.appendChild(fragment);

    } catch (error) {
        console.error(error);
    }
}



