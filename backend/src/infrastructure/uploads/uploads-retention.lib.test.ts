import { describe, expect, it } from 'vitest';
import { selectOrphanedUploadUrls } from './uploads-retention.lib';

describe('selectOrphanedUploadUrls', () => {
  const CUTOFF = 1_000_000;

  it('keeps a fresh file even if unreferenced', () => {
    const result = selectOrphanedUploadUrls(
      [{ url: '/uploads/messages/fresh.jpg', mtimeMs: CUTOFF + 1 }],
      CUTOFF,
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it('keeps a stale file if it is referenced by a sent message', () => {
    const result = selectOrphanedUploadUrls(
      [{ url: '/uploads/messages/sent.jpg', mtimeMs: CUTOFF - 1 }],
      CUTOFF,
      new Set(['/uploads/messages/sent.jpg']),
    );
    expect(result).toEqual([]);
  });

  it('selects a stale, unreferenced file — the real orphan case', () => {
    const result = selectOrphanedUploadUrls(
      [{ url: '/uploads/messages/abandoned.jpg', mtimeMs: CUTOFF - 1 }],
      CUTOFF,
      new Set(),
    );
    expect(result).toEqual(['/uploads/messages/abandoned.jpg']);
  });

  it('handles a mix of fresh/stale and referenced/unreferenced correctly', () => {
    const result = selectOrphanedUploadUrls(
      [
        { url: '/uploads/messages/a.jpg', mtimeMs: CUTOFF - 1 }, // stale, unreferenced -> orphan
        { url: '/uploads/messages/b.jpg', mtimeMs: CUTOFF - 1 }, // stale, referenced -> keep
        { url: '/uploads/messages/c.jpg', mtimeMs: CUTOFF + 1 }, // fresh, unreferenced -> keep
        { url: '/uploads/messages/d.jpg', mtimeMs: CUTOFF + 1 }, // fresh, referenced -> keep
      ],
      CUTOFF,
      new Set(['/uploads/messages/b.jpg', '/uploads/messages/d.jpg']),
    );
    expect(result).toEqual(['/uploads/messages/a.jpg']);
  });

  it('returns an empty array for an empty directory listing', () => {
    expect(selectOrphanedUploadUrls([], CUTOFF, new Set())).toEqual([]);
  });

  it('treats a file exactly at the cutoff as not yet stale (strict less-than)', () => {
    const result = selectOrphanedUploadUrls(
      [{ url: '/uploads/messages/edge.jpg', mtimeMs: CUTOFF }],
      CUTOFF,
      new Set(),
    );
    expect(result).toEqual([]);
  });
});
