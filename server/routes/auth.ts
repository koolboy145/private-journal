import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { userQueries, tagQueries } from '../database.js';

const router = Router();

// Default tags to initialize for new users
const DEFAULT_TAGS = ['growth', 'inspiration', 'ideas', 'routine', 'vacation', 'purpose', 'curiosity'];

// Initialize default tags for a user
async function initializeDefaultTags(userId: string) {
  const now = new Date().toISOString();

  for (const tagName of DEFAULT_TAGS) {
    try {
      // Check if tag already exists
      const existing = tagQueries.findByUserIdAndName.get(userId, tagName) as any;
      if (!existing) {
        const tagId = randomUUID();
        tagQueries.create.run(tagId, userId, tagName, null, now);
      }
    } catch (error) {
      console.error(`Failed to initialize tag ${tagName}:`, error);
    }
  }
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = userQueries.findByUsername.get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    // Create user
    userQueries.create.run(userId, username, passwordHash, createdAt);

    // Get the created user (without password hash)
    const user = {
      id: userId,
      username,
      firstName: null,
      lastName: null,
      email: null,
      createdAt,
    };

    // Set session
    req.session.userId = userId;
    req.session.username = username;

    // Initialize default tags for new user
    await initializeDefaultTags(userId);

    res.status(201).json({ user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = userQueries.findByUsername.get(username) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    // Initialize default tags if user doesn't have any (for existing users)
    const userTags = tagQueries.findByUserId.all(user.id) as any[];
    if (userTags.length === 0) {
      await initializeDefaultTags(user.id);
    }

    // Return user without password hash
    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        email: user.email || null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = userQueries.findById.get(req.session.userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      email: user.email || null,
      createdAt: user.created_at,
    },
  });
});

// Update password
router.put('/password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user
    const user = userQueries.findById.get(req.session.userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    userQueries.updatePassword.run(newPasswordHash, req.session.userId);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Update profile
router.put('/profile', (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { firstName, lastName, email } = req.body;

    // Validate email format if provided
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Update profile
    userQueries.updateProfile.run(
      firstName && firstName.trim() !== '' ? firstName.trim() : null,
      lastName && lastName.trim() !== '' ? lastName.trim() : null,
      email && email.trim() !== '' ? email.trim() : null,
      req.session.userId
    );

    // Get updated user
    const user = userQueries.findById.get(req.session.userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        email: user.email || null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
