import { describe, expect, test } from 'vitest';
import { parseOpenResult } from './client.ts';

describe('xlsx sidecar client', () => {
  test('parseOpenResult rejects malformed payloads', () => {
    expect(parseOpenResult(null)).toBeNull();
    expect(parseOpenResult({})).toBeNull();
    expect(parseOpenResult({ sessionId: 7 })).toBeNull();
    expect(parseOpenResult({ sessionId: 's', sheets: [{ id: 'a' }] })).toEqual({
      sessionId: 's',
      sheets: [],
    });
  });
});
