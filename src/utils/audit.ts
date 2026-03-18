import { generateId } from './crypto';

export async function logAudit(
  db: D1Database,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string,
  ipAddress?: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(generateId(), userId, action, entityType ?? null, entityId ?? null, details ?? null, ipAddress ?? null)
    .run();
}

export async function createNotification(
  db: D1Database,
  userId: string,
  message: string,
  type: string = 'info'
): Promise<void> {
  await db
    .prepare('INSERT INTO notifications (id, user_id, type, message) VALUES (?, ?, ?, ?)')
    .bind(generateId(), userId, type, message)
    .run();
}
