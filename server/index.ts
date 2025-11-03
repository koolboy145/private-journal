// Load environment variables from .env file (development)
import 'dotenv/config';

import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import './database.js'; // Initialize database (runs on import)
import { SQLiteStore } from './session-store.js';
import authRoutes from './routes/auth.js';
import entriesRoutes from './routes/entries.js';
import tagsRoutes from './routes/tags.js';
import remindersRoutes from './routes/reminders.js';
import templatesRoutes from './routes/templates.js';
import { startReminderScheduler } from './services/reminder-scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files in production (Docker deployment)
if (process.env.NODE_ENV === 'production') {
  // Path is /app/dist when running from /app/server-dist/server/index.js
  const distPath = path.resolve(__dirname, '../../dist');
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
}

// Security headers for data in transit
app.use((req, res, next) => {
  // Skip HTTPS redirect for health check and non-API routes
  if (req.path === '/api/health' || !req.path.startsWith('/api/')) {
    return next();
  }

  // Force HTTPS in production for API only (when behind a proxy)
  if (process.env.NODE_ENV === 'production' &&
      req.headers['x-forwarded-proto'] &&
      req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  // Security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HSTS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(
  session({
    store: new SQLiteStore(),
    secret: process.env.SESSION_SECRET || 'journal-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Only use secure cookies when behind a reverse proxy (x-forwarded-proto header present)
      secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    },
  })
);

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
  }
}

// Serve static files in production (before API routes to avoid conflicts)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', '..', 'dist');
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/templates', templatesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Handle client-side routing in production - serve index.html for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const distPath = path.join(__dirname, '..', '..', 'dist');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Warn if using default encryption key
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.includes('change-this')) {
    console.warn('⚠️  WARNING: Using default encryption key! Set ENCRYPTION_KEY environment variable in production!');
  } else {
    console.log('✓ Encryption enabled with custom key');
  }

  // Start reminder scheduler
  startReminderScheduler();
});
