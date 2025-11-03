import { Router } from 'express';
import { randomUUID } from 'crypto';
import { tagQueries } from '../database.js';

const router = Router();

// Helper to transform database row to API format
const transformTag = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
});

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Get all tags for current user
router.get('/', requireAuth, (req, res) => {
  try {
    const rows = tagQueries.findByUserId.all(req.session.userId) as any[];
    const tags = rows.map(transformTag);
    res.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get tag by ID
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const row = tagQueries.findById.get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    if (row.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ tag: transformTag(row) });
  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({ error: 'Failed to fetch tag' });
  }
});

// Create a new tag
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const trimmedName = name.trim().toLowerCase();

    // Check if tag with same name already exists
    const existing = tagQueries.findByUserIdAndName.get(req.session.userId, trimmedName) as any;
    if (existing) {
      return res.status(409).json({ error: 'Tag with this name already exists' });
    }

    const tagId = randomUUID();
    const now = new Date().toISOString();

    tagQueries.create.run(tagId, req.session.userId, trimmedName, color || null, now);

    const tag = {
      id: tagId,
      userId: req.session.userId,
      name: trimmedName,
      color: color || null,
      createdAt: now,
    };

    res.status(201).json({ tag });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update a tag
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    // Verify tag exists and belongs to user
    const existing = tagQueries.findById.get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    if (existing.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (name) {
      const trimmedName = name.trim().toLowerCase();

      // Check if another tag with this name exists
      const nameConflict = tagQueries.findByUserIdAndName.get(req.session.userId, trimmedName) as any;
      if (nameConflict && nameConflict.id !== id) {
        return res.status(409).json({ error: 'Tag with this name already exists' });
      }

      tagQueries.update.run(trimmedName, color || null, id, req.session.userId);
    } else {
      tagQueries.update.run(existing.name, color || null, id, req.session.userId);
    }

    const updated = tagQueries.findById.get(id) as any;
    res.json({ tag: transformTag(updated) });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete a tag
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    // Verify tag exists and belongs to user
    const existing = tagQueries.findById.get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    if (existing.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    tagQueries.delete.run(id, req.session.userId);
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
