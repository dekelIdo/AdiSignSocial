# SimpleSign

SimpleSign is a no-login PDF signing MVP for non-technical clients. A business owner uploads a PDF, sends the generated link, and receives the signed PDF by email after the client signs in the browser.

## Installation

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload a PDF, and send the generated `/sign/...` link.

## Environment Variables

Create `.env.local` locally or configure the same variables in your hosting provider:

```bash
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-user@example.com
EMAIL_PASS=your-smtp-password
OWNER_EMAIL=owner@example.com
```

## SMTP Configuration

Use any SMTP provider that supports username/password authentication. Common ports:

- `587` for STARTTLS
- `465` for SSL

`OWNER_EMAIL` receives the signed PDF attachment. If email sending fails, SimpleSign still saves the signed PDF in temporary server storage under `.data/contracts`.

## Deployment on Vercel

1. Push the project to GitHub.
2. Import it in Vercel as a Next.js project.
3. Add the SMTP environment variables from `.env.example`.
4. Deploy.

Vercel serverless storage is temporary. For production retention, download signed PDFs from email or move storage to durable object storage later.

## Deployment on Render

1. Create a Render Web Service from the repository.
2. Use these commands:

```bash
npm install
npm run build
npm run start
```

3. Add the SMTP environment variables from `.env.example`.
4. Deploy.

Render disk storage is suitable for temporary recovery. Add a persistent disk if signed PDF recovery must survive restarts.

## Project Architecture

- `src/app/page.tsx`: landing page and upload entry.
- `src/app/sign/[id]/page.tsx`: unique client signing page.
- `src/app/success/page.tsx`: final confirmation screen.
- `src/app/api/contracts/route.ts`: PDF upload and link creation.
- `src/app/api/contracts/[id]/pdf/route.ts`: inline original PDF delivery.
- `src/app/api/contracts/[id]/sign/route.ts`: signature insertion, signed PDF saving, and email delivery.
- `src/app/api/contracts/[id]/signed/route.ts`: recovery download for signed PDFs.
- `src/components`: upload UI, PDF renderer, and signing UI.
- `src/lib`: contract storage, PDF manipulation, and email delivery.

## Production Notes

SimpleSign intentionally avoids accounts, databases, and separate backend services. Uploaded contracts and signed PDFs are stored temporarily on the server filesystem. For a larger production rollout, add durable private file storage and scheduled cleanup while preserving the same client UX.
