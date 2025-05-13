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
