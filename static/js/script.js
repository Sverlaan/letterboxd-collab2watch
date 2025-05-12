////////////////////////////////////////// Filter and Settings //////////////////////////////////////////
document.getElementById('resetFilters').addEventListener('click', async function (event) {

    document.getElementById('minRating').value = 0;
    document.getElementById('maxRating').value = 5;
    document.getElementById('minRuntime').value = 0;
    document.getElementById('maxRuntime').value = 9999;
    document.getElementById('minYear').value = 1870;
    document.getElementById('maxYear').value = 2025;

    await Recommend();
});

document.getElementById('applyFilters').addEventListener('click', async function (event) {

    await Recommend();
});

// Listen for the form submit event
document.getElementById('usernameForm').addEventListener('submit', function (event) {
    event.preventDefault();

    fetchUserData(document.getElementById('inputUsername').value);
    document.getElementById('inputUsername').placeholder ='Username';  
    document.getElementById('inputUsername').value = "";
});



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






// Function to handle explanation logic
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







////////////////////////////////////////// Movie Modal //////////////////////////////////////////
// Listen for click events on the body
document.body.addEventListener("click", async function (event) {

    let modalTrigger = event.target.closest(".open-movie-modal");

    if (event.target.matches("button[id^='explain_']")) {
        const slug = event.target.getAttribute("data-slug");
        const weight = event.target.getAttribute("data-weight");
        const title = event.target.getAttribute("data-title");
        const year = event.target.getAttribute("data-year");
        explainMovie(slug, title, year, weight);
    }
    else if (event.target.matches("button[id^='blacklist_']")) {
        const slug = event.target.getAttribute("data-slug");
        const weight = event.target.getAttribute("data-weight");
        const title = event.target.getAttribute("data-title");
        const year = event.target.getAttribute("data-year");
        blacklistMovie(slug, title, year, weight);

        
    }
    else if (modalTrigger) {

        // Remove existing modal if it exists
        let existingModal = document.getElementById("dynamicModal");
        if (existingModal) {
            existingModal.remove();
            document.querySelector(".modal-backdrop").remove();
        }

        const all_usernames = allUsers.map(u => u.username).join(",");
        let slug = modalTrigger.getAttribute("slug");
        const response = await fetch(`/fetch_movie_data_for_modal/${slug}/${all_usernames}`);
        if (!response.ok) throw new Error("Something went wrong getting movie modal data");
        const movie = await response.json();

        // Create modal HTML
        let modalHtml = await CreateModal(movie);

        // Append modal to body
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Show the modal
        let modal = new bootstrap.Modal(document.getElementById("dynamicModal"));
        modal.show();

        // Get filter settings
        const minRating = document.getElementById('minRating').value;
        const maxRating = document.getElementById('maxRating').value;
        const minRuntime = document.getElementById('minRuntime').value;
        const maxRuntime = document.getElementById('maxRuntime').value;
        const minYear = document.getElementById('minYear').value;
        const maxYear = document.getElementById('maxYear').value;

        // Fetch similar movies and populate the DOM
        const response2 = await fetch(`/fetch_similar_movies/${movie.slug}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        const data = await response2.json();

        if (!data.success)
        {
            console.log("No similar movies found");
            document.getElementById("similarMoviesContainer").classList.add('d-none');
        } 
        else {

            const movies = data.movies;

            for (let i = 0; i < movies.length; i++) {
                let similarMovie = movies[i];
                let similarMovieHtml = `
                <div class="col">
                    <img src="${similarMovie.poster}" 
                        class="card card-img-top rounded open-movie-modal" 
                        alt="${similarMovie.title}"
                        slug="${similarMovie.slug}">
                </div>
                `;
                document.getElementById("similarMovies").insertAdjacentHTML("beforeend", similarMovieHtml);
            }

            document.getElementById("similarMoviesContainer").classList.remove('d-none');

        }
            


        // Remove modal from DOM after it's closed
        document.getElementById("dynamicModal").addEventListener("hidden.bs.modal", function () {
            this.remove();
                // Remove backdrop only if no modals are open
            setTimeout(() => {
                if (document.querySelectorAll(".modal.show").length === 0) {
                    document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());

                    // Restore Bootstrap's default body padding (prevents page shift)
                    document.body.style.overflow = "";
                    document.body.style.paddingRight = "";
                }
            }, 100); // Delay ensures Bootstrap fully updates the UI first
        });
    }
});


async function CreateModal(movie) {
    let letterboxd_logo = "https://a.ltrbxd.com/logos/letterboxd-mac-icon.png";

    // Build user scores section
    let userScoresHtml = `
        <div class="row g-3 mt-1 justify-content-start flex-nowrap overflow-auto" style="white-space: nowrap;" id="userScoresRow2">
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 text-muted">${movie.rating}</h5>
                <img src="${letterboxd_logo}" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-muted text-center"><small>Letterboxd</small></p>
            </div>
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 ${movie.score_combined_color}">${movie.score_combined}</h5>
                <img src="https://cdn-icons-png.flaticon.com/512/718/718339.png" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-muted text-center"><small>Combined</small></p>
            </div>
    `;

    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const scoreData = movie.all_scores.find(u => u.username === user.username);

        userScoresHtml += `
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 ${scoreData ? scoreData.score_color : 'text-muted'}">${scoreData ? scoreData.score : '--'}</h5>
                <img src="${user.avatar}" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-muted text-center"><small>${user.name}</small></p>
            </div>
        `;
    }

    userScoresHtml += `</div>`;

    let modalHtml = `
        <div class="modal fade" id="dynamicModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered" style="max-width: 50%; width: 50%;">
                <div class="modal-content">
                    <div class="modal-body p-0">

                        <!-- Background section (banner + user scores) -->
                        <div class="card position-relative text-white" style="
                            border: none;
                            background-image: url('${movie.banner}');
                            background-size: cover;
                            background-position: center;
                        ">
                            <!-- Dark overlay -->
                            <div style="
                                position: absolute;
                                top: 0; left: 0; right: 0; bottom: 0;
                                background: rgba(0, 0, 0, 0.6);
                                z-index: 1;
                            "></div>


                            <!-- Foreground content over banner -->
                            <div class="card-body position-relative" style="z-index: 2;">
                                <button type="button" 
                                    class="btn-close position-absolute top-0 end-0 m-2"
                                    data-bs-dismiss="modal" 
                                    aria-label="Close"
                                    style="z-index: 10; background-color: white; border-radius: 50%; padding: 10px;">
                                </button>

                                <div class="row g-3">
                                    <div class="col-lg-3">
                                        <img src="${movie.poster}" 
                                            class="card card-img rounded" 
                                            style="object-fit: contain;" 
                                            alt="${movie.title}">
                                    </div>
                                    <div class="col-lg-9">
                                        <a href="${movie.letterboxd_link}" class="text-decoration-none edit-blacklist-link" style="font-size: 1.6em; font-weight: bolder; color: white;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
                                        <h6 class="card-subtitle mt-3 mb-2 text-light">${movie.runtime} mins | ${movie.genres}</h6> 
                                        <p class="card-text">${movie.description}</p>
                                        <p class="card-text no-spacing text-light"><small>Director: ${movie.director}</small></p>
                                        <p class="card-text no-spacing text-light"><small>Cast: ${movie.actors}</small></p>
                                        <a href="${movie.trailer}" class="text-decoration-none text-light" target="_blank" rel="noopener noreferrer"><small>Watch trailer</small></a>
                                    </div>
                                </div>

                                <!-- User Scores over background -->
                                <div class="mt-4">
                                    ${userScoresHtml}
                                </div>
                            </div>
                        </div>

                        <!-- Plain section for similar movies -->
                        <div class="card-body">
                            <div class="container-fluid" id="similarMoviesContainer">
                                <div class="mt-2 w-100 p-2">
                                    <div class="text-center text-muted fst-italic fs-4">Movies similar to ${movie.title}:</div>   
                                </div>
                                <div class="row hover-zoom g-3 justify-content-evenly p-1 mb-3" id="similarMovies"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;

    return modalHtml;
}



function GetFilterSettings() {
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    return { minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear };
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

            // Generate each card
            const card = document.createElement("div");
            card.classList.add("col");
            card.innerHTML = `
                <div class="h-100">
                    <img src="${movie.poster}" 
                        class="card card-img-top rounded open-movie-modal" 
                        alt="${movie.title}"
                        slug="${movie.slug}">
                </div>
            `;

            fragment.appendChild(card);
        });

        // Append all movie elements to the DOM in one go
        realRecommendContent.appendChild(fragment);

    } catch (error) {
        console.error(error);
    }
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



