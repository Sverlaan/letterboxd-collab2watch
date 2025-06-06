import warnings
from flask import Flask, render_template, jsonify
from timeit import default_timer as timer
import threading
from backend.movie import db, Movie, retrieve_movies
from backend.recommend import MovieRecommender, get_common_watchlist, get_rewatchlist
from backend.user import UserProfile
import os


# Ignore warnings
warnings.filterwarnings("ignore")

# Initialize Flask app
app = Flask(__name__)

# Configure the database path
db_path = os.path.join(os.path.dirname(__file__), 'database/movies.db')  # Use local directory
print(f"Database path: {db_path}")
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with the Flask app
db.init_app(app)

# Configure the model path
if 'RAILWAY_ENVIRONMENT' in os.environ:  # This variable exists only in Railway
    model_path = os.path.join(os.path.dirname(__file__), 'model/kernel_mf.pkl')
else:
    model_path = os.path.join(os.path.dirname(__file__), 'model/kernel_mf.pkl')
print(f"Model path: {model_path}")

# Initialize global variables
DEBUG_MODE = False
user_profiles = dict()
recommender = None


################ INITIALIZATION ################
@app.route('/')
def home():
    """Render the home page."""
    if not DEBUG_MODE:
        user_profiles.clear()  # Clear user profiles on home page load, # TODO: off only for quick testing
    return render_template('index.html')


@app.route('/init_user/<string:username>', methods=['GET'])
def init_user(username):
    """Initialize a user profile."""
    try:
        start = timer()
        if username not in user_profiles and len(user_profiles) < 8:
            profile = UserProfile(username)
            user_profiles[username] = profile
            user_data = profile.to_dict()
            return jsonify(user_data)
        else:
            # TODO: Below only for quick testing
            user_data = user_profiles[username].to_dict()
            return jsonify(user_data)
            # # user_profiles[username].initialize_complete = False  # Reset initialization
            raise Exception("User already exists")
    except:
        return jsonify({"error": "User not found"}), 404


@app.route('/fetch_user_data/<string:username>', methods=['GET'])
def fetch_user_data(username):
    """Fetch user data."""
    try:
        print(f"Initializing {username}...")
        start = timer()
        user_inst = user_profiles[username]
        if not user_inst.initialize_complete:
            user_inst.initialize_complete_profile()
            print(f"Initialized {username} in {timer() - start} seconds")
        else:
            print(f"{username} already initialized")
        return jsonify({"success": True})
    except:
        return jsonify({"success": False}), 404


@app.route("/preprocess_data/<string:usernames>", methods=["GET"])
def preprocess_data(usernames):
    """Preprocess data for the recommender system."""
    global recommender
    try:
        if recommender is None:
            recommender = MovieRecommender(model_path=model_path)

        usernames = usernames.split(",")
        recommender.preprocess(usernames, user_profiles)
        return jsonify({"success": True})
    except:
        return jsonify({"success": False}), 404


@app.route("/train_model", methods=["GET"])
def train_model():
    """Train the recommender model."""
    try:
        recommender.train_model()
        return jsonify({"success": True})
    except:
        return jsonify({"success": False}), 404


################ FETCH DATA FOR CONTENT ################
@app.route('/fetch_recommendations/<string:allUsernames>/<string:selectedUsernames>/<string:selectedCategory>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_recommendations(allUsernames, selectedUsernames, selectedCategory, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):
    """Fetch recommendations based on selected category."""

    start = timer()
    allUsernames = allUsernames.split(",")
    selectedUsernames = selectedUsernames.split(",")

    scores_dict = None
    top_k = 50

    if selectedCategory == "recommendations":
        slugs, scores_dict = recommender.get_recommendations(selectedUsernames, user_profiles, amount=5000)
    elif selectedCategory == "watchlist":
        slugs = get_common_watchlist(allUsernames, selectedUsernames, user_profiles, recommender)
        top_k = 1000  # Increase top_k for watchlist to get more results
    elif selectedCategory == "rewatches":
        slugs = get_rewatchlist(allUsernames, selectedUsernames, user_profiles, recommender)
    else:
        return jsonify({"error": "Invalid category"}), 400

    movies = retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=top_k, scores=scores_dict)
    print(f"Time taken getting recommendations and retrieving: {timer() - start}")
    return jsonify(movies)


@app.route('/fetch_movie_data_for_modal/<string:slug>/<string:usernames>', methods=['GET'])
def fetch_movie_data_for_modal(slug, usernames):
    """Fetch movie data for a modal."""
    # Get movie details
    start = timer()
    movie = Movie.query.filter_by(slug=slug).first()
    if movie is None:
        raise Exception(f"{slug} not in db. Since this is for opening a modal, this should not happen.")
    movie_data = movie.to_dict()

    # Split usernames (assuming comma-separated)
    username_list = usernames.split(",")

    all_scores = []
    predictions = []

    for username in username_list:
        rating = user_profiles[username].get_rating(slug)
        if rating is not None:
            score = f"{rating}"
            score_color = "text-muted"
            numeric_score = rating  # for combined score
        else:
            pred = recommender.predict_user_rating(username, slug)
            if pred is not None:
                score = f"{round(pred * 20, 1)}%"
                score_color = "text-score"
                numeric_score = pred * 20  # pred is usually 0–1, convert to 0–100 scale
            else:
                score = "--"
                score_color = "text-muted"
                numeric_score = None  # no data

        all_scores.append({
            "username": username,
            "score": score,
            "score_color": score_color,
            "numeric_score": numeric_score  # keep numeric for averaging later
        })

    # Calculate combined score (average of available numeric scores)
    if not None in [user["numeric_score"] for user in all_scores]:
        sum_total = 0
        for user in all_scores:
            if user["score_color"] == "text-score":
                sum_total += user["numeric_score"]
            else:
                sum_total += user["numeric_score"] * 20.0
        avg_score = sum_total / len(all_scores)
        movie_data["score_combined"] = f"{round(avg_score, 1)}%"
        movie_data["score_combined_color"] = "text-score"
    else:
        movie_data["score_combined"] = "--"
        movie_data["score_combined_color"] = "text-muted"

    # Attach all users' score data
    movie_data["all_scores"] = all_scores

    return jsonify(movie_data)


@app.route('/fetch_similar_movies/<string:slug>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_similar_movies(slug, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    hits, similar_movies = recommender.get_similar_movies(slug, top_n=6)
    if hits == False:
        return jsonify({"success": False, "message": "No similar movies found", "movies": []})  # Return a valid response with a flag

    movies = retrieve_movies(similar_movies, top_k=6)

    return jsonify({"success": True, "message": "Similar movies found", "movies": movies})


@app.route('/fetch_explanation/<string:username>/<string:slug>', methods=['GET'])
def fetch_explanation(username, slug):
    start = timer()
    hits, influential_movies = recommender.get_influential_movies(username, user_profiles, slug)
    if hits == False:
        return jsonify({"success": False, "message": "No similar movies found", "movies": []})  # Return a valid response with a flag

    # Append slug to influential movies
    movies = retrieve_movies(influential_movies, top_k=-1)

    return jsonify({"success": True, "message": "Influential movies found", "username": username, "movies": movies})


############### HANDLE BLACKLISTS ################
@app.route('/fetch_blacklists/<string:usernames>', methods=['GET'])
def fetch_blacklists(usernames):
    usernames = usernames.split(",")
    user_blacklists = {}
    for username in usernames:
        if username in user_profiles:
            blacklist = list(user_profiles[username].get_blacklist())
            movies_bl = retrieve_movies(blacklist, top_k=-1)
            user_blacklists[username] = movies_bl
        else:
            return jsonify({"error": f"User {username} not found"}), 404
    return jsonify(user_blacklists)


@app.route('/add_to_blacklist/<string:username>/<string:slug>', methods=['POST'])
def add_to_blacklist(username, slug):
    user_profiles[username].add_to_blacklist(slug)
    print(f"Blacklist for {username} is updated: {user_profiles[username].blacklist}")
    return jsonify({"message": "Blacklist updated"})


@app.route('/remove_from_blacklist/<string:username>/<string:slug>', methods=['DELETE'])
def remove_from_blacklist(username, slug):
    user_profiles[username].remove_from_blacklist(slug)
    print(f"Blacklist for {username} is updated: {user_profiles[username].blacklist}")
    return jsonify({"message": "Blacklist updated"})


@app.route('/reset_blacklist/<string:username>', methods=['DELETE'])
def reset_blacklist(username):
    user_profiles[username].reset_blacklist()
    print(f"Blacklist for {username} is reset")
    return jsonify({"message": "Blacklist reset"})


if __name__ == '__main__':
    print("Starting Flask App...")
    app.run(debug=DEBUG_MODE)
