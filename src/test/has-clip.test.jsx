import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { audio } from '../features/audio/audioService.js';
import { useHasClip } from '../features/audio/useAudio.js';
import { audioKey } from '../features/audio/hash.js';

// The lesson shows "read by a Standard Arabic voice, not an Egyptian accent" only for Egyptian lines that have no real Egyptian recording.
describe('useHasClip', () => {
  afterEach(() => vi.restoreAllMocks());
  const text = 'إزيك يا صاحبي';
  it('is true only when a recording in exactly that language exists', async () => {
    vi.spyOn(audio, 'loadManifest').mockResolvedValue({ eg: new Set([audioKey(text, 'eg')]), ar: new Set([audioKey(text, 'ar')]) });
    const eg = renderHook(() => useHasClip(text, 'eg'));
    await waitFor(() => expect(eg.result.current).toBe(true));
    const other = renderHook(() => useHasClip('جملة أخرى', 'eg'));
    await new Promise((r) => setTimeout(r, 20));
    expect(other.result.current).toBe(false);
  });
  it('is false while the list loads, when it has no Egyptian clips (fallback in use), or when there is no text', async () => {
    vi.spyOn(audio, 'loadManifest').mockResolvedValue({ eg: new Set(), ar: new Set([audioKey(text, 'ar')]) });
    const r = renderHook(() => useHasClip(text, 'eg'));
    expect(r.result.current).toBe(false);
    await new Promise((x) => setTimeout(x, 20));
    expect(r.result.current).toBe(false);
    expect(renderHook(() => useHasClip(null, 'eg')).result.current).toBe(false);
  });
  it('is false when the list could not be fetched', async () => {
    vi.spyOn(audio, 'loadManifest').mockResolvedValue(null);
    const r = renderHook(() => useHasClip(text, 'eg'));
    await new Promise((x) => setTimeout(x, 20));
    expect(r.result.current).toBe(false);
  });
});
