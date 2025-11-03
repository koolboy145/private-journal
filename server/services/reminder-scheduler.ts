// Reminder scheduler service - checks for due reminders and sends notifications

import { reminderQueries } from '../database.js';
import { sendReminderNotification } from './notifications.js';

// Track last sent reminders to avoid duplicates
// Format: reminderId -> last sent timestamp (ISO string)
const lastSentCache = new Map<string, string>();

/**
 * Check if a reminder is due based on current time and days of week
 */
function isReminderDue(reminder: {
  time: string; // Format: "HH:MM"
  daysOfWeek: number[]; // Array of day numbers (0=Sunday, 1=Monday, etc.)
}): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Check if today is in the reminder's days of week
  if (!reminder.daysOfWeek.includes(currentDay)) {
    return false;
  }

  // Check if current time matches reminder time (within a 1-minute window)
  const [reminderHour, reminderMinute] = reminder.time.split(':').map(Number);
  const reminderTimeMinutes = reminderHour * 60 + reminderMinute;
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Consider due if within the same minute
  return reminderTimeMinutes === currentTimeMinutes;
}

/**
 * Check if reminder was already sent recently (within last 30 seconds)
 * This prevents duplicate sends if the scheduler runs multiple times in the same minute
 */
function wasRecentlySent(reminderId: string): boolean {
  const lastSent = lastSentCache.get(reminderId);
  if (!lastSent) {
    return false;
  }

  const lastSentTime = new Date(lastSent).getTime();
  const now = Date.now();
  const timeDiff = now - lastSentTime;

  // If sent within last 30 seconds, consider it recently sent
  return timeDiff < 30000;
}

/**
 * Process all enabled reminders and send notifications for due ones
 */
async function processReminders(): Promise<void> {
  try {
    // Get all enabled reminders
    const reminders = reminderQueries.findEnabled.all() as any[];

    if (reminders.length === 0) {
      return;
    }

    console.log(`[Reminder Scheduler] Checking ${reminders.length} enabled reminder(s)...`);

    for (const row of reminders) {
      try {
        const reminderId = row.id;
        const reminderTime = row.time;
        const daysOfWeek = JSON.parse(row.days_of_week || '[]') as number[];
        const notificationType = row.notification_type;
        const isEnabled = Boolean(row.is_enabled);

        if (!isEnabled) {
          continue;
        }

        // Check if reminder is due
        if (!isReminderDue({ time: reminderTime, daysOfWeek })) {
          continue;
        }

        // Check if already sent recently
        if (wasRecentlySent(reminderId)) {
          console.log(`[Reminder Scheduler] Reminder ${reminderId} already sent recently, skipping...`);
          continue;
        }

        // Prepare reminder data for notification
        const reminder = {
          id: reminderId,
          title: row.title,
          body: row.body || null,
          notificationType: notificationType as 'email' | 'webhook',
          emailAddress: row.email_address || null,
          webhookUrl: row.webhook_url || null,
        };

        // Send notification
        console.log(`[Reminder Scheduler] Sending ${notificationType} notification for reminder: ${reminder.title}`);
        await sendReminderNotification(reminder);

        // Mark as sent
        lastSentCache.set(reminderId, new Date().toISOString());
        console.log(`[Reminder Scheduler] Successfully sent reminder: ${reminder.title}`);

      } catch (error) {
        console.error(`[Reminder Scheduler] Error processing reminder ${row.id}:`, error);
        // Continue processing other reminders even if one fails
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error processing reminders:', error);
  }
}

/**
 * Start the reminder scheduler
 * Checks for due reminders every minute
 */
export function startReminderScheduler(): void {
  console.log('[Reminder Scheduler] Starting reminder scheduler...');

  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    processReminders().catch((error) => {
      console.error('[Reminder Scheduler] Error in initial check:', error);
    });
  }, 5000); // Wait 5 seconds after server starts

  // Then check every minute
  setInterval(() => {
    processReminders().catch((error) => {
      console.error('[Reminder Scheduler] Error in scheduled check:', error);
    });
  }, 60000); // Check every 60 seconds (1 minute)

  console.log('[Reminder Scheduler] Scheduler started - checking reminders every minute');
}
