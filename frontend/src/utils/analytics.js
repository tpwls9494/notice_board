import { analyticsAPI } from '../services/api';

const ALLOWED_EVENTS = new Set([
  'weekly_summary_impression',
  'weekly_summary_click',
  'dev_news_post_view',
  'login_success',
]);

export function trackAnalyticsEvent(eventName, properties = {}) {
  const normalizedEventName = String(eventName || '').trim().toLowerCase();
  if (!ALLOWED_EVENTS.has(normalizedEventName)) {
    return;
  }

  const page =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/';
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;

  analyticsAPI.trackEvent({
    event_name: normalizedEventName,
    page,
    referrer,
    properties,
  }).catch(() => {
    // Analytics must never break user flows.
  });
}
