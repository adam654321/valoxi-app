import { db } from '../db';
import { funnelEvents } from '@shared/schema/dashboard';

export function track(
  userCompanyId: number,
  userId: number | null,
  event: string,
  properties?: Record<string, unknown>
): void {
  db.insert(funnelEvents)
    .values({
      userCompanyId,
      userId,
      event,
      properties: properties ?? null,
    })
    .then(() => {})
    .catch((err) => {
      console.error(`[FUNNEL] Failed to track "${event}":`, err);
    });
}
