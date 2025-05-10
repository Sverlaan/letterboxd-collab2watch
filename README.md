# Collab2Watch
A web tool that recommends movies for multiple parties by combining Letterboxd user profiles and applying group collaborative filtering.

## Hosted website
The website is currently hosted through Railway [here](https://collab2watch-production.up.railway.app).
Due to costs, it may not always be available.

## Run locally
Everything needed, including the recommendation model and a movie details database, are available in this repository. simply clone or download the repo.

It is recommended to install the dependencies inside a virtual environment (example for Mac):
```
python3.13 -m venv .venv
source .venv/bin/activate
```

Then, install the dependencies using
```
pip install -r requirements.txt
```

To run the Flask app, simply run `app.py`

## Credits
We want to highlight the following two libraries:

- [letterboxdpy](https://github.com/nmcassa/letterboxdpy), for webscraping the public letterboxd profiles of the users.
- [matrix-factorization](https://github.com/Quang-Vinh/matrix-factorization), a short and simple implementation of kernel matrix factorization with online-updating. Implements this [paper](https://dl.acm.org/doi/10.1145/1454008.1454047) by Rendle & Schmidt-Thieme.

The Kaggle dataset initially used can be found [here](https://www.kaggle.com/datasets/freeth/letterboxd-film-ratings?resource=download&select=ratings.csv). It contains over 18M ratings from over 11K popular Letterboxd users and was scraped using [letterboxd-scraper](https://github.com/adamjhf/letterboxd-scraper).

The movie images and details are either scraped from Letterboxd directly using the aforementioned webscrapers or fetched through the TMDb API in case the former fails. This product uses the TMDB API but is not endorsed or certified by TMDB.

This project is built using Flask, a lightweight Python web framework, and styled with Bootstrap to ensure a responsive and modern design.



