<img width="1024" height="247" alt="Nyetflix" src="https://github.com/user-attachments/assets/0d1914b6-182c-4b40-ae02-c5318e5bbe1f" />

Local Netflix-style app for your own movies and series. No accounts, no cloud — your files, your browser.

**[See the showcase →](https://sotiriskar.github.io/nyetflix/)**

## Quick start

**Need:** Node.js 18+, [ffmpeg](https://ffmpeg.org) (recommended for MKV), a media folder.

```bash
npm install
npm run dev
```

Open http://localhost:3000 → profile → **App Settings** → set **Media library folder** → Home.

Optional posters/metadata: copy `.env.example` → `.env.local`, set `TMDB_API_KEY`, restart.

**ffmpeg:** Windows `winget install ffmpeg` · Mac `brew install ffmpeg`

## Library layout

One folder per movie or show. Video + same-name `.srt`/`.vtt` in that folder. Episode names need `S01E01` or `1x01`.

```
Movies/
  Inception/
    Inception (2010).mp4
    Inception (2010).en.srt
  You/
    Season 1/
      You S01E01.mkv
      You S01E01.srt
```

Formats: MP4, MKV, AVI, WebM, MOV, M4V.

## Docker

```bash
docker compose up -d
```

Mount media with `-v /path/to/Movies:/media:ro` and set library path to `/media` in the app. TMDB: `-e TMDB_API_KEY=...`

## Other

| | |
|---|---|
| Production | `npm run build` then `npm start` |
| Clear data | `npm run clear-db` |
| Port busy | `npm run dev -- -p 3001` |

## Contributing

PRs welcome. Keep changes focused.

1. Fork → branch from `main`
2. `npm install` · `npm run dev`
3. Open a PR with a short description of **why**

Useful areas: playback/MKV, library scanning, profiles, UI polish, docs. Match existing patterns (Next.js App Router, Tailwind, Vidstack). Don’t commit `.env.local`, `data/`, or converted media.

## Troubleshooting

- **No Node/npm** — reinstall Node (add to PATH), new terminal
- **Empty library** — full folder path; external drives must be mounted
- **No posters** — TMDB key in `.env.local`, restart, rescan
- **MKV no audio (Windows)** — install ffmpeg; app can convert/package multi-audio titles

---

Next.js · Tailwind · MUI · Vidstack · optional TMDB
