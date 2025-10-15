import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Get encryption key from environment or use default (CHANGE IN PRODUCTION!)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-character-key!!';

// Derive a 32-byte key from the encryption key
async function getDerivedKey(): Promise<Buffer> {
  const salt = 'journal-app-salt'; // Static salt for consistency
  return (await scryptAsync(ENCRYPTION_KEY, salt, 32)) as Buffer;
}

/**
 * Encrypt text using AES-256-GCM
 * Returns: iv:authTag:encryptedData (all in hex)
 */
export async function encrypt(text: string): Promise<string> {
  if (!text) return '';
  
  try {
    const key = await getDerivedKey();
    const iv = randomBytes(16); // Initialization vector
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt text using AES-256-GCM
 * Expects format: iv:authTag:encryptedData (all in hex)
 */
export async function decrypt(encryptedData: string): Promise<string> {
  if (!encryptedData) return '';
  
  try {
    const key = await getDerivedKey();
    
    // Split the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if data appears to be encrypted (has the expected format)
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  const parts = data.split(':');
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/.test(part));
}

