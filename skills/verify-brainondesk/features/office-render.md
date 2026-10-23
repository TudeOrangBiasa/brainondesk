# office-render

What: office doc types open read-only in their tab (epic #26, phase-gated).
User path: open `.docx` / `.xlsx` / `.pptx` in desktop or web editor → renders.
Harness drive: phase-gated — drive only the phases whose port ticket closed (#12 docs, #17 sheets, #19 slides, #22 pdf); fixture from AugmentOffice; assert render without console errors.
End state: fixture renders in the correct tab; markdown editor unaffected.
Gotchas: editors load lazily per doc type; missing phase = `verified-unreachable`, never weaken by asserting the markdown fallback instead.
