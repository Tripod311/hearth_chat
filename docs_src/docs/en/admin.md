# Admin Guide

### Node Tab

* Configure the node name and description
* Edit the home page (in JSON format)

Example:

```json
[
  {
    "type": "text",
    "data": {
      "title": "HearthChat node",
      "text": "Example of HearthChat node"
    }
  },
  {
    "type": "image",
    "data": {
      "src": "",
      "alt": "",
      "caption": "Some image"
    }
  },
  {
    "type": "refs",
    "data": [
      {
        "link": "",
        "title": "Welcome topic",
        "description": "Introduce yourself"
      },
      {
        "link": "",
        "title": "Max'x node",
        "description": "Meet my brother"
      }
    ]
  },
  {
    "type": "divider"
  },
  {
    "type": "custom",
    "data": {
      "content": "<span class=\"text-4xl\">Custom span</div>"
    }
  }
]
```

---

### Voice Chat Configuration

To enable voice and video:

* Specify `announced_ip` (the server's public IP address)
* Configure the ICE candidates

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

The server must be restarted after changing any of the following parameters:

* `HTTP_PORT`
* `GATE_PORT`
* `announced_ip`
* `iceCandidates`

⚠️ Federation connections may be interrupted, requiring the nodes to be reconnected.

---

### Users Tab

* Create, edit, and delete users
* Generate invitation links (`Create Invite`)

---

### Actors Tab

* View users who have passed through the node
* Block or unblock users

Blocked users:

* can pass through the node
* cannot read topics or use the chat

---

### Topics Tab

* View, edit, and delete topics

---

### Related Tab

* Manage connections to other nodes
* Send handshake requests

To connect:

1. Enter the node address (for example, `https://some-node.io:port`)
2. Add an optional message
3. Click **Send**
