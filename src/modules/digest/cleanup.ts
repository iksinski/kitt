import { execFile } from 'node:child_process';

export interface CleanupItem { id: string; text: string; }

// Send extracted article texts to the Mac's locked Ollama proxy (ssh alias `mac`, pinned
// to a forced command) for LLM cleanup. Returns id -> cleaned text. On ANY failure — Mac
// off, ssh error, bad output — returns an empty map so the caller keeps the raw text.
export function cleanupViaMac(items: CleanupItem[]): Promise<Map<string, string>> {
  if (!items.length) return Promise.resolve(new Map());
  return new Promise((resolve) => {
    const child = execFile(
      'ssh',
      ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'mac'],
      { timeout: 900000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) { resolve(new Map()); return; }
        try {
          const arr = JSON.parse(stdout) as Array<{ id?: string; cleaned?: string | null }>;
          const m = new Map<string, string>();
          for (const r of arr) if (r?.id && r.cleaned) m.set(r.id, r.cleaned);
          resolve(m);
        } catch {
          resolve(new Map());
        }
      },
    );
    child.stdin?.end(JSON.stringify(items));
  });
}
