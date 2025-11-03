import { Router } from 'express';
import { randomUUID } from 'crypto';
import { reminderQueries } from '../database.js';
import { sendReminderNotification } from '../services/notifications.js';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/reminders - Get all reminders for current user
router.get('/', requireAuth, (req, res) => {
  try {
    const rows = reminderQueries.findByUserId.all(req.session.userId) as any[];
    const reminders = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      body: row.body || null,
      time: row.time,
      daysOfWeek: JSON.parse(row.days_of_week || '[]'),
      notificationType: row.notification_type,
      emailAddress: row.email_address,
      webhookUrl: row.webhook_url,
      isEnabled: Boolean(row.is_enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ reminders });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// GET /api/reminders/:id - Get a specific reminder
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const row = reminderQueries.findById.get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (row.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      reminder: {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body || null,
        time: row.time,
        daysOfWeek: JSON.parse(row.days_of_week || '[]'),
        notificationType: row.notification_type,
        emailAddress: row.email_address,
        webhookUrl: row.webhook_url,
        isEnabled: Boolean(row.is_enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching reminder:', error);
    res.status(500).json({ error: 'Failed to fetch reminder' });
  }
});

// POST /api/reminders - Create a new reminder
router.post('/', requireAuth, (req, res) => {
  try {
    const { title, body, time, daysOfWeek, notificationType, emailAddress, webhookUrl, isEnabled } = req.body;

    if (!title || !time || !Array.isArray(daysOfWeek) || !notificationType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (notificationType === 'email' && !emailAddress) {
      return res.status(400).json({ error: 'Email address is required for email notifications' });
    }

    if (notificationType === 'webhook' && !webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required for webhook notifications' });
    }

    if (daysOfWeek.length === 0) {
      return res.status(400).json({ error: 'At least one day of week must be selected' });
    }

    // Validate time format (HH:MM)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    }

    const reminderId = randomUUID();
    const now = new Date().toISOString();

    reminderQueries.create.run(
      reminderId,
      req.session.userId,
      title.trim(),
      notificationType === 'email' && body ? body.trim() : null,
      time.trim(),
      JSON.stringify(daysOfWeek),
      notificationType,
      notificationType === 'email' ? emailAddress?.trim() : null,
      notificationType === 'webhook' ? webhookUrl?.trim() : null,
      isEnabled ? 1 : 0,
      now,
      now
    );

    const row = reminderQueries.findById.get(reminderId) as any;
    res.status(201).json({
      reminder: {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body || null,
        time: row.time,
        daysOfWeek: JSON.parse(row.days_of_week || '[]'),
        notificationType: row.notification_type,
        emailAddress: row.email_address,
        webhookUrl: row.webhook_url,
        isEnabled: Boolean(row.is_enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PUT /api/reminders/:id - Update a reminder
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, time, daysOfWeek, notificationType, emailAddress, webhookUrl, isEnabled } = req.body;

    const existing = reminderQueries.findById.get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (existing.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!title || !time || !Array.isArray(daysOfWeek) || !notificationType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (notificationType === 'email' && !emailAddress) {
      return res.status(400).json({ error: 'Email address is required for email notifications' });
    }

    if (notificationType === 'webhook' && !webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required for webhook notifications' });
    }

    if (daysOfWeek.length === 0) {
      return res.status(400).json({ error: 'At least one day of week must be selected' });
    }

    // Validate time format (HH:MM)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    }

    const now = new Date().toISOString();

    reminderQueries.update.run(
      title.trim(),
      notificationType === 'email' && body ? body.trim() : null,
      time.trim(),
      JSON.stringify(daysOfWeek),
      notificationType,
      notificationType === 'email' ? emailAddress?.trim() : null,
      notificationType === 'webhook' ? webhookUrl?.trim() : null,
      isEnabled ? 1 : 0,
      now,
      id,
      req.session.userId
    );

    const row = reminderQueries.findById.get(id) as any;
    res.json({
      reminder: {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body || null,
        time: row.time,
        daysOfWeek: JSON.parse(row.days_of_week || '[]'),
        notificationType: row.notification_type,
        emailAddress: row.email_address,
        webhookUrl: row.webhook_url,
        isEnabled: Boolean(row.is_enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/reminders/:id - Delete a reminder
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const existing = reminderQueries.findById.get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (existing.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    reminderQueries.delete.run(id, req.session.userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// POST /api/reminders/:id/test - Test send a reminder notification (for development/testing)
router.post('/:id/test', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const row = reminderQueries.findById.get(id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (row.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!row.is_enabled) {
      return res.status(400).json({ error: 'Reminder must be enabled to test' });
    }

    // Prepare reminder data for notification
    const reminder = {
      id: row.id,
      title: row.title,
      body: row.body || null,
      notificationType: row.notification_type as 'email' | 'webhook',
      emailAddress: row.email_address || null,
      webhookUrl: row.webhook_url || null,
    };

    // Send test notification
    await sendReminderNotification(reminder);

    res.json({
      success: true,
      message: `Test ${reminder.notificationType} notification sent successfully`,
    });
  } catch (error) {
    console.error('Error testing reminder:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
