# Unattended Runs

How agent runs proceed without the user watching in this repo. No scheduler, no runner: every run starts from a Tude invocation in chat.

- **Wake mechanism:** none scheduled. Runs start when Tude invokes `/whips` in chat (issue queues via intake, single long goals via the `goal` playbook). No orca, no runner loop, no cron on any machine.
- **Run log:** `.scratch/whips/<run>/log.md`, one row per iteration (what changed, check run, predicate movement).
- **Budget habit:** predicate first, then a stated cap (iterations, hours, PR count). Hitting the cap is a stop, reported as such.
- **Queues vs goals:** issue queues through `/whips` intake, single long goals through the `goal` playbook. Landing follows `RISK.md` (low lands on PASS with no human touch, high waits for the human).
- **Verification skill:** `skills/verify-brainondesk/` (launch → doctor → drive → evidence → cleanup); upkeep via `/maintain-verification`, scope limited to that directory.
- **Maintenance:** `/retro` stale-docs sweep plus verification upkeep on Tude invocation, proposals filed, never auto-applied. Output sink: issue(s) labelled `type:chore`.
- **Paralelisme:** maksimal 4 subagent pekerja bersamaan (plus verifier independen
  sesuai kebutuhan). Batas ini dari Tude; worker ke-5 mengantre sampai satu selesai.
- **Otonomi tanpa approval:** agen jalan terus tanpa menunggu persetujuan per langkah.
  Kabari Tude hanya bila risikonya setingkat seluruh proyek (diff besar lintas paket,
  perubahan arsitektur, migrasi data, secret/infra). Selain itu: putuskan sendiri,
  catat di laporan, lanjut.
