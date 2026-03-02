# How to run Nyetflix (step by step)

This guide assumes you’ve never set up a Node.js project before. Follow the steps for your operating system.

---

## What you’ll need

- **Node.js** (v18 or newer) – runs the app
- **Your media folder** – a folder on your computer where your movies and TV shows are stored
- **ffmpeg** (optional but recommended) – for streaming MKV and other formats; required for HLS/transcoding

---

## Step 1: Install Node.js

### Windows

1. Go to [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS** version (e.g. “22.x.x LTS”).
3. Run the installer. Accept the defaults (including “Add to PATH”).
4. **Close any open terminals**, then open a new one (PowerShell or Command Prompt).
5. Check that Node is installed:

   ```powershell
   node -v
   ```

   You should see something like `v22.x.x`. If you get “command not found”, Node wasn’t added to PATH; run the installer again and make sure “Add to PATH” is checked.

### Mac

1. Go to [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS** version.
3. Run the `.pkg` installer and follow the steps.
4. Open **Terminal** (Applications → Utilities → Terminal, or search “Terminal”).
5. Check:

   ```bash
   node -v
   ```

   You should see something like `v22.x.x`.

**Alternative on Mac (if you use Homebrew):**  
Run `brew install node` in Terminal, then run `node -v` to confirm.

---

## Step 2: Install ffmpeg (optional but recommended)

Nyetflix uses ffmpeg for streaming and converting video. Without it, some formats (e.g. MKV) may not play correctly in the browser.

### Windows

**Option A – winget (easiest on Windows 10/11)**

1. Open **PowerShell** or **Command Prompt**.
2. Run:

   ```powershell
   winget install ffmpeg
   ```

3. If it asks to install a package (e.g. Gyan.FFmpeg), type **Y** and press Enter.
4. **Close and reopen** your terminal.

**Option B – Manual**

1. Go to [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/).
2. Download **ffmpeg-release-essentials.zip**.
3. Unzip it to a folder, e.g. `C:\ffmpeg`.
4. Add the **bin** folder to your PATH:
   - Open **Settings** → **System** → **About** → **Advanced system settings** → **Environment Variables**.
   - Under **User variables**, select **Path** → **Edit** → **New**.
   - Add the path to the `bin` folder (e.g. `C:\ffmpeg\ffmpeg-7.x.x-essentials_build\bin`).
   - Confirm with OK, then close all terminals and open a new one.

**Check:** In a new terminal run:

```powershell
ffmpeg -version
```

If you see version info, ffmpeg is installed correctly.

### Mac

In Terminal run:

```bash
brew install ffmpeg
```

If you don’t have Homebrew, install it from [https://brew.sh](https://brew.sh), then run the command above.

**Check:** Run `ffmpeg -version` in Terminal.

---

## Step 3: Get the Nyetflix project

You need the project folder on your computer.

- **If you cloned the repo:** you already have it (e.g. `C:\Users\You\Desktop\nyetflix` or `~/Desktop/nyetflix`).
- **If you downloaded a ZIP:** extract it and remember the folder path.

Open a terminal and go into that folder:

**Windows (PowerShell):**

```powershell
cd C:\Users\YourName\Desktop\nyetflix
```

(Replace `YourName` and the path with your actual path.)

**Mac / Linux:**

```bash
cd ~/Desktop/nyetflix
```

(Or whatever path you used.)

---

## Step 4: Install dependencies

In the same terminal, inside the project folder, run:

```bash
npm install
```

This downloads all the libraries the app needs. It may take a minute. When it finishes, you should see something like “added XXX packages” and no red errors.

---

## Step 5: Environment variables (optional)

The app works without any config. If you want **posters and better metadata** (movie/series info, episode lists), you can add a TMDB API key:

1. Get a free API key from [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (create an account if needed).
2. In the project folder, copy the example env file:
   - **Windows (PowerShell):** `Copy-Item .env.example .env.local`
   - **Mac / Linux:** `cp .env.example .env.local`
3. Open `.env.local` in a text editor and set:

   ```
   TMDB_API_KEY=your_actual_key_here
   ```

4. Save the file. You can do this step later and just restart the app when you’re ready.

---

## Step 6: Run the app

In the project folder, run:

```bash
npm run dev
```

You should see something like:

```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

Leave this terminal open. **Do not close it** while you’re using Nyetflix.

---

## Step 7: Open Nyetflix in your browser

1. Open your browser (Chrome, Firefox, Edge, Safari, etc.).
2. Go to: **http://localhost:3000**
3. You should see the Nyetflix home page.

---

## Step 8: Set your media library folder

1. In Nyetflix, click your **profile** (top right) and open **App Settings**.
2. Under **Media library folder**, enter the **full path** to the folder where your movies and TV shows are stored.

   Examples:
   - **Windows:** `C:\Users\YourName\Videos\Movies`
   - **Mac:** `/Users/yourname/Movies` or `~/Movies`
   - **External drive (Mac):** `/Volumes/MyDrive/Movies`

3. Settings save automatically. Close the modal.
4. Go to **Home** (or **Films** / **Series**). The app will scan your folder. If nothing appears, double-check the path and use the **refresh** button on Home to rescan.

---

## Stopping the app

In the terminal where `npm run dev` is running, press **Ctrl+C**. The server will stop. Run `npm run dev` again when you want to start it.

---

## Production run (optional)

For a production-style run (faster, no hot-reload):

```bash
npm run build
npm start
```

Then open **http://localhost:3000** as before. Use the same library path and, if you set it, the same `.env.local` with `TMDB_API_KEY`.

---

## Resetting the database (optional)

If you want to clear all app data (profiles, settings, library cache):

```bash
npm run clear-db
```

Then start the app again with `npm run dev` or `npm start`.

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| `node` or `npm` not found | Reinstall Node.js and make sure “Add to PATH” is selected. Close and reopen the terminal. |
| `npm install` fails | Make sure you’re in the project folder (`cd` into the nyetflix folder). Check your internet connection. |
| Port 3000 already in use | Another app is using port 3000. Stop that app or run `npm run dev -- -p 3001` and open http://localhost:3001. |
| No posters / no episode info | Add a TMDB API key in `.env.local` and restart the app, then rescan the library. |
| MKV no sound (Windows) | Install ffmpeg (Step 2). For existing files, you can convert once: `ffmpeg -i "file.mkv" -c:v copy -c:a aac -b:a 192k "file.mp4"`. |
| Library path not working | Use the full path (e.g. `C:\Users\...` on Windows, `/Users/...` on Mac). For external drives, make sure the drive is mounted. |

For more details on organizing files, TMDB, and ffmpeg, see the main [README.md](README.md).

**Prefer Docker?** You can run Nyetflix in a container (Node and ffmpeg included). See the [Run with Docker](README.md#run-with-docker) section in the README.
