import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QualisRecord {
  issn: string;
  journal_name?: string;
  area: string;
  classification: string;
}

export class QualisService {
  private static instance: QualisService;
  private db: Database.Database | null = null;
  private getQualisStmt: Database.Statement | null = null;

  private constructor() {}

  public static getInstance(): QualisService {
    if (!QualisService.instance) {
      QualisService.instance = new QualisService();
    }
    return QualisService.instance;
  }

  private initDatabase(): void {
    if (this.db) return;

    const dbPath = path.join(__dirname, '..', 'data', 'qualis.db');
    
    try {
      this.db = new Database(dbPath, { readonly: true });
      this.getQualisStmt = this.db.prepare(`
        SELECT issn, journal_name, area, classification 
        FROM qualis 
        WHERE issn = ? OR issn = ?
      `);
    } catch (error) {
      console.warn('Qualis database not found or invalid. Qualis functionality disabled.');
      this.db = null;
    }
  }

  public isAvailable(): boolean {
    this.initDatabase();
    return this.db !== null;
  }

  public getQualisByISSN(issn: string): QualisRecord | null {
    if (!this.isAvailable() || !this.getQualisStmt) {
      return null;
    }

    try {
      // Try both with and without hyphen (some databases store differently)
      const issnWithHyphen = this.formatISSN(issn);
      const issnWithoutHyphen = issn.replace('-', '');
      
      const result = this.getQualisStmt.get(issnWithHyphen, issnWithoutHyphen) as QualisRecord | undefined;
      return result || null;
    } catch (error) {
      console.error('Error querying Qualis database:', error);
      return null;
    }
  }

  private formatISSN(issn: string): string {
    // Remove any existing formatting
    const clean = issn.replace(/[^0-9X]/gi, '');
    
    // Add hyphen if not present and valid length
    if (clean.length === 8 && !issn.includes('-')) {
      return `${clean.substring(0, 4)}-${clean.substring(4)}`;
    }
    
    return issn;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.getQualisStmt = null;
    }
  }
}