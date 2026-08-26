// Activity log helper — records who did what, when.
import db from './db.js';

const insert = db.prepare(`
  INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, description)
  VALUES (@user_id, @user_name, @action, @entity_type, @entity_id, @description)
`);

export function logActivity(user, action, entity_type, entity_id, description) {
  try {
    insert.run({
      user_id: user?.id ?? null,
      user_name: user?.full_name ?? user?.email ?? 'Unknown',
      action,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      description: description ?? null,
    });
  } catch (e) {
    // Never let logging break a request.
    console.error('activity log failed:', e.message);
  }
}
