#!/bin/sh
set -e

# ═══════════════════════════════════════════════════════════════════
# Journal App Docker Entrypoint
# Ensures data directory exists and has proper permissions
# ═══════════════════════════════════════════════════════════════════

echo "🚀 Starting Private Journal..."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Check and create data directory
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATA_DIR="/data"

if [ ! -d "$DATA_DIR" ]; then
  echo "📁 Data directory not found, creating: $DATA_DIR"

  # Try to create directory
  if mkdir -p "$DATA_DIR" 2>/dev/null; then
    echo "✅ Data directory created successfully"
  else
    echo "⚠️  Warning: Could not create $DATA_DIR"
    echo "   This is normal if running as non-root user"
    echo "   Docker should have already created it"
  fi
else
  echo "✅ Data directory exists: $DATA_DIR"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Check directory permissions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -w "$DATA_DIR" ]; then
  echo "✅ Data directory is writable"
else
  echo "❌ ERROR: Data directory is not writable: $DATA_DIR"
  echo "   Current user: $(whoami) ($(id -u):$(id -g))"
  echo "   Directory permissions:"
  ls -ld "$DATA_DIR" 2>/dev/null || echo "   (cannot read permissions)"
  echo ""
  echo "💡 To fix this issue:"
  echo "   1. Stop the container: docker-compose down"
  echo "   2. Fix permissions: sudo chown -R 1001:1001 ./data"
  echo "   3. Restart: docker-compose up -d"
  echo ""
  echo "⚠️  Attempting to continue anyway..."
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Check database file
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DB_FILE="${DB_PATH:-/data/journal.db}"
DB_DIR=$(dirname "$DB_FILE")

# Ensure database directory exists (might be nested)
if [ ! -d "$DB_DIR" ]; then
  echo "📁 Creating database directory: $DB_DIR"
  mkdir -p "$DB_DIR" 2>/dev/null || echo "⚠️  Could not create database directory"
fi

if [ -f "$DB_FILE" ]; then
  echo "📊 Database file found: $DB_FILE"
  DB_SIZE=$(du -h "$DB_FILE" 2>/dev/null | cut -f1 || echo "unknown")
  echo "   Size: $DB_SIZE"
else
  echo "📊 Database file will be created on first run: $DB_FILE"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Environment validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "🔧 Configuration:"
echo "   Environment: ${NODE_ENV:-development}"
echo "   Port: ${PORT:-3001}"
echo "   Database: ${DB_PATH:-/data/journal.db}"
echo "   Timezone: ${TZ:-UTC}"

# Check encryption key in production
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" = "default-insecure-key-change-in-production" ]; then
    echo ""
    echo "⚠️  WARNING: ENCRYPTION_KEY not set or using default!"
    echo "   Your data will not be securely encrypted."
    echo "   Generate a key with: openssl rand -base64 32"
    echo "   Set it in your .env.docker file or docker-compose.yml"
    echo ""
  else
    echo "   Encryption: ✅ Enabled"
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Start the application
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "✨ Starting application..."
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Execute the main command (node server)
exec "$@"
