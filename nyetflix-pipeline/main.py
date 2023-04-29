from connection.connect import connect_db
from pytube import YouTube
from typing import List
from tqdm import tqdm
import subprocess
import requests
import dotenv
import time
import os


def get_movies(url, api_key):
    request = requests.get(url)
    results = request.json()["results"]

    # get a dictionary of genre IDs to names
    url = f"https://api.themoviedb.org/3/genre/movie/list?api_key={api_key}&language=en-US"
    request = requests.get(url)
    genres = {genre["id"]: genre["name"] for genre in request.json()["genres"]}

    data = []
    for item in results:
        url = f"https://api.themoviedb.org/3/movie/{item['id']}?api_key={api_key}&language=en-US&append_to_response=videos"
        response = requests.get(url)
        details = response.json()

        # get images to get logo
        url = f"https://api.themoviedb.org/3/movie/{item['id']}/images?api_key={api_key}"
        response = requests.get(url)

        images = response.json()
        logo_id = images["logos"][0]["file_path"] if images["logos"] else ""
        logo = f"https://www.themoviedb.org/t/p/original{logo_id}" if logo_id else ""
        backdrop = next((image for image in images["backdrops"] if image["iso_639_1"] == "en"), None)
        banner = f"https://www.themoviedb.org/t/p/original{details['backdrop_path']}" if details['backdrop_path'] else ""

        # get the poster
        if backdrop:
            poster_endpoint = backdrop['file_path']
            poster = f"https://www.themoviedb.org/t/p/original{poster_endpoint}"
        else:
            poster = f"https://www.themoviedb.org/t/p/original{details['backdrop_path']}" if details['backdrop_path'] else ""

        # get age ratings
        url = f"https://api.themoviedb.org/3/movie/{item['id']}/release_dates?api_key={api_key}"
        ratings = requests.get(url)

        rating = ""
        for country in ratings.json()["results"]:
            if country["iso_3166_1"] == "US":
                rating = country["release_dates"][0]["certification"]
                break

        # Convert ratings to age ratings
        if rating == "G":
            rating = "0+"
        elif rating == "PG":
            rating = "7+"
        elif rating == "PG-13":
            rating = "13+"
        elif rating == "R":
            rating = "18+"
        elif rating == "NC-17":
            rating = "18+"
        else:
            rating = "18+"

        # extract genre ids
        genre_ids = [genre["id"] for genre in details["genres"]]
        genre = ", ".join([genres.get(genre_id, "") for genre_id in genre_ids])

        # extract trailer url
        trailer_id = next((video for video in details["videos"]["results"] if video["type"] == "Trailer"), None)
        trailer = f"https://www.youtube.com/watch?v={trailer_id['key']}" if trailer_id else ""

        raw_data = {
            "id": details["id"],
            "imdb_id": details["imdb_id"],

            "name": details["title"],
            "description": details["overview"],
            "genre": genre,
            "rating": rating,

            "duration": f"{details['runtime']}m",
            'release_date': details['release_date'],
            'status': details['status'],

            'score': details['vote_average'],
            'vote_count': details['vote_count'],
            'popularity': details['popularity'],

            'budget': f"${details['budget']:,}",
            'revenue': f"${details['revenue']:,}",
            'language': details['original_language'],

            "logo": logo,
            "poster": poster,
            "banner": banner,
            "trailer": trailer,
        }

        # if empty values, skip
        if any(not value for value in raw_data.values()):
            continue
        else:
            data.append(raw_data)

    return data

def download_trailer(data: List[dict]):
    '''
    Download trailers from YouTube
    Parameters:
        data (List[dict]): List of dictionaries containing data to be inserted
    '''

    faulty_items = []
    for item in tqdm(data):
        if item["trailer"]:
            os.makedirs("data/movies/trailers", exist_ok=True)
            os.makedirs("data/movies/temp", exist_ok=True)
            try:
                # if trailer already exists, skip
                if os.path.exists(f"data/movies/trailers/{item['imdb_id']}.mp4"):
                    continue

                # get YouTube url
                yt = YouTube(item["trailer"])
                video_stream = yt.streams.filter(progressive=True, file_extension='mp4').get_highest_resolution()

                # download video
                video_filename = video_stream.download(output_path="data/movies/temp", filename=item["imdb_id"])

                # compress the video & scale to 1080p
                if video_stream.resolution == '2160p' or video_stream.resolution == '1440p':
                    output_filename = os.path.splitext(video_filename)[0] + '_compressed.mp4'
                    subprocess.run(['ffmpeg', '-i', video_filename, '-vf', 'scale=1920:1080', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'copy', '-hide_banner', '-loglevel', 'error', output_filename])
                    os.remove(video_filename)
                else:
                    output_filename = os.path.splitext(video_filename)[0] + '_compressed.mp4'
                    subprocess.run(['ffmpeg', '-i', video_filename, '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'copy', '-hide_banner', '-loglevel', 'error', output_filename])
                    os.remove(video_filename)

                # move the compressed video
                os.rename(output_filename, f"data/movies/trailers/{item['imdb_id']}.mp4")
                for file in os.listdir("data/movies/temp"):
                    os.remove(os.path.join("data/movies/temp", file))
            except Exception as e:
                faulty_items.append((item["name"], item["trailer"], e))

                # connect to database & remove the faulty item
                with connect_db() as conn, conn.cursor() as cur:
                    table_name, schema_name = "movies", "nyetflix"
                    cur.execute(f"DELETE FROM {schema_name}.{table_name} WHERE imdb_id = '{item['imdb_id']}';")
                    conn.commit()
                continue
    if len(faulty_items) > 0:
        print("Faild to download the following trailers:")
        for item in faulty_items:
            print(f"- Name: {item[0]} | URL: {item[1]} | Error: {item[2]}")
            
    # delete temp folder
    os.rmdir("data/movies/temp")

def insert_data(data: List[dict]):
    '''
    Insert data into database
    Parameters:
        data (List[dict]): List of dictionaries containing data to be inserted
    '''
    try:
        updated = 0
        with connect_db() as conn, conn.cursor() as cur:
            table_name, schema_name = "movies", "nyetflix"
            column_names = ["id", "imdb_id", "name", "description", "genre", "rating", "duration", "release_date",
                            "status", "score", "vote_count", "popularity", "budget", "revenue", "language",
                            "logo", "poster", "banner", "trailer"]

            columns = ",".join(column_names)
            values = ",".join("%({})s".format(col) for col in column_names)
            for item in data:
                cur.execute(f"SELECT imdb_id FROM {schema_name}.{table_name} WHERE imdb_id = '{item['imdb_id']}'")
                if cur.fetchone():
                    updated += 1
                    cur.execute(f"UPDATE {schema_name}.{table_name} SET "
                                + ", ".join([f"{col}=%({col})s" for col in column_names])
                                + f" WHERE imdb_id=%(imdb_id)s", item)
                    continue

                # insert item into database
                cur.execute(f"INSERT INTO {schema_name}.{table_name} ({columns}) VALUES ({values})", item)
            conn.commit()

    except Exception as e:
        raise f"Error occurred while inserting data into database: {e}"
    print(f"Inserted: {len(data) - updated} | Updated: {updated} | Total: {len(data)}")

def main():
    dotenv.load_dotenv()
    page_numbers = range(1, 6)
    api_key = os.environ.get("API_KEY")

    urls = [
        f"https://api.themoviedb.org/3/movie/popular?api_key={api_key}&language=en-US&region=us",
        f"https://api.themoviedb.org/3/trending/movie/week?api_key={api_key}&language=en-US&region=us",
        f"https://api.themoviedb.org/3/movie/top_rated?api_key={api_key}&language=en-US&region=us",
        f"https://api.themoviedb.org/3/movie/now_playing?api_key={api_key}&language=en-US&region=us",
    ]

    # append the rest of the urls
    total_urls = []
    for url in urls:
        for page_number in page_numbers:
            total_urls.append(f"{url}&page={page_number}")

    for i, url in enumerate(total_urls):
        start = time.time()

        print("-" * 50)
        print(f"Getting data from {i+1}/{len(total_urls)} url pages")

        # Get data from API
        print("Getting data from movie api")
        data = get_movies(url, api_key)

        # Put data into db
        print("Inserting data into database")
        insert_data(data)

        # Download trailers
        print("Downloading trailers")
        download_trailer(data)

        print(f"Success(took {round((time.time() - start) / 60, 2)} minutes)")
    print("-" * 50)


if __name__ == "__main__":
    main()
