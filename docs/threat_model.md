# Arca Threat Model & Cryptographic Architecture

## 1. Executive Summary

**Arca** (`/ˈɑːrkə/`, Latin for chest, sanctuary, or strongbox) is a production-quality, privacy-first real-time messaging and video-calling system. It pairs the fluid direct-messaging paradigms of WhatsApp with the usability and group-video grid layout of Google Meet.

Arca is engineered under the principle of **provable zero-knowledge**:
- The application server functions as an untrusted, opaque packet relay.
- All direct messages, attachments, media files, voice calls, and video streams are strictly end-to-end encrypted (E2EE).
- No readable text, encryption keys, decrypted attachments, call recordings, or transcripts ever touch application servers.
- Ephemeral relay packets have a strict 10-minute Time-To-Live (TTL) and are permanently purged upon delivery or expiration.
- Users authenticate with unique immutable identifiers in the format `ID:CSDX2007`.

---

## 2. Cryptographic Architecture

Arca does not invent custom cryptography. All cryptographic operations are grounded in the W3C Web Cryptography API (`SubtleCrypto`) and RFC standards:

```
[ Alice Device ]                                              [ Bob Device ]
       |                                                             |
   1. Identity Key Pair (ECDH P-256)                             1. Identity Key Pair (ECDH P-256)
   2. Signed Pre-key (ECDH P-256)                                2. Signed Pre-key (ECDH P-256)
   3. One-Time Pre-keys (ECDH P-256)                             3. One-Time Pre-keys (ECDH P-256)
       |                                                             |
       +--------------------> [ Arca Server ] <---------------------+
                           (Public Key Directory)
                                     |
                          [ Alice Initiates Chat ]
                                     |
    4. Fetch Bob's Public Prekey Bundle (Identity Pub, Signed PreKey Pub)
    5. X3DH Key Agreement -> Initial Root Key & Chain Key
    6. Double Ratchet Symmetric Step -> Ephemeral 256-bit AES-GCM Key
    7. Encrypt Plaintext + AAD (sender, recipient, seq, ephemeral pub)
    8. Send EncryptedPacket (Ciphertext + IV + AAD + Ephemeral Pub)
                                     |
                               [ Arca Relay ]
                     (Opaque Ciphertext Queue, TTL <= 600s)
                                     |
                         [ Bob Polls / Receives ]
                                     |
    9. Receive EncryptedPacket -> Advance Ratchet Step -> Derive Message Key
   10. Authenticate & Decrypt with AES-GCM-256
   11. Store exclusively in Local Device Vault (IndexedDB / LocalStorage)
```

### 2.1 Key Exchange & Agreement (X3DH)
- **Identity Keys ($IK$):** Long-term ECDH P-256 key pairs generated on the client device during initial registration.
- **Signed Pre-keys ($SPK$):** Medium-term ECDH P-256 key pairs signed by the identity key to prevent MitM during asynchronous session initiation.
- **Shared Secret Derivation:** Combined Diffie-Hellman secrets are mixed using HKDF-SHA256 (RFC 5869) to initialize the Double Ratchet root key and chain key.

### 2.2 Double Ratchet & Forward Secrecy
Arca implements the Signal Protocol-compatible Double Ratchet:
- **KDF Chain Ratchet (Symmetric):** Each sent or received message advances the sending/receiving chain key by computing an HMAC-SHA256 derivation step. The derived message encryption key is used once with AES-GCM-256 and wiped from memory immediately.
- **DH Ratchet (Asymmetric):** Whenever a turn-taking message is sent or received, fresh ECDH ephemeral key pairs are exchanged, creating a new shared secret that mixes fresh entropy into the root key.
- **Break-in Recovery:** If an adversary compromises a device's current ratchet state, they cannot read past messages (forward secrecy) and cannot read future messages once a subsequent DH ratchet step completes (future secrecy / post-compromise security).

### 2.3 Media & File Encryption
- Attachments (images, audio notes, PDF documents) are restricted to a strict 10MB limit.
- Files are encrypted on the sender's client with a random 256-bit Content Encryption Key (CEK) and AES-GCM-256.
- The CEK and IV are encrypted inside the ratcheted message payload.
- Server relay nodes handle only opaque ciphertext bytes; thumbnails and previews are generated strictly on client devices after decryption.

### 2.4 Out-of-Band Peer Verification (Safety Numbers)
- Both connected peers compute a deterministic 60-digit safety number:
  $$\text{Safety Number} = \text{SHA-512}(\text{sort}(ID_A, PK_A, ID_B, PK_B))$$
- Rendered into 12 blocks of 5 digits (e.g. `12345 67890 ...`).
- If an active attacker attempts a Man-in-the-Middle (MitM) replacement of public pre-keys, the safety numbers on Alice and Bob's devices will differ.

---

## 3. Threat Model & Boundaries

### 3.1 Assets to Protect
1. **Message Plaintext & Media:** Confidentiality, integrity, and authenticity.
2. **Call Audio & Video Streams:** Confidentiality and integrity in real time.
3. **Cryptographic Private Keys:** Sovereign storage on client hardware.
4. **User Identifiers & Pairing Consent:** Preventing unsolicited messaging or metadata scraping.

### 3.2 Adversary Capabilities & Mitigations

| Adversary Profile | Attack Vector | Arca Mitigation |
| :--- | :--- | :--- |
| **Passive Network Eavesdropper** | Intercepting TLS traffic or packet inspection | End-to-end encryption with AES-GCM-256 and WebRTC DTLS-SRTP. TLS on all transport layers. Zero readable traffic. |
| **Malicious or Compromised Server** | Inspecting server memory or database dumps | Zero plaintext messages stored. Temporary relay queues hold only opaque ciphertexts with a 10-minute TTL. No media backups. Passwords hashed with Argon2id. |
| **Active Man-in-the-Middle (MitM)** | Tampering with packets in transit or forging pre-keys | AES-GCM Authenticated Additional Data (AAD) prevents forgery. Out-of-band 60-digit safety numbers detect forged pre-keys. |
| **Stolen Device / Physical Inspection** | Accessing local files after a chat is closed | "Clear Chat" permanently executes cryptographic deletion of messages, thumbnails, and session keys from local storage. |
| **Spam / Unsolicited Contact** | Scraping email directories to message users | Email addresses are HMAC-SHA256 hashed and never exposed. Communication is blocked until recipient explicitly accepts connection request. |

---

## 4. Honest Technical Limitations & Non-Claims

To ensure technical integrity and compliance with real-world security standards, Arca explicitly disclaims false claims of absolute anonymity:

1. **Metadata vs. Content:** While Arca **never** possesses message contents or call audio, the server infrastructure knows that user $A$ (`ID:ALIC8821`) and user $B$ (`ID:BOBX4492`) have an accepted connection pairing, and knows the timestamps/packet sizes of transit relay packets.
2. **Endpoint Compromise:** If an adversary installs malware, keyloggers, or screen scrapers on a user's operating system, end-to-end encryption cannot protect content displayed on the screen.
3. **Browser Storage Boundaries:** Local messages are cached in browser storage (IndexedDB / LocalStorage). Clearing browser cache or initiating "Clear Chat" purges this data, but users must exercise standard OS device security.
