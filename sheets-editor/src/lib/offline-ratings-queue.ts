import type { InGameRatingPayload } from '@/types/scout';

export interface QueuedRating {
  clientId: string;
  payload: InGameRatingPayload;
  queuedAt: string;
  lastError?: string;
}

function queueKey(sheetKey: string): string {
  return `scout_offline_ratings_${sheetKey}`;
}

function newClientId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cid_${Date.now()}_${Math.random()}`;
}

export function getQueue(sheetKey: string): QueuedRating[] {
  try {
    const raw = localStorage.getItem(queueKey(sheetKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setQueue(sheetKey: string, queue: QueuedRating[]): void {
  try {
    localStorage.setItem(queueKey(sheetKey), JSON.stringify(queue));
  } catch {
    // localStorage unavailable (private browsing quota, etc.) — nothing more we can do client-side.
  }
}

export function enqueueRating(sheetKey: string, payload: InGameRatingPayload): QueuedRating {
  const item: QueuedRating = {
    clientId: newClientId(),
    payload,
    queuedAt: new Date().toISOString(),
  };
  setQueue(sheetKey, [...getQueue(sheetKey), item]);
  return item;
}

export function removeFromQueue(sheetKey: string, clientId: string): void {
  setQueue(sheetKey, getQueue(sheetKey).filter((q) => q.clientId !== clientId));
}

export function markQueueError(sheetKey: string, clientId: string, message: string): void {
  setQueue(sheetKey, getQueue(sheetKey).map((q) => (q.clientId === clientId ? { ...q, lastError: message } : q)));
}
