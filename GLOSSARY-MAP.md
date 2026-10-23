# GLOSSARY-MAP

Index of per-context glossaries. Skills read this file first, then the glossaries relevant to their topic. Terms are created lazily by `/domain-modeling`; a missing glossary means no terms resolved yet — proceed silently.

| Context | Glossary | Scope |
| --- | --- | --- |
| core | `packages/core/GLOSSARY.md` | registry, tab, server inti, domain bersama |
| app | `packages/app/GLOSSARY.md` | editor UI, state model, komponen |
| server | `packages/server/GLOSSARY.md` | collaboration server, sync, API |
| desktop | `packages/desktop/GLOSSARY.md` | Electron shell, packaging, update |
| office | `packages/office-*/GLOSSARY.md` | editor .docx/.xlsx/.pptx (satu file per paket) |
| cli/plugin | `packages/cli/GLOSSARY.md`, `packages/plugin/GLOSSARY.md` | CLI dan integrasi agen |

System-wide decisions live in `docs/adr/`; context-scoped decisions in `packages/<context>/docs/adr/`.
