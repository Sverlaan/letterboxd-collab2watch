/////////////////////////////////////////// Categories //////////////////////////////////////////
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const selectedCategory = btn.dataset.category;

        // Change id="categoryText" to the selected category
        const categoryText = document.getElementById('categoryText');
        if (selectedCategory === 'recommendations') {
            categoryText.innerHTML = "Recommendations for movies the selected users have not seen!<br>Use the blacklist functionality to dismiss any suggestions and tune the recommendations.";
        }
        else if (selectedCategory === 'watchlist') {
            categoryText.innerHTML = "This is the common watchlist of all selected users!<br>The movies are sorted by the predicted ratings of all users in the group.";
        }
        else if (selectedCategory === 'rewatches') {
            categoryText.innerHTML = "Movies the selected users have already seen but might want to rewatch!<br>The movies are sorted by the predicted ratings of the non-selected users in the group.";
        }
        else {
            categoryText.innerHTML = "TODO TEXT HERE";
        }

        await Recommend(selectedCategory);
    });
});


// Function to get the selected category from the category buttons
function getSelectedCategory() {
    const activeBtn = document.querySelector('.category-btn.active');
    return activeBtn ? activeBtn.dataset.category : null;
}


// Hide toggle buttons when a modal is shown
document.addEventListener('show.bs.modal', function (event) {
    document.getElementById('sidebarToggle').style.display = 'none';
    document.getElementById('theme-toggle').style.display = 'none';
});

document.addEventListener('hidden.bs.modal', function (event) {
    document.getElementById('sidebarToggle').style.display = '';
    document.getElementById('theme-toggle').style.display = '';
});



////////////////////////////////////////// Filter and Settings //////////////////////////////////////////
function GetFilterSettings() {
    const minRating = document.getElementById('minRating').value;
    const maxRating = document.getElementById('maxRating').value;
    const minRuntime = document.getElementById('minRuntime').value;
    const maxRuntime = document.getElementById('maxRuntime').value;
    const minYear = document.getElementById('minYear').value;
    const maxYear = document.getElementById('maxYear').value;

    return { minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear };
}

document.getElementById('resetFilters').addEventListener('click', async function (event) {

    document.getElementById('minRating').value = 0;
    document.getElementById('maxRating').value = 5;
    document.getElementById('minRuntime').value = 70;
    document.getElementById('maxRuntime').value = 250;
    document.getElementById('minYear').value = 1940;
    document.getElementById('maxYear').value = 2025;

    const category = getSelectedCategory();
    await Recommend(category);
});

document.getElementById('applyFilters').addEventListener('click', async function (event) {

    const category = getSelectedCategory();
    await Recommend(category);
});

// Listen for the form submit event
document.getElementById('usernameForm').addEventListener('submit', function (event) {
    event.preventDefault();

    fetchUserData(document.getElementById('inputUsername').value);
    document.getElementById('inputUsername').placeholder ='Letterbox username';  
    document.getElementById('inputUsername').value = "";
});



const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
const toggleButton = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('sidebarToggleIcon');

let sidebarVisible = true;

function updateSidebarState(show) {
  sidebarVisible = show;

  if (window.innerWidth < 768) {
    sidebar.classList.toggle('slide-visible', show);
    sidebar.classList.toggle('slide-hidden', !show);
    document.body.classList.toggle('mobile-open', show);

    // Icon change
    toggleIcon.className = show ? 'bi bi-x-lg' : 'bi bi-list';
  } else {
    // On desktop, always show sidebar and enable resizer
    sidebar.classList.remove('slide-hidden', 'slide-visible');
    document.body.classList.remove('mobile-open');
    if (resizer) resizer.style.display = 'block';
  }
}

toggleButton.addEventListener('click', () => {
  if (window.innerWidth < 768) {
    updateSidebarState(!sidebarVisible);
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    updateSidebarState(true); // always visible on desktop
  }
});

// Initial state setup
updateSidebarState(window.innerWidth >= 768);



// For resizing the sidebar
// let isResizing = false;

// resizer.addEventListener('mousedown', function (e) {
//   isResizing = true;
//   document.body.style.cursor = 'ew-resize';
//   document.body.classList.add('no-select'); // 👈 prevent text selection
// });

// document.addEventListener('mousemove', function (e) {
//   if (!isResizing) return;

//   const newWidth = e.clientX;
//   if (newWidth > 300 && newWidth < 800) {
//     sidebar.style.width = newWidth + 'px';
//   }
// });

// document.addEventListener('mouseup', function () {
//   if (isResizing) {
//     isResizing = false;
//     document.body.style.cursor = 'default';
//     document.body.classList.remove('no-select'); // 👈 re-enable text selection
//   }
// });
