# Imports
from letterboxdpy import movie
import requests
import time
from flask_sqlalchemy import SQLAlchemy
from timeit import default_timer as timer
import os
# from dotenv import load_dotenv
# load_dotenv()

db = SQLAlchemy()  # Define db, initialize in app.py

API_KEY = os.getenv("API_KEY")  # Retrieves API_KEY from environment variables
if not API_KEY:
    # TODO: Fix API_KEY through dotenv
    API_KEY = "000"
    # raise ValueError("Missing API_KEY environment variable!")

SKIP_NON_DB_MOVIES = True  # Set to True if you want to skip movies not in db
skip_list_for_non_db_slugs = set()  # Set to True if you want to skip slugs for movies not in db


class Movie(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    year = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text, nullable=True)
    director = db.Column(db.String(255), nullable=True)
    rating = db.Column(db.Float, nullable=True)
    runtime = db.Column(db.Integer, nullable=True)
    genres = db.Column(db.String(255), nullable=True)
    actors = db.Column(db.String(255), nullable=True)
    tagline = db.Column(db.Text, nullable=True)
    poster = db.Column(db.String(255), nullable=True)
    banner = db.Column(db.String(255), nullable=True)
    tmdb_link = db.Column(db.String(255), nullable=True)
    imdb_link = db.Column(db.String(255), nullable=True)
    letterboxd_link = db.Column(db.String(255), nullable=True)
    trailer = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "year": self.year, "description": self.description,
                "director": self.director, "rating": self.rating, "runtime": self.runtime, "genres": self.genres,
                "actors": self.actors, "tagline": self.tagline, "poster": self.poster,
                "banner": self.banner, "slug": self.slug, "tmdb_link": self.tmdb_link, "imdb_link": self.imdb_link,
                "letterboxd_link": self.letterboxd_link, "trailer": self.trailer}


def retrieve_movies(movie_slugs, minRating=0, maxRating=5, minRuntime=0, maxRuntime=9999, minYear=1870, maxYear=2030, top_k=-1, scores=None):

    start = timer()

    # Fetch movie details of movies not in db
    slugs_in_db = {movie.slug for movie in Movie.query.filter(Movie.slug.in_(movie_slugs)).all()}
    slugs_to_fetch = set(movie_slugs).difference(slugs_in_db).difference(skip_list_for_non_db_slugs)

    exclude_non_db_movies = False  # TODO: Set to True if you want to skip movies not in db
    if exclude_non_db_movies:
        print(f"Excluding movies not in db")
        movie_slugs = [slug for slug in movie_slugs if slug in slugs_in_db]  # Get rid of this once fixed
    else:
        for slug in slugs_to_fetch:
            try:
                print(f"{slug} not in db. Resort to scraping.")
                movie_data = get_movie_data(slug)
                movie = Movie(**movie_data)
                db.session.add(movie)
            except:
                print(f"Failed to retrieve movie data for {slug}. Not added to db.")
                skip_list_for_non_db_slugs.add(slug)  # Add to skip list to avoid future attempts
                continue
        db.session.commit()

    retrieved_movies = Movie.query.filter(Movie.rating >= minRating, Movie.rating <= maxRating,
                                          Movie.runtime >= minRuntime, Movie.runtime <= maxRuntime,
                                          Movie.year >= minYear, Movie.year <= maxYear,
                                          Movie.slug.in_(movie_slugs)).all()

    # Sort the retrieved movies in the order of movie_slugs
    # O(n) operation, faster than order-by in SQL
    movie_dict = {movie.slug: movie.to_dict() for movie in retrieved_movies}
    movies = [movie_dict[slug] for slug in movie_slugs if slug in movie_dict]

    # Limit to top-k movies
    movies = movies[:top_k] if top_k != -1 else movies

    # Add scores if available
    if scores is not None:
        for movie in movies:
            movie["score"] = round(scores[movie["slug"]] * 20, 1)

    # print(f"Retrieve movies from: {timer() - start}")

    return movies


def get_movie_data(movie_slug):
    """Get movie data from Letterboxd API (with fallback to TMDb API)"""
    # TODO: create a function for testing this
    try:
        movie_inst = movie.Movie(movie_slug)

        title = movie_inst.title
        if title is None:
            raise ValueError(f"Movie {movie_slug} has no title")

        poster = movie_inst.poster
        if poster is None:
            raise ValueError(f"Movie {movie_slug} has no poster")

        banner = movie_inst.banner
        if banner is None:
            print(f"Using TMDb API to get backdrop for {movie_slug}")
            try:
                banner = get_TMDb_backdrop(movie_inst.tmdb_link)
            except:
                raise ValueError(f"Movie {movie_slug} has no banner")

        year = movie_inst.year
        if year is None:
            raise ValueError(f"Movie {movie_slug} has no year")

        description = movie_inst.description
        if description is None:
            description = "Unknown description"

        director = ", ".join([director['name'] for director in movie_inst.crew['director']])
        if not director:
            director = ""

        runtime = movie_inst.runtime
        if runtime is None:
            runtime = "TBA"

        rating = movie_inst.rating
        if rating is None:
            rating = -1  # Default to -1 if no rating is available

        genres = ", ".join([item['name'] for item in movie_inst.genres if item['type'] == "genre"])
        if not genres:
            genres = ""

        actors = ", ".join([actor['name'] for actor in movie_inst.cast[:3]])
        if not actors:
            actors = ""

        tmdb_link = movie_inst.tmdb_link
        if tmdb_link is None:
            tmdb_link = ""

        imdb_link = movie_inst.imdb_link
        if imdb_link is None:
            imdb_link = ""

        letterboxd_link = movie_inst.url
        if letterboxd_link is None:
            letterboxd_link = ""

        tagline = movie_inst.tagline
        if tagline is None:
            tagline = ""

        trailer = movie_inst.trailer
        if trailer is None:
            trailer = ""
        else:
            trailer = trailer['link']

        return True, {"slug": movie_slug, "title": title, "poster": poster, "banner": banner, "year": year, "description": description, "director": director, "rating": rating, "runtime": runtime, "genres": genres, "actors": actors, "tagline": tagline, "tmdb_link": tmdb_link, "imdb_link": imdb_link, "letterboxd_link": letterboxd_link, "trailer": trailer}
    except:
        return False, {}


def get_TMDb_backdrop(tmdb_link):
    """
    In case the movie banner is not available through the letterboxd scraper, we use TMDb API to retrieve the backdrop
    """
    movie_tmdb_id = tmdb_link[33:-1]

    time.sleep(0.2)  # Sleep for 0.1 seconds to avoid api rate limit?
    request = f"https://api.themoviedb.org/3/movie/{movie_tmdb_id}?api_key={API_KEY}"

    r = requests.get(request)
    response = r.json()
    result = response.get('backdrop_path')
    return "https://image.tmdb.org/t/p/original/" + result


# def put_movies_in_db(movie_slugs):

#     with app.app_context():
#         for slug in tqdm(movie_slugs):
#             movie = Movie.query.filter_by(slug=slug).first()
#             if movie is None:
#                 movie_data = get_movie_data(slug)
#                 movie = Movie(**movie_data)
#                 db.session.add(movie)
#         db.session.commit()

def get_movie_data_from_TMDb(movie_slug):
    """
    Get movie data from TMDb API
    """
    movie_tmdb_id = movie_slug[33:-1]
    time.sleep(0.2)  # Sleep for 0.1 seconds to avoid api rate limit?
    request = f"https://api.themoviedb.org/3/movie/{movie_tmdb_id}?api_key={API_KEY}"

    r = requests.get(request)
    response = r.json()

    return {"slug": movie_slug,
            "title": response.get("title", ""),
            "poster": "https://image.tmdb.org/t/p/original/" + response.get("poster_path", ""),
            "banner": "https://image.tmdb.org/t/p/original/" + response.get("backdrop_path", ""),
            "year": response.get("release_date", "").split("-")[0],
            "description": response.get("overview", ""),
            "director": ", ".join([crew['name'] for crew in response.get('credits', {}).get('crew', []) if crew['job'] == 'Director']),
            "rating": response.get("vote_average", -1),
            "runtime": response.get("runtime", 0),
            "genres": ", ".join([genre['name'] for genre in response.get('genres', [])]),
            "actors": ", ".join([actor['name'] for actor in response.get('credits', {}).get('cast', [])[:3]]),
            "tagline": response.get("tagline", ""),
            "tmdb_link": f"https://www.themoviedb.org/movie/{movie_tmdb_id}",
            "imdb_link": f"https://www.imdb.com/title/{response.get('imdb_id', '')}/",
            "letterboxd_link": "",
            "trailer": ""}  # TMDb does not provide trailer link


# if __name__ == "__main__":
#     print("Running movie.py as a script")
#     slug = "sentimental-value-2025"
#     # slug = 'inception'

#     movie_data = get_movie_data(slug)
#     print(movie_data)
