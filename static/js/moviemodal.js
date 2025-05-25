////////////////////////////////////////// Movie Modal //////////////////////////////////////////
// Listen for click events on the body
document.body.addEventListener("click", async function (event) {

    let modalTrigger = event.target.closest(".open-movie-modal");

    if (modalTrigger) {

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
        const { minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear } = GetFilterSettings();

        // Fetch similar movies and populate the DOM
        const response2 = await fetch(`/fetch_similar_movies/${movie.slug}/${minRating}/${maxRating}/${minRuntime}/${maxRuntime}/${minYear}/${maxYear}`);
        const data = await response2.json();

        if (!data.success)
        {
            console.log(`No similar movies found for ${movie.slug}`);
            document.getElementById("similarMoviesContainer").classList.add('d-none');
        } 
        else {

            const movies = data.movies;

            for (let i = 0; i < movies.length; i++) {
                let similarMovie = movies[i];
                let similarMovieHtml = `
                <div class="col">
                    <img src="${similarMovie.poster}" 
                        class="card card-img-top hover-zoom rounded open-movie-modal" 
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
        <div class="row g-3 mt-1 justify-content-start flex-nowrap overflow-auto no-scrollbar" style="white-space: nowrap;" id="userScoresRow">
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 text-normal">${movie.rating}</h5>
                <img src="${letterboxd_logo}" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-normal text-center"><small>Letterboxd</small></p>
            </div>
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 ${movie.score_combined_color}">${movie.score_combined}</h5>
                <img src="https://cdn-icons-png.flaticon.com/512/718/718339.png" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-normal text-center"><small>Combined</small></p>
            </div>
    `;

    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const scoreData = movie.all_scores.find(u => u.username === user.username);

        userScoresHtml += `
            <div class="col-md-3 d-flex flex-column align-items-center" style="min-width: 150px;">
                <h5 class="text-center mb-2 ${scoreData ? scoreData.score_color : 'text-normal'}">${scoreData ? scoreData.score : '--'}</h5>
                <img src="${user.avatar}" class="rounded-circle" style="width: 60px; height: 60px;">
                <p class="text-normal text-center"><small>${user.name}</small></p>
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
                                <div class="row g-3 justify-content-evenly p-1 mb-3" id="similarMovies"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;

    return modalHtml;
}






