import psycopg2
import dotenv
import time
import os


def connect_db(max_retries=3, retry_interval=5):
    '''
    Connect to database
    parameters:
        max_retries(int): maximum number of times to retry connecting to database (default: 3)
        retry_interval(int): number of seconds to wait before retrying (default: 1)
    '''

    dotenv.load_dotenv()
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")

    retry_count = 0
    while retry_count < max_retries:
        try:
            conn = psycopg2.connect(dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT)
            return conn
        except (psycopg2.Error, OSError) as e:
            retry_count += 1
            print("Error connecting to database: {}. Retrying in {} seconds...".format(str(e), retry_interval))
            time.sleep(retry_interval)
    raise ConnectionError("Failed to connect to database after {} retries".format(max_retries))
