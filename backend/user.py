# Imports
from letterboxdpy import user
import time
from timeit import default_timer as timer


class UserProfile:

    def __init__(self, username):
        self.username = username
        self.user_instance = user.User(username)
        self.display_name = self.user_instance.display_name
        self.avatar = self.user_instance.get_avatar()['url'] + '?' + str(time.time())
        self.stats = self.user_instance.stats
        self.num_movies_watched = self.stats['films']
        self.watchlist_length = self.user_instance.watchlist_length
        self.url = self.user_instance.url

        self.initialize_complete = False
        self.watchlist = None
        self.blacklist = set()
        self.ratings = None
        self.watched = None

    def get_blacklist(self):
        """
        Get user's blacklist
        """
        return self.blacklist

    def add_to_blacklist(self, slug):
        """
        Add slug to user's blacklist
        """
        if slug not in self.blacklist:
            self.blacklist.add(slug)

    def remove_from_blacklist(self, slug):
        """
        Remove slug from user's blacklist
        """
        if slug in self.blacklist:
            self.blacklist.remove(slug)

    def reset_blacklist(self):
        """
        Reset user's blacklist
        """
        self.blacklist = set()

    def get_watchlist(self):
        """
        Get watchlist of user
        """
        if self.watchlist is None or self.initialize_complete is False:
            self.watchlist = {movie['slug'] for movie in self.user_instance.get_watchlist()['data'].values()}
        return self.watchlist

    def get_watched(self):
        """
        Get watched movies of user
        """
        if self.watched is None or self.initialize_complete is False:
            self.watched = {slug for slug in self.user_instance.get_films()['movies'].keys()}
        return self.watched

    def get_ratings(self):
        """
        Get all ratings of user
        """
        if self.ratings is None or self.initialize_complete is False:
            all_user_ratings = {key: value['rating']/2.0 for key, value in self.user_instance.get_films()['movies'].items() if value['rating'] is not None}
            self.ratings = all_user_ratings
        return self.ratings

    def get_rating(self, movie_slug):
        """
        Get rating of user for a specific movie
        """
        if self.ratings is None or self.initialize_complete is False:
            self.get_ratings()
        if movie_slug in self.ratings:
            return self.ratings[movie_slug]
        return None

    def initialize_complete_profile(self):
        """
        Initialize watchlist, watched and ratings
        """
        timer_start = timer()
        self.get_watchlist()
        print(f"Watchlist: {timer() - timer_start}")
        timer_start = timer()
        self.get_watched()
        print(f"Watched: {timer() - timer_start}")
        timer_start = timer()
        self.get_ratings()
        print(f"Ratings: {timer() - timer_start}")
        timer_start = timer()
        self.get_blacklist()
        print(f"Blacklist: {timer() - timer_start}")

        self.initialize_complete = True

    def to_dict(self):
        return {"username": self.username,
                "name": self.display_name,
                "avatar": self.avatar,
                "num_movies_watched": self.num_movies_watched,
                "watchlist_length": self.watchlist_length,
                "url": self.url}


if __name__ == '__main__':
    # Example usage
    usr = UserProfile("sverlaan")
    print(usr.to_dict())
