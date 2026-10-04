-- =======================================================================
-- LUNARIS DATABASE SCHEMA (PostgreSQL)
-- Principles:
-- 1. Minimal non-content metadata only.
-- 2. ZERO readable message content, media, call audio, or video stored.
-- 3. Ephemeral relay packets expire within 10 minutes and are permanently deleted upon delivery.
-- 4. No analytics, tracking, or activity archive tables.
-- =======================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE: Minimal auth credentials & public key bundles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personal_id VARCHAR(12) UNIQUE NOT NULL, -- Format: ID:CSDX2007
    email_hash VARCHAR(64) UNIQUE NOT NULL, -- HMAC-SHA256(lowercase(email), PEPPER)
    password_hash VARCHAR(255) NOT NULL, -- Argon2id / PBKDF2 hash
    display_name VARCHAR(64) NOT NULL,
    bio VARCHAR(256) DEFAULT '',
    avatar_id VARCHAR(32) DEFAULT 'avatar-1',
    identity_key_pub TEXT NOT NULL, -- Base64 ECDH P-256 public key
    signed_prekey_pub TEXT NOT NULL, -- Base64 ECDH P-256 public key
    signed_prekey_sig TEXT NOT NULL, -- Signature over prekey
    one_time_prekeys JSONB DEFAULT '[]'::jsonb, -- Array of one-time prekeys
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL -- Nullable, set when account is cryptographically shredded
);

CREATE INDEX IF NOT EXISTS idx_users_personal_id ON users(personal_id);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- CONNECTIONS TABLE: Mutual accepted connections & incoming requests
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_pair UNIQUE (user_id_a, user_id_b)
);

CREATE INDEX IF NOT EXISTS idx_connections_user_a ON connections(user_id_a);
CREATE INDEX IF NOT EXISTS idx_connections_user_b ON connections(user_id_b);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

-- EPHEMERAL RELAYS TABLE: Temporary transit queue for encrypted packets
-- Plaintext message bodies or media are NEVER stored here.
-- Packets automatically deleted immediately upon recipient ACK or TTL expiry.
CREATE TABLE IF NOT EXISTS ephemeral_relays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    packet_id VARCHAR(64) UNIQUE NOT NULL,
    recipient_personal_id VARCHAR(12) NOT NULL,
    sender_personal_id VARCHAR(12) NOT NULL,
    packet_type VARCHAR(32) NOT NULL, -- 'message' | 'reaction' | 'edit' | 'delete' | 'media' | 'signal_call'
    ephemeral_pubkey TEXT NOT NULL,
    sequence_number INT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    ciphertext TEXT NOT NULL, -- Encrypted AES-GCM-256 ciphertext bytes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_relays_recipient ON ephemeral_relays(recipient_personal_id);
CREATE INDEX IF NOT EXISTS idx_relays_expires ON ephemeral_relays(expires_at);

-- ACTIVE DEVICES TABLE: Lets users audit and revoke signed-in sessions
CREATE TABLE IF NOT EXISTS active_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(64) NOT NULL,
    device_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_device UNIQUE (user_id, device_fingerprint)
);

-- ABUSE REPORTS TABLE: Minimal non-content report for trust & safety
CREATE TABLE IF NOT EXISTS abuse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_personal_id VARCHAR(12) NOT NULL,
    category VARCHAR(32) NOT NULL,
    notes VARCHAR(500) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUTOMATIC EXPIRY CLEANUP FUNCTION
-- Runs periodically to purge any expired relay packets
CREATE OR REPLACE FUNCTION purge_expired_relay_packets() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM ephemeral_relays WHERE expires_at < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
