# editor-roundtrip

What: open a markdown doc, edit through the server, reopen byte-identical.
User path: `ok open notes.md` → edit in browser → save → reopen.
Harness drive: write fixture `notes.md` in vault; `ok open notes.md --project $VDIR`; edit via collab WS or file write; `GET` content back; diff.
End state: served content equals written content; no console errors; markdown file on disk matches.
Gotchas: content dir defaults to vault root; collab WS path is `/collab`; force-sync interval may delay convergence — poll, never sleep-fixed.
