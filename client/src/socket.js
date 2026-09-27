import { io } from 'socket.io-client';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const socket = io(API_BASE, { autoConnect: true });

// Free-tier hosts (Render) spin down when idle — the first request while the
// container wakes back up can return an empty/non-JSON body via the proxy.
// res.json() throws a cryptic "Unexpected end of JSON input" for that; this
// gives a message that actually explains what happened.
export async function safeJson(res) {
  const text = await res.text();
  if (!text) {
    throw new Error('Server is waking up (this can take up to a minute on first use) — please try again.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server is waking up (this can take up to a minute on first use) — please try again.');
  }
}
