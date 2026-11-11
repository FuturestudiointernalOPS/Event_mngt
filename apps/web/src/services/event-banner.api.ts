import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/session.store';

/** Multipart upload of an event banner; returns the stored image URL. */
export async function uploadEventBanner(
  slug: string,
  eventId: string,
  file: File,
): Promise<{ bannerUrl: string }> {
  const body = new FormData();
  body.append('file', file);
  const token = useSessionStore.getState().accessToken;
  const response = await fetch(`${env.apiUrl}/api/v1/workspaces/${slug}/events/${eventId}/banner`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body,
  });
  const json = (await response.json()) as {
    data?: { bannerUrl: string };
    error?: { message: string };
  };

  if (!response.ok || !json.data) {
    throw new Error(json.error?.message ?? 'upload_failed');
  }

  return json.data;
}
