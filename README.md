<img width="1024" height="247" alt="Nyetflix" src="https://github.com/user-attachments/assets/0d1914b6-182c-4b40-ae02-c5318e5bbe1f" />

**Nyetflix** is a local Netflix-style app for browsing and streaming movies and series you already have on disk. No cloud accounts. Your files stay on your machine and play in the browser.

Want to see what it looks like first? The project site is at **[sotiriskar.github.io/nyetflix](https://sotiriskar.github.io/nyetflix/)**.

## Quick start

**You need:**
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- ffmpeg (recommended for MKV and multi-audio)
- A folder of movies/series

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Leave the terminal open while you use the app.

1. Click your **profile** (top right) → **App Settings**
2. Set **Media library folder** to the full path of your library (e.g. `C:\Users\You\Videos\Movies` or `/Users/you/Movies`)
3. Go to **Home** (or Films / Series). The app scans that folder. Use refresh if nothing appears.

### ffmpeg

Needed for reliable MKV playback and multi-audio packaging.

- **Windows:** `winget install ffmpeg` (or grab a build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add `bin` to PATH)
- **Mac:** `brew install ffmpeg`

Check with `ffmpeg -version`.

### TMDB (strongly recommended)

A free [TMDB API key](https://www.themoviedb.org/settings/api) unlocks posters, backdrops, cast, trailers, and episode metadata. Without it the app still works, but titles look plain.

```bash
cp .env.example .env.local
```

Set `TMDB_API_KEY=your_key` in `.env.local`, then restart (`Ctrl+C`, `npm run dev`).

## Library layout

Organize by folders: one folder per movie, one folder per series. Put the video and matching subtitle files in the same folder.

- **Movies:** one video per folder (MP4, MKV, AVI, WebM, MOV, M4V)
- **Series:** use `Season 1` / `Season 2`, or keep episodes flat in the show folder. Names must include `S01E01` or `1x01` (not `Episode 1.mkv`)
- **Subtitles:** same base name as the video, `.srt` or `.vtt`

```
Movies/
  Inception/
    Inception (2010).mp4
    Inception (2010).en.srt
  You/
    Season 1/
      You S01E01.mkv
      You S01E01.srt
      You S01E02.mkv
```

## Docker

```bash
docker compose up -d
```

Open http://localhost:3000. Mount your media with `-v /path/to/Movies:/media:ro` and set the library path to `/media` in App Settings. Pass TMDB with `-e TMDB_API_KEY=your_key`.

## Other commands

| | |
|---|---|
| Production | `npm run prod` (build + start), or `npm run build` then `npm start` |
| Clear app data | `npm run clear-db` |
| Different port | `npm run dev -- -p 3001` |

## Contributing

PRs are welcome. Keep each change focused.

1. Fork the repo and branch from `main`
2. Run `npm install` and `npm run dev`
3. Open a pull request with a short note on **what** changed and **why**

Good fits: playback / MKV, library scanning, profiles, UI polish, docs. Follow existing patterns (Next.js App Router, Tailwind, Vidstack). Do not commit `.env.local`, `data/`, or converted media files.

## Troubleshooting

- **`node` / `npm` not found:** reinstall Node with “Add to PATH”, open a new terminal
- **Empty library:** use a full absolute path; mount external drives first
- **No posters / trailers:** add a TMDB key to `.env.local`, restart, rescan
- **MKV no audio on Windows:** install ffmpeg; the app can convert and package multi-audio titles when needed

---

Built with Next.js, Tailwind, MUI, Vidstack, and TMDB.
