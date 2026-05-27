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

const LOG_DIR = path.join(__dirname, '..', '..', 'audit-logs');

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
    try {
      if (!fs.existsSync(LOG_DIR)) {
        return [];
      }
      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .sort();

      const allEntries: AuditEntry[] = [];
      for (const file of files) {
        const filePath = path.join(LOG_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              allEntries.push(JSON.parse(line));
            } catch (e) {
              // Ignore malformed JSON lines
            }
          }
        }
      }
      return allEntries.slice(-count);
    } catch (err) {
      console.error('Error reading recent audit log entries from disk:', err);
      return this.entries.slice(-count);
    }
  }

  getEntriesByTool(tool: string): AuditEntry[] {
    return this.getRecentEntries(1000).filter(e => e.tool === tool);
  }
}
