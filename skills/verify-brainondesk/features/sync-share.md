# sync-share

What: sync state visible, share URL minted and decodable.
User path: `ok sync` / `ok status` → `ok share publish` (needs `OK_GH_TOKEN`).
Harness drive: `ok status --json`, `ok sync --json`; `POST /api/share/construct-url` round-trip (mint → decode → freshness `current`) per `packages/server/share-v2-smoke.ts`.
End state: status JSON reports clean/bound state; share token decodes to the same doc path with freshness `current`.
Gotchas: publish needs real GitHub auth — without `OK_GH_TOKEN`, verify construct-url locally only and mark publish `verified-unreachable` with the prerequisite named.
