export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function parsePaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export async function generateUserId(fullName: string, db: D1Database): Promise<string> {
  const firstName = fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  const base = firstName || 'user';

  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const id = `${base}${digits}@novapay`;
    const existing = await db.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first();
    if (!existing) return id;
  }

  const fallback = `${base}${Date.now() % 100}${Math.floor(Math.random() * 10)}@novapay`;
  return fallback;
}

export function generateAccountNumber(): string {
  const num = Math.floor(Math.random() * 9000000000) + 1000000000;
  return `ACC${num}`;
}
