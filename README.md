# SimpleSign

SimpleSign is a minimal Next.js application for signing PDF agreements in the browser. A business owner uploads an agreement, sends the generated signing link, and receives the signed PDF by email after the client signs.

The product intentionally has no login, no accounts, no database, and no separate backend service.

## Project Overview

- Framework: Next.js App Router with TypeScript.
- Styling: Tailwind CSS.
- PDF rendering: pdf.js.
- PDF signing: pdf-lib.
- Signature input: react-signature-canvas.
- Email delivery: Nodemailer over SMTP.
- Storage: temporary server filesystem storage under `.data/contracts` by default.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in SMTP values.

3. Start the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Render Deployment

Deploy as a Render Web Service.

Recommended Render settings:

- Runtime: `Node`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node version: `20` or newer

This repository also includes `render.yaml`, so Render can read the service settings automatically.

## Environment Variables

Required:

```bash
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=<Brevo SMTP Login>
EMAIL_PASS=<Brevo SMTP Key>
OWNER_EMAIL=adiarieli@gmail.com
```

Optional:

```bash
CONTRACT_STORAGE_DIR=/var/data/contracts
```

Use `CONTRACT_STORAGE_DIR` only if a Render persistent disk is mounted. Without it, SimpleSign stores uploaded and signed PDFs in `.data/contracts` on the service filesystem. That storage is suitable for temporary recovery but may be lost if the service is restarted or redeployed.

## SMTP Configuration

Use Brevo SMTP with username and password authentication.

Common ports:

- `587` for STARTTLS.
- `465` for SSL.

`OWNER_EMAIL` receives the signed PDF attachment. If SMTP delivery fails, SimpleSign still saves the signed PDF temporarily so the document is not lost during the request.

## Troubleshooting

If upload fails:

- Confirm the file is a PDF.
- Confirm the file is under 60MB.
- Check Render logs for filesystem write errors.

If signing succeeds but email does not arrive:

- Confirm all SMTP environment variables are set in Render.
- Confirm `EMAIL_PORT` is numeric.
- Confirm Brevo allows sending from `EMAIL_USER`.
- Check spam or security restrictions in Brevo.

If signed PDF recovery is required after restarts:

- Add a Render persistent disk.
- Set `CONTRACT_STORAGE_DIR` to the mounted disk path.

## Production Commands

```bash
npm install
npm run lint
npm run build
npm start
```

## Security Notes

- `.env` files are ignored.
- `node_modules` is ignored.
- `.data` is ignored so uploaded and signed PDFs are not committed.
- No SMTP passwords or secrets should be committed to the repository.
