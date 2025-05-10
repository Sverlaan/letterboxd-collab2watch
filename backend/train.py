# Data manipulation
import warnings
from matrix_factorization import BaselineModel, KernelMF, train_update_test_split
from sklearn.metrics import root_mean_squared_error
from timeit import default_timer as timer
from sklearn.metrics.pairwise import cosine_similarity
import sklearn
from sklearn.model_selection import train_test_split
import sqlite3
from letterboxdpy import movie
from letterboxdpy import user
import sys
import random
import os
import pickle
import numpy as np
import pandas as pd
pd.options.display.max_rows = 100

# Ignore warnings
warnings.filterwarnings("ignore")


def get_data(data_path):
    """
    Load data from the given path
    """
    df = pd.read_parquet(data_path, engine='pyarrow')

    # Get the number of unique users and movies
    n_users = df["userId"].nunique()
    n_movies = df["movieId"].nunique()
    n_ratings = len(df)
    print(f"Number of users: {n_users}, Number of movies: {n_movies}, Number of ratings: {n_ratings}")

    # # Sample random rows for faster training
    # n_samples = 10000000
    # if n_samples < len(df):
    #     print(f"Sampling {n_samples} random rows out of {len(df)}")
    #     idx = np.random.choice(df.index, size=n_samples, replace=False)
    #     df = df.loc[idx]

    # user_counts = df["userId"].value_counts()
    # df = df[df["userId"].isin(user_counts[user_counts > 1].index)]

    cols = ["user_id", "item_id", "rating"]
    df.columns = cols

    # Split data in train, test
    train, test = train_test_split(df, test_size=0.2)
    X_train, y_train = train[["user_id", "item_id"]], train["rating"]
    X_test, y_test = test[["user_id", "item_id"]], test["rating"]

    return X_train, X_test, y_train, y_test


def train_model(X, y, n_epochs=30, n_factors=100, lr=0.01, reg=0.005):
    """
    Train the model
    """
    matrix_fact = KernelMF(n_epochs=n_epochs, n_factors=n_factors, verbose=1, lr=lr, reg=reg)
    matrix_fact.fit(X, y)
    return matrix_fact


if __name__ == "__main__":

    data_path = "data/ratings_filtered.parquet"

    # Load data
    X_train, X_test, y_train, y_test = get_data(data_path)
    print(X_train.head())

    # Train model
    time_start = timer()
    print("Training model...")
    model = train_model(X_train, y_train)
    print(f"Training took {timer() - time_start:.2f} seconds")

    # Evaluate model
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    rmse = root_mean_squared_error(y_test, y_pred)
    print(f"RMSE: {rmse}")

    # Save model
    print("Store model")
    with open("model/kernelmf.pkl", "wb") as f:
        pickle.dump(model, f)
