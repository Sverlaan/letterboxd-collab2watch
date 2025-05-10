////////////////////////////////////////// Filter and Settings //////////////////////////////////////////
document.getElementById('resetFilters').addEventListener('click', function (event) {

    document.getElementById('minRating').value = 0;
    document.getElementById('maxRating').value = 5;
    document.getElementById('minRuntime').value = 0;
    document.getElementById('maxRuntime').value = 9999;
    document.getElementById('minYear').value = 1870;
    document.getElementById('maxYear').value = 2025;
});

document.getElementById('applyFilters').addEventListener('click', async function (event) {

    const compareButton = document.getElementById('compareButton');
    if (!compareButton.disabled) {
        const event = new Event('click', { bubbles: true });
        event.refresh = -1;
        compareButton.dispatchEvent(event);
    }
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
// To track whether all users have been fetched
let num_users_done = 0;
let num_users_total = 0;

////////////////////////////////////////// Fetch User Data //////////////////////////////////////////
async function fetchUserData(username) {
    try {
        // Fetch the initial user info
        const response = await fetch(`/get_user/${username}`);
        if (!response.ok) throw new Error("User not found");
        const data = await response.json();
        const current_user = data.current_user;
        
        document.getElementById('compareButton').disabled = true;

        allUsers = data.all_users;
        console.log(allUsers);
        num_users_total = data.total_users;

        // Create a new column with the basic info and a loading spinner inside
        const col = document.createElement("div");
        col.className = "col-md-3 mb-4";
        col.id = `user-${username}`;
        col.innerHTML = `
            <div class="card user-card text-center h-100 d-flex flex-column justify-content-between position-relative">
                <button 
                    type="button"
                    class="btn-close position-absolute top-0 end-0 m-2 close-btn user-close-btn" 
                    aria-label="Close"
                    data-username="${username}">
                </button>
                <div>
                    <img src="${current_user.avatar}" class="img-fluid rounded-circle mt-3 mx-auto" style="width: 100px; height: 100px;" alt="${current_user.name}'s avatar">
                    <div class="card-body">
                        <h5 class="card-title">${current_user.name}</h5>
                        <p id="user-stats-${username}" class="card-text text-muted">Fetching user data...</p>
                        <a href="${current_user.url}" target="_blank" class="btn btn-outline-primary btn-sm">View Profile</a>
                    </div>
                </div>
                <div class="pb-3">
                    <div class="spinner-border text-secondary" role="status" id="spinner-${username}">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById("userRow").appendChild(col);

        // Add event listener for the close button
        col.querySelector('.close-btn').addEventListener('click', (e) => {
            const usernameToRemove = e.target.getAttribute('data-username');
            // Call your custom logic here
            console.log(`Close button clicked for user: ${usernameToRemove}`);

            // Example: Remove the card
            const cardToRemove = document.getElementById(`user-${usernameToRemove}`);
            if (cardToRemove) {
                cardToRemove.remove();
                // Delete user from allUsers
                allUsers = allUsers.filter(user => user.username !== usernameToRemove);
                console.log(`User ${usernameToRemove} removed from allUsers.`);
                // Update the number of users done
                num_users_done -= 1;
                // Enable the compare button if no users are left
                if (num_users_done <= 1) {
                    document.getElementById('compareButton').disabled = true;
                }
                else {
                    // press the compare button to update the recommendations
                    const event = new Event('click', { bubbles: true });
                    event.refresh = 0;
                    document.getElementById('compareButton').dispatchEvent(event);
                }
            }
        });

        // Now fetch the more in-depth user data, such as watchlist and ratings
        const response2 = await fetch(`/get_user_data/${username}`);
        if (!response2.ok) throw new Error("Could not fetch user data");
        const data2 = await response2.json();
        console.log(data2);

        // Update stats text
        const statsEl = document.getElementById(`user-stats-${username}`);
        // statsEl.style.whiteSpace = "pre-line";
        statsEl.textContent = `Watched: ${current_user.num_movies_watched} | Watchlist: ${current_user.watchlist_length}`;

        // Remove spinner
        const spinner = document.getElementById(`spinner-${username}`);
        if (spinner) spinner.remove();

        // Mark this user as done and check whether any other is still loading
        num_users_done += 1;
        if (num_users_total > 1) {
            if (num_users_done === num_users_total) {
                document.getElementById('compareButton').disabled = false;
            }
        }

    } catch (error) {
        // TODO: Handle not found and max exceeded separately
        console.error(error);
        document.getElementById("enterUsernameHeader").textContent = "User not found. Try Again:";
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

async function FetchCommonWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const usernames = allUsers.map(u => u.username).join(",");
        const response = await fetch(`/fetch_common_watchlist/${usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting common watchlist");
        const result = await response.json();

        const realContent = document.getElementById("realContent");
        const commonWatchlistCount = document.getElementById("commonWatchlistCount");
        const subtitle = document.getElementById("commonWatchlistSubtitle");

        // Clear previous content
        realContent.innerHTML = "";

        let data = [];
        if (result.success) {
            console.log("Common watchlist fetched successfully");
            data = result.movies;
            subtitle.textContent = "Let's see what movies you all want to watch!";
        } else {
            console.log("No common movies found");
            subtitle.textContent = "No common movies found in your watchlists";
        }

        commonWatchlistCount.textContent = data.length;

        // Create horizontally scrollable container
        const scrollContainer = document.createElement("div");
        scrollContainer.style.display = "flex";
        scrollContainer.style.overflowX = "auto";
        scrollContainer.style.gap = "2rem";
        scrollContainer.style.padding = "1.2rem 1.2rem"; // Only vertical padding
        scrollContainer.classList.add("no-scrollbar");

        realContent.appendChild(scrollContainer);

        data.forEach(movie => {
            const card = document.createElement("div");
            card.style.minWidth = "250px"; // Fixed size for flex layout
            card.style.flexShrink = "0";
            card.innerHTML = `
                <img src="${movie.poster}" class="card card-img-top rounded open-movie-modal" alt="${movie.title}" slug="${movie.slug}">
            `;
            scrollContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
    }
}








// Fetch single watchlist from Flask backend and populate the DOM
async function FetchSingleWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {

        const all_usernames = allUsers.map(u => u.username).join(",");

        const superContainer = document.getElementById("SingleWatchlistsContainer");


        const height = allUsers.length * 261;
        superContainer.style.height = `${height}px`;

        // delete all existing containers
        while (superContainer.firstChild) {
            superContainer.removeChild(superContainer.firstChild);
        }

        let index = 0
        for (let user of allUsers) {

            index = index+1;

            const containerId = `SingleWatchlistContainer_${user.username}`;
            const titleId = `SWL_${user.username}_title`;
            const subtitleId = `SWL_${user.username}_subtitle`;
            const contentId = `SWC_${user.username}_RC`;
        
            const isEven = index % 2 === 0;

            // Remove the old container if it exists
            const oldContainer = document.getElementById(containerId);
            if (oldContainer) {
                oldContainer.remove();
            }
        
            const container = document.createElement('div');
            container.className = "container hover-zoom bg-tertiary-subtle w-75 p-4";
            container.id = containerId;
        
            container.innerHTML = `
                <div class="row justify-content-evenly align-items-center">
                    <div class="col-md-3 bg-tertiary justify-content-center align-items-center ${isEven ? '' : 'order-md-2'}">
                        <h1 id="${titleId}" class="text-center">${user.name}'s</h1>
                        <h1 class="text-center">Watchlist</h1>
                        <p id="${subtitleId}" class="text-center text-muted">Movies the other(s) might like!</p>
                    </div>
                    <div class="col-md-8 justify-content-center align-items-center ${isEven ? '' : 'order-md-1'}">
                        <div class="row row-cols-1 row-cols-md-5 g-4" id="${contentId}"></div>
                    </div>
                </div>
            `;

            superContainer.appendChild(container);


            const response = await fetch(`/fetch_single_watchlist/${user.username}/${all_usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
            if (!response.ok) throw new Error(`Something went wrong getting single watchlist ${SWL_num}`);
            const data = await response.json();

            //Loop through the data and generate the cards
            data.forEach(movie => {

                // Generate each card
                const card = document.createElement("div");
                card.classList.add("col");
                card.innerHTML = `
                    <img src="${movie.poster}" 
                        class="card card-img-top rounded open-movie-modal" 
                        alt="${`${movie.title}`}"
                        slug="${movie.slug}">
                `;
                document.getElementById(`${contentId}`).appendChild(card);
            });
        }
            

        

    } catch (error) {
        console.error(error);
    }
    
}

async function FetchRewatchlist(username, other_usernames, realRewatchCombo, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    try {
        const response = await fetch(`/fetch_rewatchlist/${username}/${other_usernames}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        if (!response.ok) throw new Error("Something went wrong getting rewatchlist");
        const data = await response.json();

        // Clear existing items safely
        realRewatchCombo.innerHTML = "";

        const fragment = document.createDocumentFragment();

        let index = 0;
        data.forEach(movie => {
            index += 1;

            const carouselItem = document.createElement("div");
            carouselItem.className = `carousel-item ${index === 1 ? 'active' : ''}`;

            carouselItem.innerHTML = `
                <div class="hover-zoom overflow-hidden">
                    <img src="${movie.banner}" class="card d-block w-100 rounded open-movie-modal" alt="${movie.title}" slug="${movie.slug}">
                </div>
                <div class="position-relative text-center text-muted p-3" style="font-size: 18px;">
                    ${movie.title} (${movie.year})
                </div>
            `;

            fragment.appendChild(carouselItem);
        });

        realRewatchCombo.appendChild(fragment);

    } catch (error) {
        console.error(error);
    }
}


async function generateRewatchCarousels(allUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
    const container = document.getElementById("RewatchContainer");

    // LOCK scroll position to prevent jump
    const scrollY = window.scrollY;

    // Clear previous carousels
    container.innerHTML = "";

    for (let user of allUsers) {
        const otherUsers = allUsers.filter(u => u.username !== user.username);
        const otherUsernames = otherUsers.map(u => u.username).join(",");

        const carouselId = `carousel-${user.username}`;
        const carouselInnerId = `${carouselId}-inner`;

        // Create wrapper element and append later
        const wrapper = document.createElement("div");
        wrapper.className = "col-md-5 d-inline-block align-top";
        wrapper.innerHTML = `
            <h1 class="text-center">Rewatches for ${user.name}</h1>
            <p class="text-center text-muted mb-3">Movies highly rated by ${user.name} that the other(s) might like!</p>
            <div id="${carouselId}" class="carousel slide p-3" data-bs-ride="carousel">
                <div class="carousel-inner" id="${carouselInnerId}"></div>
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev"></button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next"></button>
            </div>
        `;

        container.appendChild(wrapper);

        const innerCarousel = wrapper.querySelector(`#${carouselInnerId}`);
        await FetchRewatchlist(user.username, otherUsernames, innerCarousel, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
    }

    // RESTORE scroll position
    window.scrollTo({ top: scrollY });
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
    let modalTrigger2 = event.target.closest(".show-movie-modal");

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
    else if (modalTrigger2) {

        // call showRecommendedMovie function
        const slug = modalTrigger2.getAttribute("slug");
        showRecommendedMovie(slug);
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

async function showRecommendedMovie(slug) {

        // Clear previous content in the container
        document.getElementById("footer").style.visibility = "hidden";
        document.getElementById("RecommendContainerMovie").innerHTML = "";

        const all_usernames = allUsers.map(u => u.username).join(",");

        const response = await fetch(`/fetch_movie_data_for_modal/${slug}/${all_usernames}`);
        if (!response.ok) throw new Error("Something went wrong getting movie modal data");

        const movie = await response.json();

        // Create modal HTML
        let modalHtml = await CreateModal2(movie);

        // Strip outer modal wrapper, extract just `.card`
        const tempWrapper = document.createElement("div");
        tempWrapper.innerHTML = modalHtml;
        const cardContent = tempWrapper//.querySelector(".card");

        // Append only the card content to the column
        document.getElementById("RecommendContainerMovie").appendChild(cardContent);

        document.getElementById("footer").style.visibility = "visible";

}

// Create movie modal HTML
async function CreateModal2(movie) {

    let letterboxd_logo = "https://a.ltrbxd.com/logos/letterboxd-mac-icon.png" //"https://a.ltrbxd.com/logos/letterboxd-logo-v-neg-rgb.svg" 

    // Start of user scores dynamic section
    let userScoresHtml = `
        <div class="row g-3 mt-1 justify-content-start flex-nowrap overflow-auto" style="white-space: nowrap;" id="userScoresRow">
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

    // Loop through all users dynamically
    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const scoreData = movie.all_scores.find(u => u.username === user.username);  // match by username
        console.log(scoreData);

        userScoresHtml += `
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 ${scoreData ? scoreData.score_color : 'text-muted'}">${scoreData ? scoreData.score : '--'}</h5>
                <img src="${user.avatar}" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-muted text-center"><small>${user.name}</small></p>
            </div>
        `;
    }

    // Add combined score block at the end
    userScoresHtml += `

    </div> <!-- End of dynamic user row -->
    `;

    let modalHtml = `
        <div class="card position-relative" style="border: none;">

            <div class="banner-fade open-movie-modal" slug="${movie.slug}" style="overflow: hidden; position: relative;">
                <img src="${movie.banner}" 
                    class="card-img-top img-fluid" 
                    alt="${movie.title}"
                    style="object-fit: cover; height: 300px; object-position: top;">
            </div>


            <div class="card-body">
                <div class="row g-3">
                    <div class="col-lg-3">    
                        <img src="${movie.poster}" 
                            class="card card-img-top rounded open-movie-modal" 
                            style="object-fit: contain;" 
                            alt="${movie.title}"
                            slug="${movie.slug}">
                    </div>
                    
                    <div class="col-lg-9">
                        <a href="${movie.letterboxd_link}" class="text-decoration-none edit-blacklist-link" style="font-size: 1.5em; font-weight: bolder; color: inherit;" target="_blank" rel="noopener noreferrer">${movie.title} (${movie.year})</a>
                        <h6 class="card-subtitle mt-3 mb-2 text-muted">${movie.runtime} mins | ${movie.genres}</h6> 
                        <p class="card-text">${movie.description}</p>
                        <p class="card-text no-spacing text-muted"><small>Director: ${movie.director}</small></p>
                        <p class="card-text no-spacing text-muted"><small>Cast: ${movie.actors}</small></p>
                        <a href="${movie.trailer}" class="text-decoration-none" target="_blank" rel="noopener noreferrer"><small>Watch trailer<small></a>
                    </div>
                </div>

                ${userScoresHtml}

                <div class="row text-center mt-3">
                <button type="button"
                        class="btn btn-link text-muted text-decoration-none edit-blacklist-link fst-italic fs-4 explain-btn"
                        data-bs-toggle="modal"
                        data-bs-target="#explainModal"
                        data-slug="${movie.slug}"
                        data-title="${movie.title}"
                        data-year="${movie.year}"
                        data-weight="${0}"
                        id="explain_${movie.slug}_0_0">
                    Why do we recommend this movie?
                </button>
                </div>
                
            </div>
        </div>
    `;
    
    return modalHtml;
}

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



////////////////////////////////////////// Set Display Names //////////////////////////////////////////
function setDisplayNames(user1_name, user2_name) {
    document.getElementById("commonWatchlistCount").textContent = '...';
    // document.getElementById("RC-name-1").textContent = "Rewatches for " + user1_name;
    // document.getElementById("RC-name-2").textContent = "Rewatches for " + user2_name;
    // document.getElementById("RC-sub-1").textContent = "Movies watched by " + user1_name + " that " + user2_name + " might like!";
    // document.getElementById("RC-sub-2").textContent = "Movies watched by " + user2_name + " that " + user1_name + " might like!";
    // document.getElementById(`SWL1_title`).textContent = `On ${user1_name}'s`;
    // document.getElementById(`SWL1_subtitle`).textContent = `Movies on ${user1_name}'s watchlist that ${user2_name} might like!`;
    // document.getElementById(`SWL2_title`).textContent = `On ${user2_name}'s`;
    // document.getElementById(`SWL2_subtitle`).textContent = `Movies on ${user2_name}'s watchlist that ${user1_name} might like!`;
    // document.getElementById(`RC_user1_name`).textContent = `${user1_name}`;
    // document.getElementById(`RC_user2_name`).textContent = `${user2_name}`;
}



////////////////////////////////////////// Compare Button //////////////////////////////////////////
document.getElementById('compareButton').addEventListener('click', async function (event) {

    document.getElementById("go-spinner").style.display = "block"; // Show loading spinner

    

    const username1 = allUsers[0].username;
    const username2 = allUsers[1].username;

    const refresh = event.refresh ?? 0; // Use event.refresh if available, otherwise default to true
    if (refresh == 0) {
        document.getElementById("contentContainer").classList.add('d-none');
        await InitializeAndTrain();
    }
    else if (refresh == 1){
        // Show the content container
        console.log("WAS HERE 1");
        await InitializeAndTrain();
    }

    // Set display names
    const user1_name = allUsers[0].name;
    const user2_name = allUsers[1].name;
    setDisplayNames(user1_name, user2_name);

    // Get filter settings
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    // Fetch content data
    await FetchCommonWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    // Fetch single watchlist data
    await FetchSingleWatchlist(minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    // Fetch rewatchlist data
    await generateRewatchCarousels(allUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);

    //document.getElementById('RecommendContainerReal').classList.add('d-none');
    // Show the content container

    document.getElementById("contentContainer").classList.remove('d-none');
    
    // Get Recommendations
    await generateRecUserButtons(refresh);

    // Show the real recommendations content
    //document.getElementById("RecommendContainerReal").classList.remove('d-none');
    //document.getElementById("RecommendContainerReal").scrollTop = 0;
    document.getElementById("go-spinner").style.display = "none"; // Hide loading spinner

    // Fire the event so `waitForCompareUpdate()` knows it's done
    // const completeEvent = new Event("compareComplete");
    // document.getElementById("compareButton").dispatchEvent(completeEvent);

});

function getActiveUsernames() {
    const container = document.getElementById("userButtonsContainer");
    const activeButtons = container.querySelectorAll("button.active");
    return Array.from(activeButtons).map(btn => btn.getAttribute("data-user"));
}


async function generateRecUserButtons(refresh) {

    if (refresh == 0) {
        console.log("Refreshing user buttons");
        const container = document.getElementById("userButtonsContainer");
        container.innerHTML = ""; // Clear previous buttons

        for (let [index, user] of allUsers.entries()) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-outline-warning";
            button.innerText = user.name;
            button.setAttribute("weight", 1); // Optional: for custom logic
            button.setAttribute("data-user", user.username); // Optional: for custom logic
            // set button active
            button.classList.add("active");

            // Optional: specific IDs for known users
            button.id = `user-btn-${user}`;

            // Toggle active class on click
            button.addEventListener("click", async () => {
                button.classList.toggle("active");
            
                const minRating = document.getElementById('minRating').value;
                const maxRating = document.getElementById('maxRating').value;
                const minRuntime = document.getElementById('minRuntime').value;
                const maxRuntime = document.getElementById('maxRuntime').value;
                const minYear = document.getElementById('minYear').value;
                const maxYear = document.getElementById('maxYear').value;
            
                // ✅ Await now works here
                await FetchRecommendations(getActiveUsernames(), minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
            });

            container.appendChild(button);
        };
    }

    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    // get all users whose buttons are active
    const activeButtons = document.querySelectorAll("#userButtonsContainer button.active");
    const allActiveUsers = Array.from(activeButtons).map(btn => btn.getAttribute("data-user"));
    
    await FetchRecommendations(allActiveUsers, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
}

////////////////////////////////////////// Radio Buttons //////////////////////////////////////////
// document.querySelectorAll('input[name="btnradio"]').forEach(radio => {
//     radio.addEventListener("change", async function () {

//         const selectedRadio = document.querySelector('input[name="btnradio"]:checked');
//         const associatedLabel = document.querySelector(`label[for="${selectedRadio.id}"]`);
//         const weight = parseInt(associatedLabel.getAttribute("weight"), 10);

//         // Get filter settings
//         const minRating = document.getElementById('minRating').value;
//         const maxRating = document.getElementById('maxRating').value;
//         const minRuntime = document.getElementById('minRuntime').value;
//         const maxRuntime = document.getElementById('maxRuntime').value;
//         const minYear = document.getElementById('minYear').value;
//         const maxYear = document.getElementById('maxYear').value;

//         document.getElementById("RecommendContainerReal").classList.add('d-none');
//         await FetchRecommendations(allUsers[0].username, allUsers[1].username, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear);
//         document.getElementById("RecommendContainerReal").classList.remove('d-none');
//         document.getElementById("RecommendContainerReal").scrollTop = 0;
//         });
// });


async function FetchRecommendations(usernames, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear) {
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
                    <div class="card rec-card show-movie-modal mb-3" slug="${movie.slug}">
                        <div class="row g-0" >
                            <div class="col-auto">
                                <img src="${movie.poster}" class="rec-card-img open-movie-modal rounded-start" alt="${movie.title}" slug="${movie.slug}">
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

        // Call showRecommendedMovie function for the first movie
        const firstMovieSlug = data[0].slug;
        showRecommendedMovie(firstMovieSlug);

    } catch (error) {
        console.error(error);
    }
}

