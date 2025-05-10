# Data manipulation
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pandas as pd
from timeit import default_timer as timer
import pickle
# from user import UserProfile
# import matrix_factorization


class MovieRecommender:
    def __init__(self, model_path):
        self.model_path = model_path
        self.model = None
        self.X_update = None
        self.y_update = None
        self.movies_trained_on = None

        self.recs_dict = dict()

    def preprocess(self, usernames, user_profiles, use_blacklist=True):
        """
        Preprocess the data
        """
        timer_start = timer()

        self.model = pickle.load(open(self.model_path, "rb"))
        self.movies_trained_on = {slug for slug in self.model.item_id_map.keys()}
        self.recs_dict = dict()

        # Add ratings from our app users
        new_rows = []
        for username in usernames:
            user_profile = user_profiles[username]
            new_rows.extend([(username, movie_slug, rating) for movie_slug, rating in user_profile.get_ratings().items() if movie_slug in self.movies_trained_on])

            # Add blacklisted movies
            if use_blacklist:
                blacklisted_slugs = user_profile.get_blacklist()
                virtual_rating = 1
                print(f"Blacklisted movies for {username} rated {virtual_rating}: {blacklisted_slugs}")
                new_rows.extend([(username, movie_slug, virtual_rating) for movie_slug in blacklisted_slugs])

        new_df = pd.DataFrame(new_rows, columns=['user_id', 'item_id', 'rating'])

        self.X_update = new_df[['user_id', 'item_id']]
        self.y_update = new_df['rating']

        print("Update dataset generated in", timer() - timer_start, "seconds")

    def train_model(self, n_epochs=30, lr=0.01):
        """
        Train the model
        """
        timer_start = timer()
        # Update the model
        self.model.update_users(
            self.X_update, self.y_update, lr=lr, n_epochs=n_epochs, verbose=0
        )
        print(f"Retraining took {timer() - timer_start} seconds")

    def predict_user_rating(self, username, movie_slug):
        """
        Get the predicted user rating for a specific movie
        """
        # Check if movie is in the model
        if movie_slug not in self.model.item_id_map:
            return None

        # Create dataframe of user and movie
        df_to_pred = pd.DataFrame([[username, movie_slug]], columns=["user_id", "item_id"])

        prediction = self.model.predict(df_to_pred)
        return prediction[0]

    def get_predictions(self, username, movie_slugs, sorted=True, n_items=None):
        """
        Get the predicted user ratings for a list of movies
        """
        movie_slugs = list(movie_slugs)

        # Create dataframe of user and movie
        df_to_pred = pd.DataFrame([[username, movie_slug] for movie_slug in movie_slugs], columns=["user_id", "item_id"])
        pred_ratings = self.model.predict(df_to_pred)

        if not sorted:
            return pred_ratings

        # Combine slugs and ratings
        preds = [(movie_slugs[i], pred_ratings[i]) for i in range(len(movie_slugs))]

        # Sort by predicted rating
        preds.sort(key=lambda x: x[1], reverse=True)
        return preds

    def get_recommendations(self, usernames, user_profiles, amount=10, filter_watchlist=False):
        """
        Get recommendations based on multiple users
        """

        def repack(df):
            """
            Convert dataframe to list of slugs and dictionary of scores
            """
            slugs = df["item_id"].tolist()
            scores = {slug: score for slug, score in zip(slugs, df["rating_pred"])}
            return slugs, scores

        user_recs = []

        for username in usernames:
            if username not in self.recs_dict:
                items_known = self.X_update.query("user_id == @username")["item_id"]
                recs = self.model.recommend(user=username, items_known=items_known, amount=amount)

                # Filter out watched and/or watchlist items
                recs = recs[~recs["item_id"].isin(user_profiles[username].get_watched())]
                if filter_watchlist:
                    recs = recs[~recs["item_id"].isin(user_profiles[username].get_watchlist())]

                self.recs_dict[username] = recs

            user_recs.append(self.recs_dict[username].copy())

        # If only one user, return directly
        if len(usernames) == 1:
            return repack(user_recs[0].drop(columns=["user_id"]))

        # Merge all recommendations on item_id
        from functools import reduce

        def merge_recs(df1, df2):
            return df1.merge(df2, on="item_id", how="inner", suffixes=("", "_dup"))

        merged = reduce(merge_recs, user_recs)

        # Collect all rating_pred columns
        rating_cols = [col for col in merged.columns if col.startswith("rating_pred")]

        # If there are suffixes like _dup, fix column names for averaging
        rating_values = merged[rating_cols].values
        merged["rating_pred"] = rating_values.mean(axis=1)

        # Keep only item_id and average rating
        merged = merged[["item_id", "rating_pred"]]

        # Sort and return
        merged = merged.sort_values(by="rating_pred", ascending=False).reset_index(drop=True)
        return repack(merged)

    def get_recommendationsOLD(self, usernames, user_profiles, weight=-1, amount=10, filter_watchlist=False):
        """
        Get recommendations based on two users
        """

        def repack(df):
            """
            Convert dataframe to list of slugs and dictionary of scores
            """
            slugs = df["item_id"].tolist()
            scores = {slug: score for slug, score in zip(slugs, df["rating_pred"])}
            return slugs, scores

        for username in usernames:
            if username not in self.recs_dict:
                items_known = self.X_update.query("user_id == @username")["item_id"]
                recs = self.model.recommend(user=username, items_known=items_known, amount=amount)

                # Remove rows where item_id is in the user's watched (to filter watched but not rated movies)
                recs = recs[~recs["item_id"].isin(user_profiles[username].get_watched())]

                # Remove rows where item_id is in the user's watchlist
                if filter_watchlist:
                    recs = recs[~recs["item_id"].isin(user_profiles[username].get_watchlist())]

                self.recs_dict[username] = recs

        if weight == -1:
            return repack(self.recs_dict[usernames[0]].drop(columns=["user_id"]))
        elif weight == 1:
            return repack(self.recs_dict[usernames[1]].drop(columns=["user_id"]))
        else:
            recs1 = self.recs_dict[usernames[0]]
            recs2 = self.recs_dict[usernames[1]]
            # Merge on item_id
            merged = recs1.merge(recs2, on="item_id", suffixes=("_1", "_2"))
            # Compute average rating
            merged["rating_pred"] = (merged["rating_pred_1"] + merged["rating_pred_2"]) / 2
            # Select required columns
            recs12 = merged[["item_id", "rating_pred"]]
            # Sort by rating_pred in descending order
            recs12 = recs12.sort_values(by="rating_pred", ascending=False).reset_index(drop=True)
            return repack(recs12)

    def get_similar_movies(self, movie_slug, top_n=5):
        """
        Get similar movies to a given movie
        """
        try:
            embs = self.model.item_features
            items = list(self.model.item_id_map.keys())
            movie_index = self.model.item_id_map.get(movie_slug)

            # Compute cosine similarity
            movie_emb = embs[movie_index].reshape(1, -1)
            similarities = cosine_similarity(movie_emb, embs)[0]

            # Sort and get top N
            similar_indices = np.argsort(similarities)[::-1]
            similar_indices = [i for i in similar_indices if i != movie_index]
            similar_indices = similar_indices[:top_n]
            similar_slugs = [items[i] for i in similar_indices]

            return True, similar_slugs
        except:
            return False, None

    def get_influential_movies(self, username, userprofile, movie_slug, top_k=5):
        """
        Explain the prediction of a movie
        """

        # Check if movie is in the model
        if movie_slug not in self.model.item_id_map:
            return False, None

        # Get highly rated movies of user
        user_ratings = userprofile[username].get_ratings()
        rated_slugs = list(user_ratings.keys())
        user_ratings = list(user_ratings.values())

        # Get embeddings of the higly rated movies
        embs = self.model.item_features
        items = list(self.model.item_id_map.keys())
        movie_index = self.model.item_id_map.get(movie_slug)
        highly_rated_indices = [self.model.item_id_map.get(slug) for slug in rated_slugs if slug in self.model.item_id_map]
        user_ratings = [user_ratings[i] for i, slug in enumerate(rated_slugs) if slug in self.model.item_id_map]

        # Compute cosine similarity between movie and highly rated movies
        movie_emb = embs[movie_index].reshape(1, -1)
        highly_rated_embs = embs[highly_rated_indices]
        similarities = cosine_similarity(movie_emb, highly_rated_embs)[0]

        # Normalize user ratings
        # def normalize_ratings(ratings, min_rating=1, max_rating=5):
        #     return (ratings - min_rating) / (max_rating - min_rating)

        def log_normalization(ratings):
            return np.log1p(ratings)  # log(x + 1)

        user_ratings = log_normalization(np.array(user_ratings))

        similarities = similarities * user_ratings

        # Sort and get top N
        similar_indices = np.argsort(similarities)[::-1]
        similar_indices = similar_indices[:top_k]
        influential_movies = [items[highly_rated_indices[i]] for i in similar_indices]
        similarity_scores = [round(similarities[i], 3) for i in similar_indices]

        return True, influential_movies


def get_common_watchlist(usernames, user_profiles, recommender):
    """
    Get common watchlist between a list of users, sorted by average predicted rating.
    """

    if not usernames:
        return []

    # Start with the watchlist of the first user
    common_slugs = user_profiles[usernames[0]].get_watchlist()

    # Intersect with the rest of the users' watchlists
    for username in usernames[1:]:
        common_slugs = common_slugs.intersection(user_profiles[username].get_watchlist())

    # Filter only movies that are in the recommender model
    # common_slugs = [slug for slug in common_slugs if slug in recommender.movies_trained_on]

    if not common_slugs:
        return []

    # Accumulate predictions per slug
    rating_sums = {slug: 0.0 for slug in common_slugs}
    rating_counts = {slug: 0 for slug in common_slugs}

    for username in usernames:
        preds = recommender.get_predictions(username, common_slugs, sorted=False)
        for i, slug in enumerate(common_slugs):
            rating_sums[slug] += preds[i]
            rating_counts[slug] += 1

    # Calculate average ratings
    avg_preds = [(slug, rating_sums[slug] / rating_counts[slug]) for slug in common_slugs]

    # Sort by average rating
    avg_preds.sort(key=lambda x: x[1], reverse=True)

    # Return sorted list of slugs
    return [slug for slug, _ in avg_preds]


def get_common_watchlistOlD(username1, username2, user_profiles, recommender):
    """
    Get common watchlist between two users
    """
    user1_watchlist = user_profiles[username1].get_watchlist()
    user2_watchlist = user_profiles[username2].get_watchlist()

    # Get intersection
    common_slugs = list(user1_watchlist.intersection(user2_watchlist))

    # Get predicted ratings for common movies
    preds_user1 = recommender.get_predictions(username1, common_slugs, sorted=False)
    preds_user2 = recommender.get_predictions(username2, common_slugs, sorted=False)

    preds_avg = [(slug, (preds_user1[i] + preds_user2[i]) / 2.0) for i, slug in enumerate(common_slugs)]

    # Sort by predicted rating
    preds_avg.sort(key=lambda x: x[1], reverse=True)

    # # Add movies that are not in the model to the end of the list
    # preds_avg.extend([(slug, None) for slug in common_slugs_not_in_model])

    # Return sorted list of common movies
    return [slug for slug, _ in preds_avg]


def get_single_watchlist(username, all_usernames, user_profiles, recommender):
    """
    Get watchlist of `username` that none of the users in `all_usernames` have seen yet,
    ordered by the average predicted rating from users in `all_usernames`.
    """

    user1_watchlist_slugs = user_profiles[username].get_watchlist()

    # Initialize with all slugs in user1's watchlist
    diff_slugs = set(user1_watchlist_slugs)

    # Exclude slugs that any user in all_usernames has seen or has in their watchlist
    for other_user in all_usernames:
        seen = user_profiles[other_user].get_watched()
        diff_slugs -= seen

    # Only keep movies that the recommender model has data for
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.movies_trained_on]

    # Initialize a dictionary to accumulate ratings
    rating_sums = {slug: 0.0 for slug in diff_slugs}
    rating_counts = {slug: 0 for slug in diff_slugs}

    # Gather predictions from all users
    for other_user in all_usernames:
        preds = recommender.get_predictions(other_user, diff_slugs, sorted=False)
        for i, slug in enumerate(diff_slugs):
            rating_sums[slug] += preds[i]
            rating_counts[slug] += 1

    # Compute average predictions
    avg_preds = [(slug, rating_sums[slug] / rating_counts[slug]) for slug in diff_slugs]

    # Sort by average predicted rating in descending order
    avg_preds.sort(key=lambda x: x[1], reverse=True)

    # Return list of slugs sorted by average rating
    return [slug for slug, _ in avg_preds]


def get_single_watchlistOLD(username, all_usernames, user_profiles, recommender):
    """
    Get watchlist of user1 that user2 has not seen yet, ordered by predicted rating of user2
    """
    # TODO: change to use all usernames
    username2 = all_usernames[1]

    user2_seen_slugs = user_profiles[username2].get_watched()
    user1_watchlist_slugs = user_profiles[username].get_watchlist()
    user2_watchlist_slugs = user_profiles[username2].get_watchlist()

    # Get all movies of user2 that user1 has not seen yet
    diff_slugs = user1_watchlist_slugs.difference(user2_seen_slugs)
    diff_slugs = diff_slugs.difference(user2_watchlist_slugs)

    # Only get the slugs that are in the model
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.movies_trained_on]

    # Get predicted ratings for common movies
    preds_user2 = recommender.get_predictions(username2, diff_slugs, sorted=False)

    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)
    preds = preds

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


def get_rewatchlist(username1, other_usernames, user_profiles, recommender):
    """
    Get rewatchlist of user1 that other users have not seen yet,
    ordered by average predicted rating from those other users.
    """

    # Movies rated by user1 with rating >= 4
    user1_seen_slugs = user_profiles[username1].get_ratings()
    user1_seen_slugs = {slug for slug, rating in user1_seen_slugs.items() if rating >= 4}

    # Movies seen by all other users
    all_other_seen = set()
    for username in other_usernames:
        all_other_seen.update(user_profiles[username].get_watched())

    # Movies that user1 has seen but none of the others have
    diff_slugs = list(user1_seen_slugs.difference(all_other_seen))

    # Filter out slugs not in model
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.movies_trained_on]

    if not diff_slugs:
        return []

    # Collect predictions from all other users
    prediction_sums = {slug: 0.0 for slug in diff_slugs}
    for username in other_usernames:
        preds = recommender.get_predictions(username, diff_slugs, sorted=False)
        for i, slug in enumerate(diff_slugs):
            prediction_sums[slug] += preds[i]

    # Compute average prediction
    num_users = len(other_usernames)
    avg_preds = [(slug, prediction_sums[slug] / num_users) for slug in diff_slugs]

    # Sort by predicted rating descending
    avg_preds.sort(key=lambda x: x[1], reverse=True)

    return [slug for slug, _ in avg_preds]


# if __name__ == '__main__':

#     username = "flrz"

#     user_profiles = {
#         username: UserProfile(username)
#     }

#     recommender = MovieRecommender(model_path="model/kernel_mf.pkl")
#     recommender.preprocess([username], user_profiles)
#     recommender.train_model(n_epochs=30, lr=0.001)

#     print(recommender.explain([username], user_profiles, "witness-for-the-prosecution-1957", 0))

    # print(get_similar_movies("kikis-delivery-service", recommender))

    # Get recommendations
    # user_test = 'liannehr'
    # items_known = recommender.X_update.query("user_id == @user_test")["item_id"]
    # recs = recommender.model.recommend(user=user_test, items_known=items_known, amount=10)
    # print(recs)

    # res = recommender.get_recommendations("liannehr", "sverlaan", 0, user_profiles, recommender)
    # print(res)

    # Get predictions
    # print(recommender.get_prediction("liannehr", ["twin-peaks-the-return", "portrait-of-a-lady-on-fire"]))
    # print(recommender.get_prediction("liannehr", "portrait-of-a-lady-on-fire"))
