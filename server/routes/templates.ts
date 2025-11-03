import { Router } from 'express';
import { randomUUID } from 'crypto';
import { templateQueries } from '../database.js';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/templates - Get all templates for current user
router.get('/', requireAuth, (req, res) => {
  try {
    const rows = templateQueries.findByUserId.all(req.session.userId) as any[];
    const templates = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:id - Get a specific template
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const row = templateQueries.findById.get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (row.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      template: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates - Create a new template
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const templateId = randomUUID();
    const now = new Date().toISOString();

    templateQueries.create.run(
      templateId,
      req.session.userId,
      name.trim(),
      content,
      now,
      now
    );

    const row = templateQueries.findById.get(templateId) as any;
    res.status(201).json({
      template: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id - Update a template
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, content } = req.body;

    // Verify the template belongs to the user
    const existingTemplate = templateQueries.findById.get(id) as any;
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existingTemplate.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const updatedAt = new Date().toISOString();
    templateQueries.update.run(name.trim(), content, updatedAt, id, req.session.userId);

    const row = templateQueries.findById.get(id) as any;
    res.json({
      template: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    // Verify the template belongs to the user
    const template = templateQueries.findById.get(id) as any;
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    templateQueries.delete.run(id, req.session.userId);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
