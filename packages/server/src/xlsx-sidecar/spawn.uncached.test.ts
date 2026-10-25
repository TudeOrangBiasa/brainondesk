import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { waitWithinTestBudget } from '../wait-within-test-budget.test-helper.ts';
import { resolveXlsxSidecarBinaryPath } from './binary.ts';
import { XlsxSidecarClient } from './client.ts';

const SHEET_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row>' +
  '<row r="2"><c r="A2"><v>7</v></c></row>' +
  '</sheetData></worksheet>';

const SIDE_CAR_TIMEOUT_MS = 20_000;

function zipFixture(dir: string, name: string, entries: Record<string, string>): string {
  for (const [entry, contents] of Object.entries(entries)) {
    const full = join(dir, entry);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  const out = join(dir, name);
  const script =
    'import os,sys,zipfile; out=sys.argv[1]; names=sys.argv[2:]; ' +
    'archive=zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED); ' +
    '[archive.write(os.path.join(os.getcwd(),n),n) for n in names]; archive.close()';
  execFileSync('python3', ['-c', script, out, ...Object.keys(entries)], { cwd: dir });
  return out;
}

function buildWorkbook(dir: string): string {
  return zipFixture(dir, 'table.xlsx', {
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Grades" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>',
    'xl/sharedStrings.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">' +
      '<si><t>Name</t></si></sst>',
    'xl/worksheets/sheet1.xml': SHEET_XML,
  });
}

describe('xlsx sidecar spawn', () => {
  let tmpDir: string;
  let client: XlsxSidecarClient | null = null;

  const binaryPath = (): string => {
    const resolved = resolveXlsxSidecarBinaryPath();
    if (!resolved)
      throw new Error('xlsx-sidecar binary is not built; run the office-sheets build first');
    return resolved;
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ok-xlsx-sidecar-'));
  });

  afterEach(() => {
    client?.stop();
    client = null;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test(
    'spawns lazily, opens a fixture, and reads a range',
    async () => {
      client = new XlsxSidecarClient(binaryPath(), { idleReapMs: 0 });
      expect(client.isRunning()).toBe(false);

      const path = buildWorkbook(tmpDir);
      const opened = await client.open(path, 'en');
      expect(client.isRunning()).toBe(true);
      expect(typeof opened.sessionId).toBe('string');
      expect(opened.sheets.map((sheet) => sheet.name)).toContain('Grades');

      const sheetId = opened.sheets[0]?.id;
      expect(sheetId).toBeTruthy();
      const range = await client.readRange({
        sessionId: opened.sessionId,
        sheetId: sheetId ?? '',
        range: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 },
      });
      expect(JSON.stringify(range)).toContain('Name');
      expect(JSON.stringify(range)).toContain('42');

      await client.close(opened.sessionId);
    },
    SIDE_CAR_TIMEOUT_MS,
  );

  test(
    'reaps the process after the idle timeout',
    async () => {
      client = new XlsxSidecarClient(binaryPath(), { idleReapMs: 50 });
      const path = buildWorkbook(tmpDir);
      const opened = await client.open(path, 'en');
      expect(client.isRunning()).toBe(true);
      await client.close(opened.sessionId);

      await waitWithinTestBudget('the sidecar process to be reaped', () => !client?.isRunning(), {
        timeoutMs: 5_000,
      });
    },
    SIDE_CAR_TIMEOUT_MS,
  );
});
