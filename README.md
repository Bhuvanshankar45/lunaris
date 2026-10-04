# Lunaris — Zero-Knowledge Real-Time Messaging & Calling Sanctuary

> **Lunaris** is a production-quality, privacy-first real-time messaging and calling application inspired by **WhatsApp** for direct messaging and **Google Meet** for video-call usability and group grids.

Lunaris is built with **Next.js (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and the native **W3C Web Cryptography API** (`SubtleCrypto`). It is mobile-first, responsive, accessible (WCAG 2.2 AA), and operates under a verifiable zero-knowledge privacy model.

---

## 🛡️ Core Privacy & Cryptographic Guarantees

1. **True End-to-End Encryption (E2EE):**
   - **Messages & Media:** Secured with **Signal Protocol-compatible Double Ratchet** (X3DH initial key agreement, symmetric KDF chains via HKDF-SHA256, and AES-GCM-256 authenticated encryption with AAD).
   - **Calls:** Secured with peer-to-peer **WebRTC DTLS-SRTP**.
   - Ephemeral session ratcheting guarantees **Forward Secrecy** and **Break-in Recovery**.
2. **Zero Readable Server Storage:**
   - Message contents, decrypted files, call audio, and video streams **never** touch application servers in plaintext.
   - The server acts strictly as an opaque packet relay with a **10-minute maximum TTL**. Packets are permanently deleted immediately upon delivery acknowledgement or expiration.
3. **Permanent Cryptographic Shredding:**
   - **Clear Chat:** Explicit confirmation dialog wipes local encrypted messages, thumbnails, and session ratchet keys from the device, and triggers an instantaneous purge of pending transit packets on the server.
   - **Delete Account:** Irreversibly shreds public identity keys, prekey bundles, and accepted connections across the network.
4. **Immutable Human-Readable ID:**
   - Every user receives a unique, collision-resistant identifier in the format `ID:CSDX2007`.
   - Email addresses are HMAC-SHA256 hashed and **never** exposed to other users.
5. **Mutual Consent Connection Flow:**
   - Entering an ID sends a connection request without creating a chat.
   - Messaging and calling are strictly locked until the recipient explicitly accepts.
6. **Strict Opt-In Privacy Controls:**
   - Read receipts (blue double-checks) and notification text previews are **disabled by default**.

---

## 🎨 Visual Design System & Palette

Arca conforms to a warm, restrained privacy-focused palette:

| Token | Hex Code | Usage |
| :--- | :--- | :--- |
| **Primary Green-Gray** | `#A9ABA8` | Primary actions, presence indicators, focus rings |
| **Light Neutral Gray** | `#CBCCC7` | Borders, elevated card surfaces, subtle chips |
| **Soft Ivory** | `#E0E0D5` | Primary background, dialog surfaces, chat headers |
| **Warm Beige** | `#D0CABA` | Outgoing message bubbles, active badges, tabs |
| **Deep Muted Taupe** | `#B8AB90` | Structural card borders, dividers, subtle accents |
| **High Contrast Charcoal**| `#1C1E1B` | Primary body text (WCAG 2.2 AA compliant > 12:1) |
| **Forest Slate** | `#525C51` | Action buttons, brand icons, active tabs |

Arca also includes a **Deep Slate Dark Theme** (`data-theme="dark"`) with identical warm taupe and green-gray accents.

---

## 📱 Implemented Major Screens

1. **Welcome / Landing:** Architectural pillars, zero-knowledge explanations, and instant peer switcher.
2. **Create Account:** Zero-knowledge client-side ECDH P-256 key generation and automatic `ID:CSDX2007` formatting.
3. **Login:** Secure sign-in via email or personal ID.
4. **Dashboard:** Sovereign identity card, shareable ID pill, connection statistics, and incoming request alerts.
5. **Connections:** Categorized tabs for Connected, Incoming Requests (with Accept, Reject, Block), Outgoing Sent, and Blocked Users.
6. **Send Connection Request:** Exact ID search (`ID:CSDX2007`) with format validation.
7. **Incoming Requests Card:** Accept, Reject, and Block actions with privacy shielding.
8. **Chat (WhatsApp-Inspired):**
   - Split conversation list on desktop, compact mobile transitions.
   - Ratcheted encrypted messages with delivery checkmarks (sent, delivered, read).
   - Replies (quoted message banner), emoji reaction picker, and 15-minute message editing with `(edited)` tag.
   - Encrypted media sharing (images, documents, audio voice notes) with strict 10MB limits.
   - Disappearing messages with configurable timers (Off, 30s, 5m, 1h, 24h, 7d).
   - Clear chat dialog with permanent cryptographic deletion.
9. **Call Join / Lobby (Green Room):**
   - Google Meet-style camera preview and microphone volume test meter.
   - Camera and microphone toggles before entering the room.
10. **1:1 Voice & Video Call:** Private WebRTC call with DTLS-SRTP encryption and call duration timer.
11. **Group Video Grid (Google Meet-Inspired):**
    - Responsive participant grid (adaptive 1, 2, 3, 4, 6+ video tiles).
    - Active-speaker animated green-gray border pulse.
    - Pinned participant spotlight mode + filmstrip sidebar.
    - Floating bottom control bar (mic, camera, screen share, in-call chat, participants list, red end call button).
    - In-call encrypted chat that disappears when the call ends.
12. **Profile:** Display name, bio, immutable ID copy/share, in-person QR code pairing representation, and public key audit.
13. **Privacy & Security:** Signed-in device management, verifiable retention policy, blocklist, abuse reporting, local vault wipe, and cryptographic account shredding.
14. **Settings:** Default disappearing message timer, opt-in read receipts, opt-in notification previews, and light/dark theme toggle.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ (tested on Node v24)
- npm v10+

### Installation & Run

1. Navigate to the project directory:
   ```bash
   cd "C:\Users\bhuvan shankar\.gemini\antigravity-ide\scratch\arca"
   ```

2. Install dependencies (already bootstrapped):
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at:
   ```
   http://localhost:3000
   ```

---

## 🧪 Interactive Peer Simulator

Arca includes a built-in **Peer Simulator Switcher** in the top navigation bar:
- **Alice Vance** (`ID:ALIC8821`)
- **Bob Miller** (`ID:BOBX4492`)
- **Dr. Clara Sterling** (`ID:CLAR3310`)

You can switch between Alice and Bob with one click to test two-way Double Ratchet messaging, file encryption, call green rooms, and request approval flows right inside a single browser, or open two separate browser windows to test real-time relay polling.

---

## 🔬 Testing & Verification

Arca includes 21 comprehensive automated tests covering:
- Unique immutable ID generation and format validation (`ID:CSDX2007`)
- ECDH P-256 and HKDF-SHA256 key derivations
- AES-GCM-256 authenticated encryption with Authenticated Additional Data (AAD)
- Signal-compatible Double Ratchet roundtrip exchange and forward secrecy
- Deterministic 60-digit safety numbers
- Client-side file encryption with strict 10MB limits
- Access control (packets blocked between non-accepted contacts)
- Ephemeral relay packet TTL expiration and delivery purge
- Permanent chat clearing
- Privacy-sensitive logging audit (confirming zero plaintext or credential leakage)

Run the test suite:
```bash
npm test
```

Build for production:
```bash
npm run build
```

---

## 📄 Documentation Links
- Threat Model & Cryptographic Architecture: [`docs/threat_model.md`](docs/threat_model.md)
- PostgreSQL Relational Minimal Schema: [`src/lib/db/schema.sql`](src/lib/db/schema.sql)
