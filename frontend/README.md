# Prelegal frontend

Next.js app for creating a Common Paper Mutual NDA. Users sign in, fill in the key terms in a form,
see the completed agreement as a live preview, and download it as a PDF file (generated in the
browser with @react-pdf/renderer).

Routes: `/` redirects to `/login/` or `/app/`; `/login/` is the sign-in screen (a stub for now, any
credentials are accepted by the backend); `/app/` is the NDA creator, shown only once signed in.

The agreement text is read at build time from the repo-level `templates/` directory
(`Mutual-NDA-coverpage.md` and `Mutual-NDA.md`); `lib/nda.ts` fills the cover page placeholders.

In production the app is a static export (`NEXT_OUTPUT=export npm run build`, output in `out/`)
served by the FastAPI backend; see the root README.

## Development

```bash
npm install
npm run dev     # http://localhost:3000, proxies /api to the backend (BACKEND_URL, default :8000)
npm test        # unit and component tests
npm run lint
npm run build
```
