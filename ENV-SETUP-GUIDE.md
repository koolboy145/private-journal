# Environment Configuration Guide

This guide explains how to set up environment variables for Private Journal.

## 📋 Available Files

### `.env.example`
Complete template with detailed comments for all environment variables.

**Use for:**
- Understanding all available options
- Reference documentation
- Learning about configuration

### `.env.docker.example`
Minimal template for Docker deployment (production).

**Use for:**
- Quick Docker setup
- Production deployments
- Clean, simple configuration

## 🚀 Quick Setup

### Docker Deployment

```bash
# 1. Copy the Docker template
cp .env.docker.example .env.docker

# 2. Generate encryption key
openssl rand -base64 32

# 3. Edit .env.docker and add your key
nano .env.docker

# 4. Deploy
docker compose --env-file .env.docker up -d
```

## 🔐 Generating Encryption Key

The encryption key is **required** and must be at least 32 characters.

### Recommended Method (OpenSSL)

```bash
openssl rand -base64 32
```

**Example output:**
```
Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=
```

### Alternative Methods

#### Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Using Python
```bash
python3 -c "import os; import base64; print(base64.b64encode(os.urandom(32)).decode())"
```

#### Manual (Not Recommended)
Use a strong, random 32+ character string:
```
MyVerySecureRandomKey1234567890!@#$
```

## 📝 Environment Variables Reference

### Required Variables

#### `ENCRYPTION_KEY`
- **Required:** Yes
- **Description:** AES-256 encryption key for diary entries
- **Format:** Base64 string (32+ characters)
- **Example:** `Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=`
- **Generate:** `openssl rand -base64 32`
- **⚠️ Warning:** Losing this key means permanent data loss!

### Optional Variables

#### `NODE_ENV`
- **Required:** No
- **Default:** `production`
- **Options:** `production`, `development`
- **Description:** Application environment mode
- **Example:** `NODE_ENV=production`

#### `HOST_PORT`
- **Required:** No (Docker only)
- **Default:** `9090`
- **Description:** External port to access the application
- **Example:** `HOST_PORT=8080`
- **Usage:** Access app at `http://localhost:8080`

#### `DB_VOLUME`
- **Required:** No (Docker only)
- **Default:** `./data`
- **Description:** Volume mount for database storage (Docker host path or named volume)
- **Auto-Created:** Yes - folder is automatically created if it doesn't exist
- **Examples:**
  - Local directory: `DB_VOLUME=./data`
  - Named volume: `DB_VOLUME=journal-data`
  - Custom path: `DB_VOLUME=/var/lib/journal/data`
- **Note:** Database file created at `/data/journal.db` inside container
- **Permissions:** Container runs as user `1001`, ensure host folder is writable

#### `TZ`
- **Required:** No
- **Default:** `UTC`
- **Description:** Timezone for timestamps
- **Example:** `TZ=America/New_York`
- **Reference:** [Timezone List](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

#### `PORT`
- **Required:** No
- **Default:** `3001`
- **Description:** Internal server port
- **Example:** `PORT=3001`
- **Note:** Usually no need to change

#### `FRONTEND_URL`
- **Required:** No
- **Default:** Auto-detected
- **Description:** Frontend URL for CORS configuration
- **Example:** `FRONTEND_URL=https://journal.yourdomain.com`
- **Usage:** Only needed with reverse proxy

## 🌍 Timezone Examples

Common timezones:

```env
# United States
TZ=America/New_York         # Eastern Time
TZ=America/Chicago          # Central Time
TZ=America/Denver           # Mountain Time
TZ=America/Los_Angeles      # Pacific Time

# Europe
TZ=Europe/London            # UK
TZ=Europe/Paris             # France
TZ=Europe/Berlin            # Germany
TZ=Europe/Rome              # Italy

# Asia
TZ=Asia/Tokyo               # Japan
TZ=Asia/Shanghai            # China
TZ=Asia/Dubai               # UAE
TZ=Asia/Kolkata             # India
TZ=Asia/Singapore           # Singapore

# Australia
TZ=Australia/Sydney         # New South Wales
TZ=Australia/Melbourne      # Victoria
TZ=Australia/Brisbane       # Queensland

# Other
TZ=UTC                      # Universal Time
```

## 🛡️ Security Best Practices

### 1. Protect Your .env File

```bash
# Set proper permissions (owner read/write only)
chmod 600 .env
chmod 600 .env.docker

# Verify permissions
ls -la .env*
# Should show: -rw------- (600)
```

### 2. Never Commit .env Files

Already included in `.gitignore`:
```gitignore
.env
.env.docker
.env.local
.env.*.local
```

### 3. Backup Your Encryption Key

Store your encryption key in a secure location:
- Password manager (recommended)
- Encrypted backup file
- Secure note-taking app

**Do NOT:**
- Store in plain text files
- Email to yourself
- Share in chat/messages
- Commit to version control

### 4. Use Different Keys

Use different encryption keys for:
- Development
- Staging
- Production

Never use development keys in production!

### 5. Regular Rotation

Consider rotating encryption keys periodically:
1. Export all entries to encrypted CSV
2. Generate new encryption key
3. Update `.env` with new key
4. Restart application
5. Import entries with new key

## 📦 Environment Files

### Production Deployment

```bash
# Production
.env.docker           # Docker production (recommended)
.env.production       # Alternative production config
```

### Using Specific Files

```bash
# Docker with default env file
docker compose --env-file .env.docker up -d

# Docker with alternative production env file
docker compose --env-file .env.production up -d
```

## 🔍 Troubleshooting

### Issue: "ENCRYPTION_KEY is not defined"

**Cause:** Missing or empty encryption key

**Solution:**
```bash
# 1. Check if .env file exists
ls -la .env.docker

# 2. Check if ENCRYPTION_KEY is set
grep ENCRYPTION_KEY .env.docker

# 3. Generate and add key
openssl rand -base64 32
# Edit .env.docker and paste the key
```

### Issue: "Failed to decrypt entry"

**Cause:** Wrong encryption key or corrupted data

**Solution:**
1. Verify you're using the correct encryption key
2. Check if encryption key has extra spaces/newlines
3. If key is lost, data cannot be recovered

### Issue: Wrong timezone in timestamps

**Cause:** Incorrect TZ variable

**Solution:**
```bash
# Check current timezone in container
docker exec private-journal date

# Update .env.docker with correct timezone
TZ=America/New_York

# Restart container
docker compose restart
```

### Issue: Permission denied on ./data

**Cause:** Incorrect directory permissions

**Solution:**
```bash
# Create directory with proper permissions
mkdir -p ./data
chmod 755 ./data

# Restart container
docker compose restart
```

## 📋 Example Configurations

### Minimal Production Setup

```env
# .env.docker
ENCRYPTION_KEY=Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=
```

### Full Production Setup

```env
# .env.docker
ENCRYPTION_KEY=Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=
NODE_ENV=production
HOST_PORT=8080
DB_VOLUME=/var/lib/journal/data
TZ=America/New_York
FRONTEND_URL=https://journal.yourdomain.com
```

## ✅ Validation Checklist

Before deploying, verify:

- [ ] `.env` or `.env.docker` file exists
- [ ] `ENCRYPTION_KEY` is set (32+ characters)
- [ ] `ENCRYPTION_KEY` is securely backed up
- [ ] File permissions are secure (600)
- [ ] Timezone is correct for your location
- [ ] Port is available and not in use
- [ ] Database directory exists and is writable
- [ ] `.env` is listed in `.gitignore`

## 🔗 Additional Resources

- [Environment Variables Documentation](README.md#configuration)
- [Docker Deployment Guide](README.md#docker-deployment-recommended)
- [Security Best Practices](README.md#security)
- [Timezone Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

**Need help?** Check the [README.md](README.md) or open an issue on GitHub.
