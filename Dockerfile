FROM node:24-bookworm-slim

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

RUN npm install --omit=dev

COPY . .

RUN npx vite build
RUN npx tsc

CMD ["node", "server_dist/main.js"]