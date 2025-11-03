// Notification service for sending reminders via email or webhook

import nodemailer from 'nodemailer';

interface EmailConfig {
  to: string;
  subject: string;
  body: string;
}

interface WebhookConfig {
  url: string;
  payload: Record<string, any>;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true for SSL/TLS (465), false for STARTTLS (587)
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}

// Cache for SMTP transporter and verification status
let smtpTransporter: nodemailer.Transporter | null = null;
let smtpVerified = false;

/**
 * Get SMTP configuration from environment variables
 */
function getSMTPConfig(): SMTPConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portStr = process.env.SMTP_PORT?.trim();
  const port = portStr ? parseInt(portStr, 10) : null;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();

  // Security protocol: 'tls' (STARTTLS), 'ssl' (SSL/TLS), or boolean
  // If SMTP_SECURE is set, use it directly as boolean
  // Otherwise, infer from SMTP_SECURITY_PROTOCOL:
  // - 'ssl' -> secure=true (port 465)
  // - 'tls' -> secure=false (port 587, uses STARTTLS)
  // - 'none' -> secure=false (no encryption)
  let secure = false;
  if (process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== '') {
    secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';
  } else if (process.env.SMTP_SECURITY_PROTOCOL) {
    const protocol = process.env.SMTP_SECURITY_PROTOCOL.toLowerCase();
    secure = protocol === 'ssl'; // Only 'ssl' uses secure=true, 'tls' uses STARTTLS (secure=false)
  }

  // If no SMTP configuration is provided (empty strings or null), return null
  if (!host || host === '' || !port || isNaN(port)) {
    return null;
  }

  // If no auth is provided (empty strings or null), create config without auth
  const auth = (user && user !== '' && pass && pass !== '') ? { user, pass } : undefined;

  return {
    host,
    port,
    secure,
    auth,
    from: (from && from !== '') ? from : ((user && user !== '') ? user : 'noreply@journal.app'),
  };
}

/**
 * Send email notification via SMTP
 */
export async function sendEmail(config: EmailConfig): Promise<void> {
  const smtpConfig = getSMTPConfig();

  if (!smtpConfig) {
    console.error('[Email Notification] SMTP not configured. Set SMTP_HOST and SMTP_PORT environment variables.');
    throw new Error('SMTP server is not configured. Please configure SMTP settings in environment variables.');
  }

  try {
    // Create or reuse transporter (cache it to avoid recreating on every send)
    if (!smtpTransporter) {
      smtpTransporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure, // true for 465, false for other ports
        auth: smtpConfig.auth,
        // Additional options for STARTTLS
        ...(smtpConfig.secure === false && {
          tls: {
            // Do not fail on invalid certificates (for self-signed certs)
            rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
          },
        }),
      });

      // Verify SMTP connection once on first use (optional, but recommended)
      if (!smtpVerified && process.env.SMTP_VERIFY_CONNECTION !== 'false') {
        try {
          await smtpTransporter.verify();
          smtpVerified = true;
          console.log('[Email Notification] SMTP connection verified');
        } catch (verifyError) {
          console.warn('[Email Notification] SMTP verification failed, but continuing:', verifyError);
          // Continue anyway - verification might fail but sending could still work
        }
      }
    }

    // Send email
    const mailOptions = {
      from: smtpConfig.from,
      to: config.to,
      subject: config.subject,
      text: config.body,
      html: `<p>${config.body.replace(/\n/g, '<br>')}</p>`,
    };

    const info = await smtpTransporter.sendMail(mailOptions);
    console.log('[Email Notification] Email sent successfully:', {
      messageId: info.messageId,
      to: config.to,
      subject: config.subject,
    });
  } catch (error) {
    console.error('[Email Notification] Failed to send email:', error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send webhook notification
 */
export async function sendWebhook(config: WebhookConfig): Promise<void> {
  try {
    if (!config.url || config.url.trim() === '') {
      throw new Error('Webhook URL is empty or invalid');
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(config.url);
    } catch (e) {
      throw new Error(`Invalid webhook URL format: ${config.url}`);
    }

    // Ensure URL uses http or https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Webhook URL must use http:// or https:// protocol. Got: ${url.protocol}`);
    }

    console.log(`[Webhook Notification] Sending to: ${config.url}`);
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config.payload),
      // Add timeout (30 seconds)
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      throw new Error(`Webhook returned status ${response.status}: ${errorText}`);
    }

    console.log('[Webhook Notification] Success:', config.url);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Webhook Notification] Timeout after 30 seconds:', config.url);
      throw new Error('Webhook request timed out');
    }
    console.error('[Webhook Notification] Failed:', error);
    throw error;
  }
}

/**
 * Send reminder notification based on type
 */
export async function sendReminderNotification(
  reminder: {
    id: string;
    title: string;
    body?: string | null;
    notificationType: 'email' | 'webhook';
    emailAddress?: string | null;
    webhookUrl?: string | null;
  }
): Promise<void> {
  if (reminder.notificationType === 'email') {
    if (!reminder.emailAddress) {
      throw new Error('Email address is required for email notifications');
    }

    const emailBody = reminder.body || `Reminder: ${reminder.title}\n\nDon't forget to write in your journal today!`;

    await sendEmail({
      to: reminder.emailAddress,
      subject: `Journal Reminder: ${reminder.title}`,
      body: emailBody,
    });
  } else if (reminder.notificationType === 'webhook') {
    if (!reminder.webhookUrl) {
      throw new Error('Webhook URL is required for webhook notifications');
    }

    // Detect Discord webhook URL and format payload accordingly
    const isDiscordWebhook = reminder.webhookUrl.includes('discord.com/api/webhooks') ||
                             reminder.webhookUrl.includes('discordapp.com/api/webhooks');

    let payload: Record<string, any>;

    if (isDiscordWebhook) {
      // Discord webhook format
      const webhookBody = reminder.body || `Reminder: ${reminder.title}\n\nDon't forget to write in your journal today!`;
      payload = {
        content: webhookBody,
        embeds: [
          {
            title: reminder.title,
            description: webhookBody,
            color: 0x5865F2, // Discord brand color
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Journal Reminder',
            },
          },
        ],
      };
    } else {
      // Generic webhook format
      payload = {
        reminder_id: reminder.id,
        title: reminder.title,
        message: reminder.body || `Reminder: ${reminder.title}\n\nDon't forget to write in your journal today!`,
        timestamp: new Date().toISOString(),
        type: 'journal_reminder',
      };
    }

    await sendWebhook({
      url: reminder.webhookUrl,
      payload,
    });
  } else {
    throw new Error(`Unknown notification type: ${reminder.notificationType}`);
  }
}
