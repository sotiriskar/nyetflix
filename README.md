<img width="1024" height="247" alt="Nyetflix" src="https://github.com/user-attachments/assets/0d1914b6-182c-4b40-ae02-c5318e5bbe1f" />

**Nyetflix** is a local Netflix-style app for browsing and streaming movies and series you already have on disk, on a NAS, or in your own S3 / MinIO / Google Cloud Storage bucket. No accounts. Your files stay yours and play in the browser.

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
2. Open your profile's Preferences → **Media library**, choose **Folder on this computer** and enter the full path of your library (e.g. `C:\Users\You\Videos\Movies` or `/Users/you/Movies`)
3. Go to **Home** (or Films / Series). The app scans that folder. Use refresh if nothing appears.

The library can live on a **NAS** or network share. Run Nyetflix on your PC (or Pi), then set the folder to a mapped drive like `Z:\Movies` or a UNC path like `\\NAS\media\Movies`. The share must be reachable and signed in when the app runs.

### Cloud & NAS storage (S3, MinIO, Google Cloud Storage, WebDAV)

Each profile has its own media sources: two people can share a source, or use completely different ones. In a profile's **Preferences**, open **Media library**, pick the type, hit **Test connection**, and save. The profile's first source becomes its library; add more there and switch with **Use as library**.

| Source | What to enter |
|---|---|
| **Folder on this computer** | A path like `C:\Movies`, an external drive, or a mounted NAS share |
| **Another PC (shared folder)** | Share the folder on the other PC (Properties → Sharing), then enter its name and the share name, or paste `\\OTHER-PC\Movies`. Leave the login empty to use Windows' saved sign-in, or enter the other PC's username and password. Needs Nyetflix running on Windows; on Linux/Docker, mount the share and use *Folder on this computer* |
| **Google Drive / OneDrive / Dropbox** | Install the provider's desktop app ([Google Drive for desktop](https://www.google.com/drive/download/), OneDrive, [Dropbox](https://www.dropbox.com/install)) and sign in there. Nyetflix finds its folder by itself; pick the movies folder inside it. Files are fetched from the cloud as you watch |
| **NAS (WebDAV)** | URL of the share, e.g. `https://nas.local:5006/video` (Synology *WebDAV Server* package, QNAP, TrueNAS, Nextcloud), username, password |
| **SFTP / seedbox** | Server, port, username, and a password or private key file. Library folder can be absolute (`/mnt/media`) or inside your home folder |
| **Amazon S3** | Region, bucket, IAM access key + secret (needs `s3:ListBucket` and `s3:GetObject`) |
| **MinIO** | Endpoint `http://<host>:9000` (the API port, not the console), bucket, keys. Path-style on |
| **Google Cloud Storage** | Endpoint `https://storage.googleapis.com`, bucket, an **HMAC key** from *Cloud Storage → Settings → Interoperability* |
| **Other S3-compatible** | Cloudflare R2, Backblaze B2, Wasabi, …: the provider's S3 endpoint, bucket, keys |

Connect cloud accounts from a browser **on the computer running Nyetflix** (`http://localhost:3000`): Google, Microsoft and Dropbox only send the browser back to `localhost` after sign-in. Watching works from every device afterwards.

#### Using your own app registration (optional, for developers)

Optional: with an app registration, Nyetflix signs in to the provider directly (a *Sign in with Google / Microsoft / Dropbox* button, no desktop app needed). Register an app with the provider and put its ID in `.env.local`:

**Microsoft (OneDrive)**, about 10 minutes, free:
1. [Azure portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**. Supported accounts: *Accounts in any organizational directory and personal Microsoft accounts*.
2. Redirect URI: platform **Public client/native (mobile & desktop)**, URI `http://localhost/api/oauth/callback`.
3. **API permissions** → add Microsoft Graph delegated `Files.Read`, `User.Read`, `offline_access`.
4. Copy the **Application (client) ID** → `NYETFLIX_MICROSOFT_CLIENT_ID=…`

**Dropbox**, about 10 minutes, free:
1. [Dropbox App Console](https://www.dropbox.com/developers/apps) → **Create app** → *Scoped access* → *Full Dropbox*.
2. **Permissions** tab: tick `files.metadata.read`, `files.content.read`, `account_info.read`, and submit.
3. **Settings** tab: add redirect URI `http://localhost:3000/api/oauth/callback` (use your port), and **Allow public clients (Implicit Grant & PKCE)**.
4. Copy the **App key** → `NYETFLIX_DROPBOX_APP_KEY=…` (works for up to 500 users before Dropbox asks for a review).

**Google Drive**, free, with a catch:
1. [Google Cloud console](https://console.cloud.google.com/) → new project → **APIs & Services → Library** → enable **Google Drive API**.
2. **OAuth consent screen**: External, add the scope `.../auth/drive.readonly`, then set the publishing status to **In production**. (In *Testing* mode Google expires the sign-in every 7 days.)
3. **Credentials → Create credentials → OAuth client ID** → type **Desktop app**.
4. Copy both values → `NYETFLIX_GOOGLE_CLIENT_ID=…` and `NYETFLIX_GOOGLE_CLIENT_SECRET=…`

Reading Drive is a "restricted" permission, so until Google verifies the app (a paid security review), users see an *unverified app* warning (click *Advanced → Continue*), and only up to 100 test users can sign in.

Tokens are stored in `data/storage-sources.json` on the server (git-ignored), refreshed automatically, and never sent to the browser.

How it works:

- Same folder layout as a local library. Video is streamed through Nyetflix with seeking (HTTP range requests), and ffmpeg reads remote files directly over HTTPS.
- Remote sources are **read-only**. Converted MP4/HLS packages and extracted subtitles go to `data/remote-cache/` on the Nyetflix machine, and the original file is never deleted, whatever *Keep original MKV* is set to.
- Credentials are stored in `data/storage-sources.json` on the server (git-ignored) and are never sent back to the browser.

### Watching away from home

Nyetflix has no login, so **don't port-forward it to the internet**. The easy, safe way to use it remotely is [Tailscale](https://tailscale.com) (free): install it on the machine running Nyetflix and on your phone/laptop, then open `http://<machine-name>:3000` from anywhere. Combined with a cloud or NAS storage source, the media doesn't need to be on that machine either. You can also run the Docker image on a small cloud VM next to your bucket.

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

Open http://localhost:3000. Mount your media with `-v /path/to/Movies:/media:ro` and add `/media` as a **Folder on this computer** source in your profile. Pass TMDB with `-e TMDB_API_KEY=your_key`.

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
- **Empty library:** use a full absolute path; mount external drives / NAS shares first and keep them online
- **No posters / trailers:** add a TMDB key to `.env.local`, restart, rescan
- **MKV no audio on Windows:** install ffmpeg; the app can convert and package multi-audio titles when needed

---

Built with Next.js, Tailwind, MUI, Vidstack, and TMDB.
