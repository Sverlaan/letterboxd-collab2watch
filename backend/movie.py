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
    API_KEY = "123"
    #raise ValueError("Missing API_KEY environment variable!")


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
    slugs_to_fetch = set(movie_slugs).difference(slugs_in_db)
    for slug in slugs_to_fetch:
        print(f"{slug} not in db. Resort to scraping.")
        movie_data = get_movie_data(slug)
        movie = Movie(**movie_data)
        db.session.add(movie)
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
    """Get movie data from Letterboxd API"""
    try:
        movie_inst = movie.Movie(movie_slug)

        tagline = movie_inst.tagline
        if tagline is None:
            tagline = ""

        banner = movie_inst.banner
        if banner is None:
            print(f"Using TMDb API to get backdrop for {movie_slug}")
            try:
                banner = get_TMDb_backdrop(movie_inst.tmdb_link)
            except:
                banner = ""

        trailer_obj = movie_inst.trailer
        if trailer_obj is None:
            trailer = ""
        else:
            trailer = trailer_obj['link']

        rating = movie_inst.rating
        if rating is None:
            print(rating)
            rating = -1

        return {"slug": movie_slug,
                "title": movie_inst.title,
                "poster": movie_inst.poster,
                "banner": banner,
                "year": movie_inst.year,
                "description": movie_inst.description,
                "director": ", ".join([director['name'] for director in movie_inst.crew['director']]),
                "rating": rating,
                "runtime": movie_inst.runtime,
                "genres": ", ".join([item['name'] for item in movie_inst.genres if item['type'] == "genre"]),
                "actors": ", ".join([actor['name'] for actor in movie_inst.cast[:3]]),
                "tagline": tagline,
                "tmdb_link": movie_inst.tmdb_link,
                "imdb_link": movie_inst.imdb_link,
                "letterboxd_link": movie_inst.url,
                "trailer": trailer}
    except:
        print("Error in get_movie_data")
        return {"slug": movie_slug, "title": "Error", "poster": "", "banner": "", "year": "", "description": "",
                "director": "", "rating": -1, "runtime": "", "genres": "", "actors": "", "tagline": "",
                "tmdb_link": "", "imdb_link": "", "letterboxd_link": "", "trailer": ""}


def get_TMDb_backdrop(tmdb_link):
    """
    In case the movie banner is not available through the letterboxd scraper, we use TMDb API to retrieve the backdrop
    """
    movie_tmdb_id = tmdb_link[33:-1]

    time.sleep(0.2)  # Sleep for 0.1 seconds to avoid api rate limit?
    request = f"https://api.themoviedb.org/3/movie/{movie_tmdb_id}?api_key={api_key}"

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
