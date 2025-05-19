/////////////////////////////////////////// Categories //////////////////////////////////////////
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const selectedCategory = btn.dataset.category;
        console.log("Selected:", selectedCategory);

        // Change id="categoryText" to the selected category
        const categoryText = document.getElementById('categoryText');
        if (selectedCategory === 'recommendations') {
            categoryText.innerHTML = "Combined and personalized recommendations for movies you have not seen!<br>Use the blacklist functionality to dismiss any suggestions and tune the recommendations.";
        }
        else if (selectedCategory === 'watchlist') {
            categoryText.innerHTML = "Movies you want to watch!<br>This is the common watchlist of all selected users.";
        }
        else if (selectedCategory === 'rewatches') {
            categoryText.innerHTML = "Movies you might want to rewatch!<br>These are movies the selected users have already seen.";
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
    console.log("Selected for reset filters:", category);
    await Recommend(category);
});

document.getElementById('applyFilters').addEventListener('click', async function (event) {

    const category = getSelectedCategory();
    console.log("Selected for reset filters:", category);
    await Recommend(category);
});

// Listen for the form submit event
document.getElementById('usernameForm').addEventListener('submit', function (event) {
    event.preventDefault();

    fetchUserData(document.getElementById('inputUsername').value);
    document.getElementById('inputUsername').placeholder ='Username';  
    document.getElementById('inputUsername').value = "";
});

// For resizing the sidebar
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
let isResizing = false;

resizer.addEventListener('mousedown', function (e) {
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
  document.body.classList.add('no-select'); // 👈 prevent text selection
});

document.addEventListener('mousemove', function (e) {
  if (!isResizing) return;

  const newWidth = e.clientX;
  if (newWidth > 300 && newWidth < 800) {
    sidebar.style.width = newWidth + 'px';
  }
});

document.addEventListener('mouseup', function () {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = 'default';
    document.body.classList.remove('no-select'); // 👈 re-enable text selection
  }
});
