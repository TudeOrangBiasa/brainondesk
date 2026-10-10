import { describe, expect, test } from 'vitest';
import { getOfficeToolHost, OfficeToolHost, setOfficeToolHost } from './office-tool-host';

describe('OfficeToolHost — per-tab relay registration', () => {
  test('echo round-trip returns the tab answer', async () => {
    const host = new OfficeToolHost();
    host.registerTab({
      tabId: 'tab-1',
      path: 'decks/q3.pptx',
      handler: async (tool, input) => ({ output: { tool, input }, isError: false }),
    });
    const result = await host.callTool({
      path: 'decks/q3.pptx',
      tool: 'office_echo',
      input: { ping: 1 },
    });
    expect(result.isError).toBe(false);
    expect(result.output).toEqual({ tool: 'office_echo', input: { ping: 1 } });
  });

  test('unopened file returns a clear MVP error', async () => {
    const host = new OfficeToolHost();
    const result = await host.callTool({
      path: 'decks/missing.pptx',
      tool: 'office_echo',
      input: {},
    });
    expect(result.isError).toBe(true);
    expect(String(result.output)).toContain('decks/missing.pptx');
    expect(String(result.output)).toContain('not open');
  });

  test('unregistering a tab closes the relay path', async () => {
    const host = new OfficeToolHost();
    const unregister = host.registerTab({
      tabId: 'tab-1',
      path: 'decks/q3.pptx',
      handler: async () => ({ output: null, isError: false }),
    });
    unregister();
    expect(host.listOpenPaths()).toEqual([]);
    const result = await host.callTool({ path: 'decks/q3.pptx', tool: 'office_echo', input: {} });
    expect(result.isError).toBe(true);
  });

  test('disallowed relay hides open tabs and refuses calls', async () => {
    const host = new OfficeToolHost();
    host.registerTab({
      tabId: 'tab-1',
      path: 'decks/q3.pptx',
      handler: async () => ({ output: null, isError: false }),
    });
    host.setRelayAllowed(false);
    expect(host.isRelayAllowed()).toBe(false);
    expect(host.listOpenPaths()).toEqual([]);
    const result = await host.callTool({ path: 'decks/q3.pptx', tool: 'office_echo', input: {} });
    expect(result.isError).toBe(true);
  });

  test('shared host singleton round-trips registration', () => {
    const previous = getOfficeToolHost();
    const next = new OfficeToolHost();
    setOfficeToolHost(next);
    expect(getOfficeToolHost()).toBe(next);
    setOfficeToolHost(previous);
  });
});
