import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const indexTsPath = resolve(fileURLToPath(new URL('../../src/main/index.ts', import.meta.url)));
const src = readFileSync(indexTsPath, 'utf-8');

const FIX = (what: string): string =>
  `\n[slides-lifecycle] ${what}\n\n` +
  `Each editor window owns at most one Slidev dev server: opening a second deck from the same\n` +
  `window closes the first deck's window, and the existing closed handler reaps the server it\n` +
  `rendered. The owner id comes from the dispatch sender, the sweep starts once the app is\n` +
  `ready, and the will-quit drain keeps SIGKILLing anything left. The unit tests call the\n` +
  `registry and handler directly, so they stay green while this wiring rots.\n`;

describe('slides lifecycle wiring (bypass-pin)', () => {
  test('the dispatch sender window owns the deck it opens', () => {
    const dispatch =
      /handle\('ok:slides:dispatch'[\s\S]*?handleSlidesOpen\(resolvedDocPath, \{([\s\S]*?)\}\);/.exec(
        src,
      );
    expect(
      dispatch,
      FIX('the slides dispatch handler is no longer recognisable at module scope.'),
    ).not.toBeNull();
    const body = dispatch?.[1] ?? '';
    expect(
      /ownerId: win\?\.id \?\? 0,/.test(body),
      FIX('handleSlidesOpen no longer receives the sender window id as the deck owner.'),
    ).toBe(true);
  });

  test('the deck handed to the window carries the owner id', () => {
    expect(
      /deck,\n\s*noteUsed: \(docPath\) => slidesDeckRegistry\.noteUsed\(docPath\),/.test(src),
      FIX('the deck window no longer receives the opened deck with its owner id.'),
    ).toBe(true);
  });

  test('the idle sweep starts when the app is ready and stops on will-quit', () => {
    expect(
      /stopSlidesIdleSweep = slidesDeckRegistry\.startIdleSweep\(\{/.test(src),
      FIX('the ready block no longer starts the slides idle sweep.'),
    ).toBe(true);
    const willQuitStart = src.lastIndexOf("app.on('will-quit'");
    const willQuitBody = src.slice(
      willQuitStart,
      src.indexOf("app.on('window-all-closed'", willQuitStart),
    );
    expect(
      willQuitStart,
      FIX('the will-quit handler is no longer recognisable at module scope.'),
    ).toBeGreaterThan(-1);
    const body = willQuitBody;
    expect(
      /stopSlidesIdleSweep\?\.\(\);/.test(body) && /stopSlidesIdleSweep = undefined;/.test(body),
      FIX('will-quit no longer stops the slides idle sweep.'),
    ).toBe(true);
  });

  test('will-quit still reaps every Slidev server in the quit drain', () => {
    expect(
      /slidesDeckRegistry\.reapAll\(\),/.test(src),
      FIX('the quit drain no longer reaps every Slidev server.'),
    ).toBe(true);
  });
});
