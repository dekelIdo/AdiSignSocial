# AdiSignSocial (SimpleSign)

A small, trustworthy signing flow for Adi's client agreements. The owner uploads a PDF and gets a private link; the client opens it on her phone, reads, signs with her finger, places the signature on the signature line, confirms, and downloads or shares the signed PDF. The owner receives the signed PDF by email.

No login, no accounts, no database, no separate backend.

## Stack

- Next.js App Router with TypeScript (strict), Tailwind CSS v4.
- PDF rendering in the browser: pdf.js.
- PDF signing on the server: pdf-lib.
- Signature input: signature_pad (finger friendly, retina aware).
- Email delivery: Nodemailer over SMTP (Brevo).
- Storage: `.data/contracts/<token>/` on the service filesystem (or `CONTRACT_STORAGE_DIR`).
- Tests: Vitest.

## How the signing flow works

1. `POST /api/contracts` stores the original PDF, an optional client name and the page count, and returns `/sign/<token>` (token = 96 random bits, base64url).
2. `/sign/<token>` renders all pages with pdf.js. Page boxes are reserved from the PDF's own dimensions before rendering, so nothing jumps.
3. The client draws a signature; the bitmap is trimmed to its visible ink before it is previewed or sent.
4. The signature is placed as an overlay on the last page. Its position is stored as **fractions of the displayed page box** (see `src/lib/signature-placement.ts`), which are independent of viewport width, device pixel ratio, zoom and scroll.
5. `POST /api/contracts/<token>/sign` receives the PNG and the normalized placement, converts the fractions to PDF user-space coordinates using the same CropBox/MediaBox and rotation rules pdf.js uses for display, embeds the image with pdf-lib, stores `signed.pdf`, then emails the owner. Email failure never fails the signing; it is logged and recorded in `metadata.json`.
6. `/success?id=<token>` offers download (`הסכם-חתום-<שם>.pdf`) and WhatsApp sharing.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in SMTP values
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run typecheck
npm test          # coordinate regression suite (pdf.js cross-check, rotation, real-geometry fixture)
npm run build
```

To also run the regression against the real agreement (kept outside the repository):

```bash
REAL_CONTRACT_PDF=/path/to/agreement.pdf npm test
```

## Environment variables

Required for owner delivery:

```bash
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=<Brevo SMTP login>
EMAIL_PASS=<Brevo SMTP key>
OWNER_EMAIL=adiarieli@gmail.com
```

Optional:

```bash
CONTRACT_STORAGE_DIR=/var/data/contracts   # only with a Render persistent disk
PUBLIC_BASE_URL=https://adisignsocial.onrender.com   # used for the download link in owner emails
```

Without a persistent disk, uploaded and signed PDFs live on the service filesystem and may be lost on redeploy or restart. The signed PDF is also attached to the owner email.

## Render deployment

`render.yaml` describes the web service: `npm install && npm run build`, `npm start`, Node 20+. Deploys happen on push to `main`.

## Troubleshooting

- Upload fails: the file must be a readable PDF under 60MB. The upload endpoint parses the PDF up front and returns a clear message if it cannot.
- Signing succeeded but no email arrived: check Render logs for `Failed to send signed PDF email`; `metadata.json` for the contract holds `emailError`. The signed PDF is still available at `/api/contracts/<token>/signed`.
- Signature position: the placement pipeline is covered by `src/lib/__tests__`; run `npm test` after touching `signature-placement.ts`, `pdf.ts`, or the overlay.

## Security notes

- `.env*` files, `node_modules` and `.data` are ignored by git.
- Tokens are unguessable and carry no filesystem meaning; ids are validated before any path is built.
- Customer-facing errors are plain Hebrew; technical detail stays in server logs.
