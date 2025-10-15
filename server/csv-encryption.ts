import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encrypt CSV content with user-provided password
 * Returns: ENCRYPTED:<algorithm>:<iv>:<authTag>:<data>
 */
export async function encryptCSV(csvContent: string, password: string): Promise<string> {
  try {
    // Derive key from password
    const salt = randomBytes(16);
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const iv = randomBytes(16);
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(csvContent, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: ENCRYPTED:aes-256-gcm:salt:iv:authTag:data
    return `ENCRYPTED:aes-256-gcm:${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('CSV encryption error:', error);
    throw new Error('Failed to encrypt CSV');
  }
}

/**
 * Decrypt CSV content with user-provided password
 */
export async function decryptCSV(encryptedContent: string, password: string): Promise<string> {
  try {
    // Check if content is encrypted
    if (!encryptedContent.startsWith('ENCRYPTED:')) {
      throw new Error('Content is not encrypted');
    }
    
    const parts = encryptedContent.split(':');
    if (parts.length !== 6 || parts[1] !== 'aes-256-gcm') {
      throw new Error('Invalid encrypted format');
    }
    
    const [, , saltB64, ivB64, authTagB64, encrypted] = parts;
    
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    // Derive key from password
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('CSV decryption error:', error);
    throw new Error('Failed to decrypt CSV - incorrect password or corrupted file');
  }
}

/**
 * Check if CSV content is encrypted
 */
export function isCSVEncrypted(content: string): boolean {
  return content.startsWith('ENCRYPTED:aes-256-gcm:');
}

