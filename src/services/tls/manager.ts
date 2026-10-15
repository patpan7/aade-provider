// TLS/SSL Certificate Manager for HTTPS Communication
// Generates and manages self-signed certificates for development/testing
// In production, use proper CA-signed certificates

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const CERT_DIR = process.env.TLS_CERT_DIR || join(homedir(), '.aade-provider', 'certs');
const CERT_FILE = join(CERT_DIR, 'server.crt');
const KEY_FILE = join(CERT_DIR, 'server.key');

export interface CertificateInfo {
  certPath: string;
  keyPath: string;
  exists: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
}

export class TLSManager {
  private static instance: TLSManager;

  private constructor() {}

  static getInstance(): TLSManager {
    if (!TLSManager.instance) {
      TLSManager.instance = new TLSManager();
    }
    return TLSManager.instance;
  }

  /**
   * Check if TLS certificates exist
   */
  hasCertificates(): boolean {
    return existsSync(CERT_FILE) && existsSync(KEY_FILE);
  }

  /**
   * Get certificate info
   */
  getCertificateInfo(): CertificateInfo {
    const info: CertificateInfo = {
      certPath: CERT_FILE,
      keyPath: KEY_FILE,
      exists: this.hasCertificates(),
    };

    if (this.hasCertificates()) {
      try {
        const openssl = execSync(
          `openssl x509 -in "${CERT_FILE}" -noout -subject -issuer -dates`,
          { encoding: 'utf-8' }
        );
        
        const lines = openssl.split('\n');
        info.subject = this.extractField(lines, 'subject');
        info.issuer = this.extractField(lines, 'issuer');
        info.validFrom = this.extractDate(lines, 'notBefore');
        info.validTo = this.extractDate(lines, 'notAfter');
      } catch {
        // OpenSSL not available or cert parsing failed
      }
    }

    return info;
  }

  /**
   * Generate self-signed certificates for development
   * Usage: tlsManager.generateCertificates()
   */
  generateCertificates(
    cn: string = 'localhost',
    days: number = 365,
    country: string = 'GR',
    organization: string = 'AADE Provider'
  ): { certPath: string; keyPath: string } {
    // Create certificate directory
    mkdirSync(CERT_DIR, { recursive: true });

    // Generate self-signed certificate using OpenSSL
    const opensslCmd = [
      'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', KEY_FILE,
      '-out', CERT_FILE,
      '-days', String(days),
      '-nodes',
      '-subj', `/C=${country}/O=${organization}/CN=${cn}`,
    ].join(' ');

    try {
      execSync(opensslCmd, { stdio: 'pipe' });
      console.log(`[TLS] Generated self-signed certificate:`);
      console.log(`  Cert: ${CERT_FILE}`);
      console.log(`  Key:  ${KEY_FILE}`);
      console.log(`  CN:   ${cn}`);
      console.log(`  Valid: ${days} days`);
    } catch (error: any) {
      console.error('[TLS] Failed to generate certificates:', error.message);
      throw error;
    }

    return { certPath: CERT_FILE, keyPath: KEY_FILE };
  }

  /**
   * Update TLS configuration for Express server
   */
  getTLSConfig(): { key?: Buffer; cert?: Buffer; ca?: Buffer } {
    if (!this.hasCertificates()) {
      console.warn('[TLS] No certificates found. Run generateCertificates() first.');
      return {};
    }

    return {
      key: require('node:fs').readFileSync(KEY_FILE),
      cert: require('node:fs').readFileSync(CERT_FILE),
    };
  }

  /**
   * Extract field from openssl output
   */
  private extractField(lines: string[], field: string): string | undefined {
    const match = lines.find(l => l.includes(field));
    if (match) {
      return match.split('=').slice(1).join('=').trim();
    }
    return undefined;
  }

  /**
   * Extract date from openssl output
   */
  private extractDate(lines: string[], dateField: string): string | undefined {
    const match = lines.find(l => l.includes(dateField));
    if (match) {
      const dateMatch = match.match(/=(.+)/);
      return dateMatch?.[1]?.trim();
    }
    return undefined;
  }
}

// Export singleton
export const tlsManager = TLSManager.getInstance();
