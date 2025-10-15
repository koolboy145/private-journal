# Private Journal

A secure, self-hosted private journal application with end-to-end encryption, rich text editing, and modern UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey.svg)

## Features

- 🔐 **AES-256-GCM Encryption** - All diary entries encrypted at rest
- 📝 **Rich Text Editor** - WYSIWYG editor with Markdown support
- 📊 **Dashboard & Analytics** - Visual stats and entry graphs
- 🌓 **Dark Mode** - Built-in dark mode support
- 💾 **Import/Export** - CSV export with optional encryption
- ⚡ **Autosave** - Configurable auto-save feature
- 🔒 **Privacy First** - Self-hosted, your data stays yours
- 🐳 **Multi-Architecture** - Supports AMD64 and ARM64

## Supported Platforms

| Architecture | Devices |
|--------------|---------|
| **AMD64** | Intel/AMD PCs, Servers, Cloud VMs |
| **ARM64** | Raspberry Pi 4/5, Apple Silicon (M1/M2/M3), ARM servers |

Docker automatically pulls the correct image for your platform.

## Quick Start

### 1. Generate Encryption Key

```bash
openssl rand -base64 32
```

**⚠️ IMPORTANT:** Save this key securely! Losing it means permanent data loss.

### 2. Run with Docker

```bash
docker run -d \
  --name private-journal \
  -p 9090:3001 \
  -v $(pwd)/journal-data:/data \
  -e ENCRYPTION_KEY="your-generated-key-here" \
  -e NODE_ENV=production \
  -e TZ=UTC \
  --restart unless-stopped \
  your-username/private-journal:latest
```

### 3. Access

Open your browser to: **http://localhost:9090**

## Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
services:
  journal-app:
    image: your-username/private-journal:latest
    container_name: private-journal
    ports:
      - "9090:3001"
    volumes:
      - ./data:/data
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - NODE_ENV=production
      - TZ=UTC
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

Create `.env` file:

```env
ENCRYPTION_KEY=your-generated-key-here
```

Deploy:

```bash
docker compose up -d
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | ✅ Yes | - | AES-256 encryption key (use `openssl rand -base64 32`) |
| `NODE_ENV` | No | `production` | Environment mode |
| `TZ` | No | `UTC` | Timezone ([full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |

### Timezone Examples

```env
TZ=UTC                    # Universal Time
TZ=America/New_York       # US Eastern
TZ=America/Los_Angeles    # US Pacific  
TZ=Europe/London          # UK
TZ=Asia/Tokyo             # Japan
TZ=Australia/Sydney       # Australia
```

## Volumes

| Path | Description |
|------|-------------|
| `/data` | SQLite database and application data |

**Example:**
```bash
-v /path/on/host:/data
```

The database file will be created at `/data/journal.db`.

## Ports

| Port | Description |
|------|-------------|
| `3001` | Application HTTP server |

Map to any host port:
```bash
-p 8080:3001  # Access on port 8080
-p 9090:3001  # Access on port 9090 (default)
```

## Health Check

The container includes a health check endpoint:

```bash
curl http://localhost:9090/api/health
```

Expected response: `{"status":"ok"}`

## Data Persistence & Backup

### Backup Database

```bash
# Docker Compose
docker compose down
cp ./data/journal.db ./backup/journal-$(date +%Y%m%d).db
docker compose up -d

# Docker Run
docker stop private-journal
docker cp private-journal:/data/journal.db ./backup/
docker start private-journal
```

### Export Entries

Use the built-in export feature:
1. Login to the app
2. Go to **Settings** → **Data Management**
3. Click **Export to CSV**
4. Optionally enable encryption for the export

## Security

### Data Encryption
- All diary entries are encrypted with **AES-256-GCM** before storage
- Each entry uses a unique initialization vector (IV)
- Passwords are hashed with **bcrypt** (10 rounds)

### Container Security
- Runs as **non-root user** (uid=1001, user `user`)
- Minimal attack surface with Alpine Linux base
- Health checks for automatic recovery

### Best Practices
- ✅ Generate strong encryption keys (32+ characters)
- ✅ Use HTTPS in production (reverse proxy recommended)
- ✅ Keep regular backups of `/data` directory
- ✅ Secure your `.env` file (`chmod 600 .env`)
- ⚠️ Never share your encryption key
- ⚠️ Losing the encryption key = permanent data loss

### Production Deployment

For production, use a reverse proxy with SSL:

#### Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name journal.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Caddy Example

```
journal.yourdomain.com {
    reverse_proxy localhost:9090
}
```

## ARM Devices (Raspberry Pi)

### Supported
- ✅ Raspberry Pi 4 (all RAM variants)
- ✅ Raspberry Pi 5
- ✅ Apple Silicon Macs (M1/M2/M3)
- ✅ ARM cloud servers (AWS Graviton, etc.)

### Not Supported
- ⚠️ Raspberry Pi 3 (ARMv7) - Requires 64-bit OS or use ARM64 image

### Raspberry Pi Setup

```bash
# Verify architecture (should show aarch64)
uname -m

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Deploy (after logout/login)
docker compose up -d
```

**Performance:** Runs smoothly on Raspberry Pi 4 with 2GB+ RAM.

## Updating

```bash
# Pull latest version
docker pull your-username/private-journal:latest

# Recreate container
docker compose down
docker compose pull
docker compose up -d

# Or with docker run
docker stop private-journal
docker rm private-journal
# Run the docker run command again with :latest
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs private-journal

# Common issues:
# - Missing ENCRYPTION_KEY
# - Port already in use
# - Permission issues with volume
```

### Can't access on port 9090

```bash
# Check if container is running
docker ps

# Check port mapping
docker port private-journal

# Check firewall
sudo ufw allow 9090
```

### Database errors

```bash
# Check database file permissions
docker exec private-journal ls -la /data

# Ensure volume is properly mounted
docker inspect private-journal | grep -A 10 Mounts
```

### "Failed to save entry" errors

- Ensure `ENCRYPTION_KEY` is set
- Check browser console for detailed errors
- Clear browser cache/cookies
- Verify container logs: `docker logs private-journal`

## Common Commands

```bash
# View logs
docker logs -f private-journal

# Stop container
docker stop private-journal

# Start container
docker start private-journal

# Restart container
docker restart private-journal

# Remove container (data persists in volume)
docker rm private-journal

# Access container shell
docker exec -it private-journal sh
```

## Resource Usage

| Device | Memory | CPU |
|--------|--------|-----|
| Idle | ~150MB | <1% |
| Active Use | ~200MB | 5-10% |

Very lightweight - perfect for Raspberry Pi or small VPS!

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend:** Node.js, Express, TypeScript
- **Database:** SQLite with better-sqlite3
- **Editor:** Tiptap (WYSIWYG + Markdown)
- **Encryption:** Node.js crypto (AES-256-GCM)
- **Auth:** bcrypt + express-session

## Links

- **Source Code:** [GitHub Repo](https://github.com/koolboy145/private-journal)
- **Issues:** [GitHub Issues URL](https://github.com/koolboy145/private-journal/issues)
- **Documentation:** [Full Documentation URL]
- **License:** [MIT](LICENSE)

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/koolboy145/private-journal/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**⚠️ Security Reminder:** This is a self-hosted application. You are responsible for securing your deployment, managing encryption keys, and backing up your data. Always use HTTPS in production and keep your encryption keys secure!

**Made with ❤️ for privacy-conscious journaling**

