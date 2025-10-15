# Private Journal

> A secure, self-hosted journal application with AES-256 encryption, rich text editing, and modern UI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://hub.docker.com/r/your-username/private-journal)
[![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey.svg)](#supported-platforms)

---

## ✨ Features

- 🔐 **End-to-End Encryption** - AES-256-GCM encryption for all diary entries
- 📝 **Rich Text Editor** - WYSIWYG editor with Markdown support, formatting, links, and lists
- 📊 **Visual Dashboard** - Statistics, graphs, and recent entries at a glance
- 🌓 **Dark Mode** - Beautiful dark theme that's easy on the eyes
- 💾 **Data Portability** - Export/import as CSV with optional encryption
- 🔄 **Autosave** - Automatic saving as you type (configurable)
- 🔒 **Privacy First** - Self-hosted, your data stays on your server
- 🐳 **Easy Deployment** - Docker container with multi-architecture support
- 🛡️ **Secure by Design** - Runs as non-root user, includes security headers
- 🍓 **ARM Support** - Works on Raspberry Pi 4/5 and Apple Silicon

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Supported Platforms](#supported-platforms)
- [Security](#security)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## 🚀 Quick Start

### Docker (Recommended)

```bash
# 1. Generate encryption key
openssl rand -base64 32

# 2. Create environment file
cat > .env.docker << EOF
ENCRYPTION_KEY=your-generated-key-here
NODE_ENV=production
HOST_PORT=9090
DB_PATH=./data
TZ=UTC
EOF

# 3. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  journal-app:
    image: your-username/private-journal:latest
    container_name: private-journal
    ports:
      - "${HOST_PORT:-9090}:3001"
    volumes:
      - ${DB_PATH:-./data}:/data
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - TZ=${TZ:-UTC}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: unless-stopped
EOF

# 4. Deploy
docker compose --env-file .env.docker up -d

# 5. Access
open http://localhost:9090
```

**That's it!** Your private journal is running securely.

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/private-journal.git
cd private-journal

# Install dependencies
npm install

# Generate encryption key
openssl rand -base64 32

# Create .env file
echo "ENCRYPTION_KEY=your-generated-key-here" > .env

# Start development servers
npm run dev
```

Access at `http://localhost:5173`

---

## 📦 Deployment Options

### Option 1: Docker Compose (Production)

Best for:
- Production deployments
- Easy updates
- Automatic restarts
- Data persistence

See [Docker Hub Documentation](DOCKER-HUB-README.md) for complete guide.

### Option 2: Docker Run

```bash
docker run -d \
  --name private-journal \
  -p 9090:3001 \
  -v $(pwd)/data:/data \
  -e ENCRYPTION_KEY="your-key-here" \
  -e TZ=UTC \
  --restart unless-stopped \
  your-username/private-journal:latest
```

### Option 3: Build from Source

```bash
# Build
npm install
npm run build

# Run
ENCRYPTION_KEY="your-key" npm run server
```

---

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ENCRYPTION_KEY` | AES-256 encryption key (**required**) | Generate with `openssl rand -base64 32` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `HOST_PORT` | `9090` | External port (Docker only) |
| `DB_PATH` | `./data` | Database directory |
| `TZ` | `UTC` | Timezone ([list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |

### Example Configurations

**Minimal:**
```env
ENCRYPTION_KEY=Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=
```

**Full:**
```env
ENCRYPTION_KEY=Kx8vN2mP9qR5tYuI3oL7jK6hG4fD1sA0wZ9xC8vB5nM=
NODE_ENV=production
HOST_PORT=8080
DB_PATH=/var/lib/journal/data
TZ=America/New_York
```

See [ENV-SETUP-GUIDE.md](ENV-SETUP-GUIDE.md) for complete configuration guide.

---

## 🖥️ Supported Platforms

### Docker Images

Multi-architecture Docker images support:

| Platform | Architecture | Devices |
|----------|--------------|---------|
| ✅ AMD64 | x86_64 | PCs, Servers, Cloud VMs |
| ✅ ARM64 | aarch64 | Raspberry Pi 4/5, Apple Silicon (M1/M2/M3) |

Docker automatically pulls the correct image for your platform.

### ARM Devices

**Fully Supported:**
- Raspberry Pi 4 (all RAM variants)
- Raspberry Pi 5
- Apple Silicon Macs (M1/M2/M3)
- AWS Graviton, ARM cloud servers

**Not Supported:**
- Raspberry Pi 3 (ARMv7) - Requires 64-bit OS or see [ARM-SUPPORT.md](ARM-SUPPORT.md) for workarounds

### Minimum Requirements

- **RAM:** 512MB (1GB+ recommended)
- **Storage:** 100MB + your journal data
- **CPU:** Single core sufficient

---

## 🔒 Security

### Data Protection

- **Encryption at Rest:** AES-256-GCM with unique IVs per entry
- **Password Hashing:** bcrypt with 10 rounds
- **Secure Sessions:** HTTP-only cookies, SameSite protection
- **HTTPS Ready:** Automatic redirect in production

### Container Security

- **Non-root User:** Runs as user `user` (uid=1001)
- **Minimal Base:** Alpine Linux for reduced attack surface
- **Health Checks:** Automatic monitoring and recovery
- **No Privileged Access:** Standard user permissions only

### Best Practices

✅ **Do:**
- Generate strong encryption keys (32+ characters)
- Use HTTPS in production (reverse proxy)
- Regular backups of `/data` directory
- Secure file permissions (`chmod 600 .env`)
- Keep encryption key backed up securely

⚠️ **Don't:**
- Use default or weak encryption keys
- Expose port without reverse proxy in production
- Share encryption keys
- Commit `.env` files to version control
- Skip regular backups

**⚠️ Critical:** Losing your encryption key means permanent data loss!

---

## 📚 Documentation

### Quick Links

- **[Docker Hub README](DOCKER-HUB-README.md)** - Docker deployment guide
- **[Environment Setup](ENV-SETUP-GUIDE.md)** - Complete environment configuration
- **[ARM Support](ARM-SUPPORT.md)** - Raspberry Pi and ARM deployment

### Common Tasks

**Backup Data:**
```bash
# Stop container
docker compose down

# Backup database
cp ./data/journal.db ./backup/journal-$(date +%Y%m%d).db

# Restart
docker compose up -d
```

**Update to Latest:**
```bash
docker compose pull
docker compose up -d
```

**View Logs:**
```bash
docker compose logs -f
```

**Export Entries:**
1. Login to app
2. Settings → Data Management
3. Export to CSV
4. Optionally enable encryption

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- shadcn/ui (components)
- Tiptap (rich text editor)
- Recharts (graphs)

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- TypeScript
- bcrypt (password hashing)
- express-session (auth)

**Infrastructure:**
- Docker + Docker Compose
- Multi-stage builds
- Alpine Linux base
- Multi-architecture support

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the project

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (if applicable)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📊 Project Stats

- **Language:** TypeScript
- **License:** MIT
- **Docker Pulls:** _Available on Docker Hub_
- **Platforms:** AMD64, ARM64
- **Size:** ~550MB (Docker image)
- **Memory:** ~200MB (runtime)

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/) - UI framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful components
- [Tiptap](https://tiptap.dev/) - Rich text editor
- [Express](https://expressjs.com/) - Backend framework
- [SQLite](https://www.sqlite.org/) - Database
- [Docker](https://www.docker.com/) - Containerization

---

## 📞 Support

- 🐛 [Issue Tracker](https://github.com/your-username/private-journal/issues)
- 💬 [Discussions](https://github.com/your-username/private-journal/discussions)

---

## 🔗 Links

- **Docker Hub:** [your-username/private-journal](https://hub.docker.com/r/your-username/private-journal)
- **GitHub:** [your-username/private-journal](https://github.com/your-username/private-journal)

---

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
Copyright (c) 2025 Roshan Jacob John

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Made with ❤️ for privacy-conscious journaling**

*Self-hosted • Encrypted • Open Source*
