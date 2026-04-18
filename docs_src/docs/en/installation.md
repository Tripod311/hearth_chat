# Hearthchat Installation Guide

## Repository

Source code is available at:  
https://github.com/Tripod311/hearth_chat

---

## System Requirements

Hearthchat uses mediasoup, which has limited support for ARM architecture.

**Recommended platform:**  
- x86_64 host

---

## Installation via docker pull

## 1. Create docker-compose.yml

Create a `docker-compose.yml` file with the following content:

```yaml
services:
  hearthchat:
    image: tripod311/hearthchat:latest
    container_name: hearthchat

    network_mode: host

    restart: unless-stopped

    environment:
      - HTTP_PORT=443
      - GATE_PORT=14567
      - PORT_BASE=45000
      - PORT_RANGE=999

    volumes:
      - ./data:/app/data
```

---

## 2. Port configuration

You can change the ports if needed:

- **HTTP_PORT** — port for web interface access  
- **GATE_PORT** — TCP port for node-to-node communication  
- **PORT_BASE / PORT_RANGE** — used by mediasoup  

> Usually, these do not need to be changed.  
> If running multiple nodes on the same host, it's recommended to split port ranges.

---

## 3. Start the container

Run the application:

```bash
docker compose up
```

After startup, a `data` folder will be created — it contains all node data.

📦 This folder can be moved between hosts (it acts as your backup).

---

## 4. First login

Open in your browser:

```
http://<host_address>:<HTTP_PORT>
```

Default credentials:

- **login:** root  
- **password:** root  

⚠️ It is recommended to:

1. Create a new user  
2. Log in with it  
3. Delete the `root` user  

---

## 5. TLS configuration (recommended)

You can manually add TLS certificates.

### Folder structure:

```
data/
  certificates/
    server.cert
    server.key
    server.ca (optional)
```

### If certificates are not set:

- the browser will show warnings  
- voice and video chat may work incorrectly  

---

## 6. Run in background

After initial startup, you can stop the container and run it in background:

```bash
docker compose up -d
```

---

## Notes

- All data is stored in the `data` folder  
- Node migration = copying this folder  
- Backup = archive of `data`  

# Installation from source

## Build Docker image from source

⚠️ **Not recommended for low-performance hosts**

The build process may hang or take a long time because during `npm install`, mediasoup may start compiling native dependencies, which heavily loads the system.

---

### 1. Clone the repository

```bash
git clone https://github.com/Tripod311/hearth_chat
```

This command downloads the project source code from GitHub.

After execution, a `hearth_chat` directory will appear.

---

### 2. Build Docker image

```bash
docker build -t tripod311/hearthchat:latest .
```

This command:

- builds a Docker image from source  
- uses the current directory as build context  
- assigns the tag `tripod311/hearthchat:latest`  

⏳ The process may take a significant amount of time depending on your host.

---

## Run from source (without Docker)

If you prefer not to use Docker, you can run the application directly as a Node.js service.

In this case:

- the `data` folder will be created in the project working directory  
- all data will be stored locally alongside the application  

---

### Requirements

- **Node.js version 20 or higher**

---

### 1. Clone the repository

```bash
git clone https://github.com/Tripod311/hearth_chat
```

Downloads the project source code.

---

### 2. Install dependencies

```bash
npm install
```

Installs all required dependencies listed in `package.json`.

⚠️ mediasoup may also compile during this step, which can take time.

---

### 3. Build frontend

```bash
npx vite build
```

Builds the frontend into an optimized production bundle.

---

### 4. Compile backend

```bash
npx tsc
```

Compiles TypeScript server code into JavaScript.

Output is placed in the `server_dist` directory.

---

### 5. Start the application

```bash
node server_dist/main.js
```

Starts the Hearthchat server.

After startup, the application will be available on the configured port.

---

## Notes

- On first run, the `data` folder is created automatically  
- All user data, files, and settings are stored there  
- To migrate a node, simply copy the `data` folder

# Localization

## Existing Localizations

English is available by default everywhere. Existing locale files can be found in the locales folder in the source code. To add an additional language to a node, create a locales folder inside the data directory and place the desired locale file there. English does not need to be installed, as it is included by default.

Example:

```
data/
  locales/
    ru.json
    fr.json
```

## Custom Localizations

You can easily create a locale for your own language — just take the English locale file and translate all the text in it. This can be done quickly and conveniently using AI tools. Installation is the same as for existing localizations.