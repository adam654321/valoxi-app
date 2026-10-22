FROM node:22-bookworm-slim

# chromium for Puppeteer PDFs. postgresql-client-18 from PGDG: bookworm's own
# postgresql-client is 15, and pg_dump refuses to dump a newer server (Neon is 18).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium NODE_ENV=production

WORKDIR /app
COPY package.json package-lock.json ./
# NODE_ENV=production would skip devDependencies, which the build and server/vite.ts need.
RUN npm ci --include=dev
COPY . .

# Vite inlines this into the client bundle, so it must exist at build time.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG GIT_SHA=unknown
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY GIT_SHA=$GIT_SHA
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" || (echo "VITE_CLERK_PUBLISHABLE_KEY build arg is required" && exit 1)
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
