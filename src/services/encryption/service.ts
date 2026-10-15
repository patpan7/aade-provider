// AES-256 Encryption Service for Sensitive Data (GDPR Compliance)
// Encrypts sensitive fields like counterpart VAT numbers, addresses, etc.
// Uses AES-256-GCM for authenticated encryption

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
}

export class AESEncryptionService {
  private static instance: AESEncryptionService;
  private key: Buffer;

  private constructor() {
    // Get encryption key from environment or generate a secure random one
    const keyString = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32bytes!';
    this.key = scryptSync(keyString, 'salt', KEY_LENGTH);
  }

  static getInstance(): AESEncryptionService {
    if (!AESEncryptionService.instance) {
      AESEncryptionService.instance = new AESEncryptionService();
    }
    return AESEncryptionService.instance;
  }

  /**
   * Encrypt sensitive text data
   */
  encrypt(plaintext: string): EncryptedData {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return {
      iv: iv.toString('base64'),
      encryptedData: encrypted,
      authTag,
    };
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encrypted: EncryptedData): string {
    try {
      const iv = Buffer.from(encrypted.iv, 'base64');
      const authTag = Buffer.from(encrypted.authTag, 'base64');
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt a VAT number (AFM)
   */
  encryptVAT(vatNumber: string): EncryptedData {
    return this.encrypt(vatNumber);
  }

  /**
   * Decrypt a VAT number
   */
  decryptVAT(encrypted: EncryptedData): string {
    return this.decrypt(encrypted);
  }

  /**
   * Check if data is encrypted (simple heuristic)
   */
  isEncrypted(data: string): boolean {
    if (!data) return false;
    // Check if data looks like base64 encrypted content
    return /^[A-Za-z0-9+/=]+$/.test(data) && data.length >= 10;
  }

  /**
   * Get encryption status
   */
  getStatus(): { algorithm: string; keyLength: number; configured: boolean } {
    return {
      algorithm: ALGORITHM,
      keyLength: KEY_LENGTH * 8, // in bits
      configured: !!process.env.ENCRYPTION_KEY,
    };
  }
}

// Export singleton
export const aesEncryption = AESEncryptionService.getInstance();
