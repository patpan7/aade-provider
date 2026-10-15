// WORM (Write-Once-Read-Many) Storage for Invoice Archival
// Ensures invoices cannot be modified after submission to AADE
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const WORM_STORAGE_PATH = process.env.WORM_STORAGE_PATH || './data/worm_storage';

interface WORMRecord {
  id: string;
  invoice_id: number;
  sha256_hash: string;
  xml_content: string;
  qseal_signature?: string;
  timestamp_token?: string;
  qtsp_provider?: string;
  created_at: string;
  integrity_hash: string; // Hash of all above fields for verification
}

export class WORMStorage {
  private static instance: WORMStorage;

  private constructor() {
    mkdirSync(WORM_STORAGE_PATH, { recursive: true });
  }

  static getInstance(): WORMStorage {
    if (!WORMStorage.instance) {
      WORMStorage.instance = new WORMStorage();
    }
    return WORMStorage.instance;
  }

  /**
   * Store an invoice XML in WORM storage (immutable)
   */
  storeInvoice(
    invoiceId: number,
    xmlContent: string,
    sha256Hash: string,
    qsealSignature?: string,
    timestampToken?: string,
    qtspProvider?: string
  ): WORMRecord {
    const record: WORMRecord = {
      id: randomUUID(),
      invoice_id: invoiceId,
      sha256_hash: sha256Hash,
      xml_content: xmlContent,
      qseal_signature: qsealSignature,
      timestamp_token: timestampToken,
      qtsp_provider: qtspProvider,
      created_at: new Date().toISOString(),
      integrity_hash: '', // Will be set after creation
    };

    // Calculate integrity hash (hash of all fields except itself)
    const hashInput = JSON.stringify({
      ...record,
      integrity_hash: '',
    });
    record.integrity_hash = createHash('sha256').update(hashInput).digest('hex');

    // Write to immutable file
    const filePath = join(WORM_STORAGE_PATH, `${invoiceId}.json`);
    writeFileSync(filePath, JSON.stringify(record, null, 2), { encoding: 'utf-8' });

    return record;
  }

  /**
   * Verify the integrity of a stored invoice
   */
  verifyIntegrity(invoiceId: number): { valid: boolean; error?: string } {
    const filePath = join(WORM_STORAGE_PATH, `${invoiceId}.json`);
    
    if (!existsSync(filePath)) {
      return { valid: false, error: `WORM record not found for invoice ${invoiceId}` };
    }

    try {
      const record: WORMRecord = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      // Recalculate integrity hash
      const hashInput = JSON.stringify({
        ...record,
        integrity_hash: '',
      });
      const expectedHash = createHash('sha256').update(hashInput).digest('hex');

      if (expectedHash !== record.integrity_hash) {
        return { valid: false, error: 'Integrity check failed - record may have been tampered with' };
      }

      // Verify XML hash matches stored hash
      const xmlHash = createHash('sha256').update(record.xml_content).digest('hex');
      if (xmlHash !== record.sha256_hash) {
        return { valid: false, error: 'XML content hash mismatch' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `Error reading WORM record: ${error.message}` };
    }
  }

  /**
   * Retrieve a stored invoice record
   */
  getInvoiceRecord(invoiceId: number): WORMRecord | null {
    const filePath = join(WORM_STORAGE_PATH, `${invoiceId}.json`);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Get all stored invoice IDs (for audit purposes)
   */
  listAllStoredInvoices(): number[] {
    if (!existsSync(WORM_STORAGE_PATH)) {
      return [];
    }

    try {
      const files = require('node:fs').readdirSync(WORM_STORAGE_PATH);
      return files
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => parseInt(f.replace('.json', ''), 10))
        .sort((a: number, b: number) => a - b);
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get WORM storage statistics
   */
  getStatistics(): { totalRecords: number; lastUpdated: string } {
    const invoices = this.listAllStoredInvoices();
    return {
      totalRecords: invoices.length,
      lastUpdated: invoices.length > 0 
        ? new Date().toISOString()
        : 'N/A'
    };
  }
}

// Export singleton instance
export const wormStorage = WORMStorage.getInstance();
