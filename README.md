# Nyetflix

A simple, local Netflix-style app to browse and stream your own movies and TV series. No accounts, no cloud—just your files and your browser.

---

## What you need

- **Node.js** (v18 or newer). [Download](https://nodejs.org/) if you don’t have it.
- **Your media folder** with movies and/or TV shows on your computer (or a mounted drive).

---

## Quick start

### 1. Install and run

```bash
cd nyetflix
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 2. Set your library folder

1. Click your **profile** (top right) and open **App Settings**.
2. Under **Media library folder**, enter the full path to the folder where your movies and series live.

Examples:

- Mac: `/Users/YourName/Movies` or `~/Movies`
- Windows: `C:\Users\YourName\Videos\Movies`
- External drive: `/Volumes/MyDrive/Movies`

3. Settings are saved automatically. Close the modal.

### 3. Load your library

- Go to **Home** (or **Films** / **Series**). The app will scan your folder.
- If nothing appears, check the path in Settings and try again. You can use the **refresh** button (bottom right on Home) to rescan.

---

## How to organize your files

### Movies

- Put each movie in **its own subfolder**, or place video files directly in the library folder.
- One video per movie (the app picks one per folder).
- Supported formats: **MP4, MKV, AVI, WebM, MOV, M4V**. For best browser support, prefer **MP4** or **WebM**.

**Examples:**

```
Movies/
  Inception/
    Inception (2010).mp4
  The Matrix/
    The Matrix.mkv
```

### TV series

- Put each show in **one folder** (e.g. `You`, `Breaking Bad`).
- Inside that folder, either:
  - **Season subfolders:** `Season 1`, `Season 2`, etc., with video files inside, or  
  - **Flat:** all episode files in the same folder.

**Important:** Episode files must include **season and episode** in the name so the app can match them correctly. Use one of these patterns:

- `S01E01` or `S1E1`
- `1x01`

**Good examples:**

```
You/
  Season 1/
    You S01E01.mkv
    You S01E02.mkv
  Season 2/
    You S02E01.mkv
```

or flat:

```
You/
  You S01E01.mkv
  You S01E02.mkv
  You S02E01.mkv
```

**Bad:** `Episode 1.mkv`, `You - 01.mkv` (no `SxxExx` → episodes may not match correctly).

### Subtitles

- Same **base name** as the video.
- Extensions: **.srt** or **.vtt**.
- Optional language: `Show S01E01.en.srt`, `Show S01E02.el.srt`.

**Examples:**

- `You S01E01.mkv` → `You S01E01.srt` or `You S01E01.en.srt`
- `Inception.mp4` → `Inception.srt`

---

## Optional: TMDB API key (posters & series info)

Without an API key, the app still works: it uses folder/file names and shows a basic list. With a **free TMDB API key**, you get:

- Posters and backdrop images
- Better titles and descriptions
- For **series:** full episode list with thumbnails and descriptions (even for episodes you don’t have)

### How to set it up

1. Go to [themoviedb.org](https://www.themoviedb.org/), create an account, then [Request an API key](https://www.themoviedb.org/settings/api).
2. Copy the **API Key (v3 auth)**.
3. In the project folder, copy the example env file and add your key:

```bash
cp .env.example .env.local
```

4. Open `.env.local` and set:

```
TMDB_API_KEY=your_key_here
```

5. Restart the dev server (`Ctrl+C`, then `npm run dev`).

---

## App settings (in the app)

- **Language** – UI language (e.g. English, Greek).
- **Subtitle preference** – Preferred subtitle language when multiple are available.
- **Media library folder** – Path to your movies/series (see above).

---

## Tips

- **Path doesn’t work?** Use the full path (e.g. `/Users/...` on Mac, `C:\...` on Windows). For external drives, make sure the drive is mounted before opening the app.
- **Series plays wrong episode?** Make sure every episode filename contains something like `S01E03` (season 1, episode 3). Rescan after changing names.
- **No posters or episode descriptions?** Add a TMDB API key (see above) and rescan.
- **“This episode is not in your library”** – The app can show all episodes from TMDB; if you don’t have that file, it will tell you when you try to play.

---

## Build for production

```bash
npm run build
npm start
```

Then open **http://localhost:3000** (or the port shown). Use the same library path and (if you want) the same `.env.local` with `TMDB_API_KEY`.

---

## Tech

- **Next.js** (React)
- **Tailwind CSS**, **MUI icons**
- **Vidstack** for video playback
- **TMDB API** (optional) for metadata and images
