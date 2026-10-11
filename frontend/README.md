# Prelegal frontend

Next.js app for creating a Common Paper Mutual NDA. Users fill in the key terms in a form, see the
completed agreement as a live preview, and download it as a PDF (via the browser's print dialog).

The agreement text is read at build time from the repo-level `templates/` directory
(`Mutual-NDA-coverpage.md` and `Mutual-NDA.md`); `lib/nda.ts` fills the cover page placeholders.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests for the template-filling logic
npm run lint
npm run build
```
