// Activity log helper — records who did what, when.
import db from './db.js';

export async function logActivity(user, action, entity_type, entity_id, description) {
  try {
    await db.prepare(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, description)
      VALUES (?,?,?,?,?,?)`).run(
      user?.id ?? null, user?.full_name ?? user?.email ?? 'Unknown',
      action, entity_type ?? null, entity_id ?? null, description ?? null);
  } catch (e) {
    console.error('activity log failed:', e.message); // never let logging break a request
  }
}
