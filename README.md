
<img width="1024" height="247" alt="NyETFLIX-02-03-2026" src="https://github.com/user-attachments/assets/0d1914b6-182c-4b40-ae02-c5318e5bbe1f" />

---

## Table of contents
- [Description](#description)
- [What you need](#what-you-need)
- [Install Node.js](#install-nodejs)
- [Install ffmpeg (recommended)](#install-ffmpeg-recommended)
- [Run the app](#run-the-app)
- [Set your library](#set-your-library)
- [Optional: TMDB (posters & metadata)](#optional-tmdb-posters--metadata)
- [File organization](#file-organization)
- [Docker](#docker)
- [Production & other](#production--other)
- [Troubleshooting](#troubleshooting)

---

## Description

Local Netflix-style app to browse and stream your own movies and TV series. No accounts, no cloud—your files, your browser.

## What you need

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **ffmpeg** (recommended for MKV/streaming)
- A **folder** with your movies/series

---

## Install Node.js

- **Windows:** Download LTS from [nodejs.org](https://nodejs.org), run installer, leave “Add to PATH” checked. Close and reopen terminal. Check: `node -v`.
- **Mac:** Download LTS from nodejs.org or run `brew install node`. Check: `node -v`.

---

## Install ffmpeg (recommended)

- **Windows:** `winget install ffmpeg` (or [gyan.dev builds](https://www.gyan.dev/ffmpeg/builds/) → unzip → add `bin` to PATH). Check: `ffmpeg -version`.
- **Mac:** `brew install ffmpeg`. Check: `ffmpeg -version`.

---

## Run the app

```bash
cd nyetflix
npm install
npm run dev
```

Open **http://localhost:3000**. Leave the terminal open.

---

## Set your library

1. In the app: **profile** (top right) → **App Settings**.
2. **Media library folder:** full path to your movies/series (e.g. Windows: `C:\Users\You\Videos\Movies`, Mac: `~/Movies` or `/Users/you/Movies`).
3. Go to **Home** (or Films/Series); the app scans. Use the refresh button if nothing shows.

---

## Optional: TMDB (posters & metadata)

Free [TMDB API key](https://www.themoviedb.org/settings/api) gives posters, backdrops, and episode info. Copy `.env.example` to `.env.local`, set `TMDB_API_KEY=your_key`, restart the app (`Ctrl+C` then `npm run dev`).

---

## File organization

Everything lives in **folders**. One folder per movie, one folder per series. Put the video and same-name subtitles inside that folder.

- **Movies:** One folder per movie; one video (and optional same-name `.srt`/`.vtt`) inside. Formats: MP4, MKV, AVI, WebM, MOV, M4V. MP4/WebM play everywhere; MKV on Windows often needs conversion for sound: `ffmpeg -i "file.mkv" -c:v copy -c:a aac -b:a 192k "file.mp4"`.
- **Series:** One folder per show; inside use `Season 1`, `Season 2` or flat. Episode names must include **S01E01** or **1x01**. Wrong: `Episode 1.mkv`.
- **Subtitles:** Same base name as the video, `.srt` or `.vtt`, in the **same folder** as the video.

**Movies example** (library folder contains movie folders; each folder has the video + optional subs):

```
Movies/
  Inception/
    Inception (2010).mp4
    Inception (2010).en.srt
    Inception (2010).el.srt
  The Matrix/
    The Matrix.mkv
    The Matrix.srt
    The Matrix.el.srt
```

**Series example** (library folder contains show folders; seasons inside; video + same-name subs per file):

```
You/
  Season 1/
    You S01E01.mkv
    You S01E01.srt
    You S01E02.mkv
    You S01E02.en.srt
    You S01E03.mkv
    You S01E03.el.srt
  Season 2/
    You S02E01.mkv
    You S02E01.srt
```

Or flat (all episodes in the show folder):

```
Breaking Bad/
  Breaking Bad S01E01.mkv
  Breaking Bad S01E01.srt
  Breaking Bad S01E02.mkv
  Breaking Bad S01E02.en.srt
  Breaking Bad S01E03.mkv
  Breaking Bad S01E03.el.srt
```

---

## Docker

```bash
docker build -t nyetflix .
docker run -p 3000:3000 -v nyetflix-data:/app/data nyetflix
```

Or: `docker compose up -d`. Open http://localhost:3000. To use your media folder: add `-v /path/to/Movies:/media:ro` and set **Media library folder** to `/media` in the app. TMDB: `-e TMDB_API_KEY=your_key` or `env_file: .env.local` in compose.

---

## Production & other

- **Production:** `npm run build` then `npm start`. Same library path and `.env.local` if you use TMDB.
- **Clear app data:** `npm run clear-db` then start again.
- **Port in use:** `npm run dev -- -p 3001` and open http://localhost:3001.

---

## Troubleshooting

- **`node` / `npm` not found** – Reinstall Node, ensure “Add to PATH”, new terminal.
- **`npm install` fails** – Run it from inside the project folder; check internet.
- **No posters / episode info** – Add TMDB key in `.env.local`, restart, rescan.
- **Library path wrong** – Use full path; for external drives, mount first.
- **MKV no sound (Windows)** – Install ffmpeg; convert to MP4 with the command in [File organization](#file-organization).

---

**Tech:** Next.js, Tailwind, MUI, Vidstack, TMDB API (optional).
