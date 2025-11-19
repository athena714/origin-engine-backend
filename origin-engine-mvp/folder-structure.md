# The Origin Engine - Vetting Tool: Suggested Folder Structure

- `manifest.json` — Chrome extension manifest (MV3) with permissions and popup configuration.
- `popup.html` — UI shown when clicking the extension action (create your popup markup here).
- `popup.js` — Logic that powers the popup (attach to `popup.html`).
- `popup.css` — Styling for the popup.
- `assets/` — Images or icons used by the extension (e.g., `icon16.png`, `icon48.png`, `icon128.png`).
- `background/` (optional) — Service worker scripts if you later add background logic.
- `README.md` — High-level description and usage notes for the extension.
