# Prelegal frontend

Next.js app for drafting Common Paper agreements. Users sign up, then chat with an AI assistant,
which picks the agreement and fills in its key terms. The agreement shows as a live preview and
downloads as a PDF file (generated in the browser with @react-pdf/renderer).

Routes (static pages; the document id is a query parameter):

- `/login/`, `/signup/`: account screens. `/` redirects to `/documents/` or `/login/`.
- `/documents/`: the user's saved documents.
- `/documents/new/`: ask the assistant which agreement fits, or pick a template.
- `/documents/edit/?id=N`: the editor, with the chat and the live document.

The session is an HttpOnly cookie set by the API; `lib/auth.tsx` asks `/api/auth/me` who is signed in.
Templates come from the API (`/api/catalog/{type}`); `lib/coverPage.ts` builds each document's
cover page (`lib/nda.ts` fills the Mutual NDA's own template).

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
