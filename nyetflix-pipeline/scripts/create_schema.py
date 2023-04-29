from psycopg2.errors import DuplicateTable, DuplicateColumn
import sys
import os

# add the parent directory of the connection package to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from connection.connect import connect_db


def create_schema():
    '''
    Create schema for movies
    '''
    # Create schema
    columns = {
        "id": "serial PRIMARY KEY",
        "imdb_id": "varchar(60) UNIQUE NOT NULL",
        "name": "varchar(255) NOT NULL",
        "description": "text NOT NULL",
        "genre": "varchar(255) NOT NULL",
        "rating": "varchar(10) NOT NULL",
        "duration": "varchar(10) NOT NULL",
        "release_date": "date NOT NULL",
        "status": "varchar(20) NOT NULL",
        "score": "float NOT NULL",
        "vote_count": "integer NOT NULL",
        "popularity": "float NOT NULL",
        "budget": "string NOT NULL",
        "revenue": "string NOT NULL",
        "language": "varchar(10) NOT NULL",
        "logo": "varchar(255) NOT NULL",
        "poster": "varchar(255) NOT NULL",
        "banner": "varchar(255) NOT NULL",
        "trailer": "varchar(255) NOT NULL",
    }

    # create schema and table, if not exists
    with connect_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("CREATE SCHEMA IF NOT EXISTS nyetflix")
                cur.execute("CREATE TABLE IF NOT EXISTS nyetflix.movies ()")
            except Exception as e:
                raise f"Error creating schema: {e}"

            # add columns to table
            for col, col_type in columns.items():
                try:
                    cur.execute(f"ALTER TABLE nyetflix.movies ADD COLUMN IF NOT EXISTS {col} {col_type}")
                except (DuplicateTable, DuplicateColumn):
                    pass  # ignore if column already exists

            conn.commit()
    print("Schema created successfully")


if __name__ == "__main__":
    create_schema()