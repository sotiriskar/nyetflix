# Nyetflix – Docker image (Node + ffmpeg)
FROM node:22-bookworm-slim

# Install ffmpeg for streaming/transcoding
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy app and build
COPY . .
RUN npm run build

EXPOSE 3000

# Persist app data (DB, registry) via volume at /app/data
ENV NODE_ENV=production
CMD ["npm", "start"]
