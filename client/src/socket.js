import { io } from 'socket.io-client';

// Strip stray whitespace/BOM (a pasted or piped env value can carry an invisible
// U+FEFF that turns the URL into a relative path) and any trailing slash.
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API_BASE = rawApiUrl.replace(/[﻿\s]+/g, '').replace(/\/+$/, '');

export const socket = io(API_BASE, { autoConnect: true });

// Only 502/503/504 mean "the host is still booting" (Render free tier spin-down).
// Anything else with an unreadable body is a different problem, so report the status
// instead of blaming a cold start.
export async function safeJson(res) {
  const text = await res.text();
  try {
    if (text) return JSON.parse(text);
  } catch {
    // fall through to the status-based message below
  }
  if ([502, 503, 504].includes(res.status)) {
    throw new Error('Server is waking up (this can take up to a minute on first use) — please try again.');
  }
  throw new Error(`Unexpected response from server (HTTP ${res.status}). Please try again.`);
}
