# Hearthchat

Hearthchat is an engine for federated micro-communities, inspired by early 2000s forums but enhanced with modern capabilities such as text, voice, and video communication.

The project is designed for small groups of people who want to communicate in an isolated and independent environment — without relying on centralized platforms or facing the risk of service restrictions.

---

## Project Concept

Hearthchat creates local communication nodes that can be connected into a federation.

Each node is an autonomous space (essentially a lightweight forum combined with chat), while communication between nodes is established directly.

### Primary use cases:

- family  
- friends  
- small communities  
- teams  

---

## Key Features

- 📦 Easy installation (Docker)  
- 🔁 High portability (single data directory)  
- 🌐 Decentralized federation of nodes  
- 💬 Text, voice, and video chat (WebRTC)  
- 🔗 Direct node-to-node communication (TCP)  

---

## Trust Model

Hearthchat is built around a trusted environment:

- Users know each other  
- Node administrators personally know each other  
- Nodes are connected to the federation via invitation  
- No public registration or open network access  

This allows:

- eliminating complex permission systems  
- simplifying the architecture  
- avoiding unnecessary bureaucracy  

---

## Security and Encryption

The project follows a pragmatic approach to security:

Data transmission is secured using standard protocols:

- HTTPS  
- WebSocket (WSS)  
- WebRTC  

Encryption is provided by TLS (certificates).

At the same time:

- ❌ No end-to-end encryption  
- ❌ No anonymity  
- ❌ No complex cryptographic systems  

This is an intentional decision derived from the trust-based model.

---

## Federation

- Nodes connect directly via TCP  
- No global registration  
- No automatic discovery of nodes  
- No shared global user database  

Connections between nodes are established manually by administrators.

---

## Purpose

The main goal of Hearthchat is to provide a reliable communication channel for closed groups that:

- does not depend on centralized services  
- remains functional under network restrictions  
- uses widely adopted protocols (HTTPS, WebSocket, WebRTC) that are difficult to block  

---

## Project Philosophy

Hearthchat follows these principles:

- Simplicity over complexity  
- Trust over control  
- Small communities over mass platforms  
- Autonomy over centralization  
