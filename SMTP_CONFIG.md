# SMTP Configuration Guide

This guide explains how to configure SMTP settings for email notifications in the Private Journal app.

## Environment Variables

Configure SMTP settings using environment variables in your Docker deployment.

### Required Variables

- **`SMTP_HOST`**: SMTP server hostname
  - Example: `smtp.gmail.com`, `smtp.sendgrid.net`, `smtp.mailgun.org`

- **`SMTP_PORT`**: SMTP server port
  - Common values:
    - `587` - STARTTLS (default, recommended)
    - `465` - SSL/TLS
    - `25` - Unencrypted (not recommended)

### Optional Variables

- **`SMTP_SECURE`**: Boolean flag for SSL/TLS
  - `true` - Use SSL/TLS on port 465
  - `false` - Use STARTTLS on port 587 (default)
  - If not set, will infer from `SMTP_SECURITY_PROTOCOL`

- **`SMTP_SECURITY_PROTOCOL`**: Security protocol string
  - `tls` - STARTTLS (default)
  - `ssl` - SSL/TLS
  - `none` - No encryption (not recommended)
  - Note: `SMTP_SECURE` takes precedence if both are set

- **`SMTP_USER`**: SMTP username for authentication
  - Required for most SMTP servers

- **`SMTP_PASS`**: SMTP password for authentication
  - Required for most SMTP servers

- **`SMTP_FROM`**: Sender email address
  - If not set, uses `SMTP_USER` or defaults to `noreply@journal.app`

- **`SMTP_VERIFY_CONNECTION`**: Verify SMTP connection on first use
  - `true` - Verify connection (default, recommended)
  - `false` - Skip verification

- **`SMTP_TLS_REJECT_UNAUTHORIZED`**: Reject invalid TLS certificates
  - `true` - Reject invalid certificates (default, recommended for production)
  - `false` - Allow self-signed certificates (useful for development/testing)

## Example Configurations

### Gmail (STARTTLS)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

Note: For Gmail, you need to use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

### Gmail (SSL/TLS)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

### AWS SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

### Custom SMTP Server (Self-signed Certificate)
```bash
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=username
SMTP_PASS=password
SMTP_FROM=noreply@yourcompany.com
SMTP_TLS_REJECT_UNAUTHORIZED=false
```

## Docker Compose Configuration

Add these variables to your `.env.docker` file or `docker-compose.yml`:

```yaml
environment:
  - SMTP_HOST=${SMTP_HOST}
  - SMTP_PORT=${SMTP_PORT:-587}
  - SMTP_SECURE=${SMTP_SECURE:-false}
  - SMTP_USER=${SMTP_USER}
  - SMTP_PASS=${SMTP_PASS}
  - SMTP_FROM=${SMTP_FROM}
```

## Security Best Practices

1. **Never commit passwords**: Store SMTP credentials in environment variables or Docker secrets, never in code
2. **Use App Passwords**: For services like Gmail, use app-specific passwords instead of your main account password
3. **Enable TLS/SSL**: Always use encrypted connections (`SMTP_SECURE=true` or `SMTP_SECURITY_PROTOCOL=tls`)
4. **Validate Certificates**: Keep `SMTP_TLS_REJECT_UNAUTHORIZED=true` in production
5. **Restrict Access**: Configure firewall rules to only allow connections from your Docker container to the SMTP server

## Troubleshooting

### Email Not Sending

1. Check that all required environment variables are set
2. Verify SMTP credentials are correct
3. Check Docker logs: `docker-compose logs journal-app`
4. Ensure SMTP server is accessible from the container
5. Verify firewall/security group rules allow outbound SMTP connections

### Connection Errors

- **"ECONNREFUSED"**: SMTP server is not reachable or wrong hostname/port
- **"EAUTH"**: Invalid username or password
- **"ETIMEDOUT"**: Firewall blocking connection or wrong port
- **"CERT_HAS_EXPIRED"**: Certificate validation failed (set `SMTP_TLS_REJECT_UNAUTHORIZED=false` for testing only)

### Testing SMTP Configuration

You can test the SMTP configuration by:
1. Creating a reminder with email notifications enabled
2. Checking the server logs for SMTP connection verification messages
3. Verifying that emails are received at the configured email address
