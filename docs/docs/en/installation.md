# Hearthchat Installation Guide

## Repository

Source code is available at:  
[https://github.com/Tripod311/hearth_chat](https://github.com/Tripod311/hearth_chat)

---

## System Requirements

Hearthchat depends on mediasoup, which has limited support for ARM architectures.

**Recommended platform:**  
- x86_64 host

---

## Installation (Docker)

The easiest way to install Hearthchat is via Docker.

### 1. Install dependencies

Make sure the following are installed on your host:

- Docker  
- Git  

---

### 2. Clone repository and build image

```bash
git clone https://github.com/Tripod311/hearth_chat.git
cd hearth_chat
docker build -t hearthchat .
```

---

## Configuration

Configuration is defined in `docker-compose.yml`.

### Environment variables

- `HTTP_PORT` — port for HTTP(S) server (web interface)
- `GATE_PORT` — port for node-to-node communication
- `PORT_BASE`, `PORT_RANGE` — UDP port range for mediasoup traffic  
  - Recommended values:
    - `PORT_BASE=40000`
    - `PORT_RANGE=1000`

---

## SSL Certificates (Optional but Recommended)

You can provide TLS certificates manually.

Create the following structure:

```
data/
  certificates/
    server.cert
    server.key
    server.ca (optional)
```

If certificates are not provided:

- browsers will show security warnings
- voice/video chat may not work properly

---

## Running the Server

Start the server:

```bash
docker compose up
```

If successful:

- HTTP and Gate servers will start
- A `data/` directory will be created with:
  - `database.sqlite`
  - `files/`
  - `tmp/`

---

## First Login

Open in browser:

```
https://your-domain:your-port
```

Default credentials:

- login: `root`
- password: `root`

⚠️ It is strongly recommended to change or remove the default root account.

---

## Administration Panel

### Node Tab

- Configure node name and description
- Edit the title page (currently JSON-based)

Example:

```json
[
  {
    "type": "text",
    "data": {
      "title": "Control Center",
      "text": "Report bugs and features in the main topic using @push."
    }
  },
  {
    "type": "refs",
    "data": [
      {
        "link": "/self/topic/1",
        "title": "General Chat",
        "description": "public topic"
      }
    ]
  }
]
```

---

### Voice Configuration

To enable voice/video chat:

- Set `announced_ip` (your server public IP)
- Configure ICE candidates

Example:

```json
[
  {
    "urls": "stun:stun.l.google.com:19302"
  },
  {
    "urls": "turn:openrelay.metered.ca:80",
    "username": "openrelayproject",
    "credential": "openrelayproject"
  }
]
```

---

### Important Notes

If you change any of the following:

- `HTTP_PORT`
- `GATE_PORT`
- `announced_ip`
- `iceCandidates`

You must restart the server.

⚠️ Federation connections may break and need to be re-established manually.

---

### Users Tab

- Create, edit, delete users
- Generate invite links (`Create Invite`)

Recommended:

- Change default root password  
- Or create a new admin user and remove root  

---

### Actors Tab

- View all users who interacted with the node
- Ban/unban users

Banned users:

- can pass through the node
- cannot read topics or use chats

---

### Topics Tab

- View, edit, delete topics created on the node

---

### Related Nodes Tab

- Manage federation connections
- Send handshake requests

To connect:

1. Enter node URL (e.g. `https://some-node.io:port`)
2. Add optional message
3. Click **Send**

---

## Production Run

After configuration:

```bash
docker compose up -d
```

---

## Node Migration

To migrate a node:

1. Copy the entire `data/` directory to a new server  
2. Start Hearthchat on the new host  
3. Update `announced_ip` in admin panel  
4. Remove old related nodes  
5. Re-send handshake requests  

---

## Done

Your Hearthchat node is now ready to use.
