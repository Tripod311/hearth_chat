# ---------- BUILD STAGE ----------
FROM node:24-bookworm-slim AS builder

# build deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libssl-dev \
    libsrtp2-dev \
    libuv1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx vite build
RUN npx tsc


# ---------- RUNTIME STAGE ----------
FROM node:24-bookworm-slim

WORKDIR /app

# runtime libs
RUN apt-get update && apt-get install -y \
    libsrtp2-1 \
    libssl3 \
    libuv1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/client_dist ./client_dist
COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

CMD ["node", "server_dist/main.js"]