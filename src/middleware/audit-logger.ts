import * as fs from 'fs';
import * as path from 'path';

export interface AuditEntry {
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  userId: string;
  result: 'success' | 'error';
  durationMs: number;
  adapter: string;
}

const LOG_DIR = path.join(process.cwd(), 'audit-logs');

/**
 * Append-only audit logger.
 * Writes each tool invocation to a daily JSON-lines file.
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];

  constructor() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  log(entry: AuditEntry): void {
    this.entries.push(entry);
    const date = new Date().toISOString().split('T')[0];
    const file = path.join(LOG_DIR, `audit-${date}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  }

  getRecentEntries(count = 50): AuditEntry[] {
    return this.entries.slice(-count);
  }

  getEntriesByTool(tool: string): AuditEntry[] {
    return this.entries.filter(e => e.tool === tool);
  }
}
