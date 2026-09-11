import nodemailer from "nodemailer";

export type SendSignedPdfInput = {
  pdfBytes: Uint8Array;
  /** Human-readable attachment name, e.g. "הסכם-חתום-אסתי-צמרת.pdf". */
  fileName: string;
  originalName: string;
  clientName?: string;
  signedAt: string;
  /** Absolute URL where the owner can download the signed PDF again. */
  downloadUrl?: string;
};

const REQUIRED_ENV = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "OWNER_EMAIL"] as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getEmailPort() {
  const port = Number(requiredEnv("EMAIL_PORT"));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("EMAIL_PORT is not valid");
  }

  return port;
}

/** True when every SMTP variable is present. Missing config is an owner-side problem. */
export function isEmailConfigured() {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}

function formatSignedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMessage(input: SendSignedPdfInput) {
  const who = input.clientName ? `${input.clientName} חתמה על ההסכם.` : "לקוחה חתמה על ההסכם.";
  const when = formatSignedAt(input.signedAt);
  const subject = input.clientName ? `הסכם חתום – ${input.clientName}` : "הסכם חדש נחתם";

  const lines = [
    "שלום עדי,",
    "",
    who,
    `מועד החתימה: ${when}`,
    `קובץ המקור: ${input.originalName}`,
    "",
    `ההסכם החתום מצורף למייל זה (${input.fileName}).`,
    ...(input.downloadUrl ? [`אפשר גם להוריד אותו מכאן: ${input.downloadUrl}`] : []),
    "",
    "AdiSignSocial",
  ];

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #2a2a2e;">
      <p>שלום עדי,</p>
      <p><strong>${escapeHtml(who)}</strong></p>
      <p>מועד החתימה: ${escapeHtml(when)}<br/>קובץ המקור: ${escapeHtml(input.originalName)}</p>
      <p>ההסכם החתום מצורף למייל זה (${escapeHtml(input.fileName)}).</p>
      ${input.downloadUrl ? `<p>אפשר גם להוריד אותו מכאן: <a href="${escapeHtml(input.downloadUrl)}">${escapeHtml(input.downloadUrl)}</a></p>` : ""}
      <p style="color:#6e6e74">AdiSignSocial</p>
    </div>`;

  return { subject, text: lines.join("\n"), html };
}

async function sendOnce(input: SendSignedPdfInput) {
  const port = getEmailPort();
  const user = requiredEnv("EMAIL_USER");
  const transporter = nodemailer.createTransport({
    host: requiredEnv("EMAIL_HOST"),
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user, pass: requiredEnv("EMAIL_PASS") },
  });

  const message = buildMessage(input);

  try {
    return await transporter.sendMail({
      from: `"AdiSignSocial" <${user}>`,
      to: requiredEnv("OWNER_EMAIL"),
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: [
        {
          filename: input.fileName,
          content: Buffer.from(input.pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });
  } finally {
    transporter.close();
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends the signed PDF to the owner. Retries once on a transient failure.
 * Throws when delivery ultimately fails; callers must keep the signed PDF
 * regardless and record the error for the owner.
 */
export async function sendSignedPdfEmail(input: SendSignedPdfInput) {
  try {
    return await sendOnce(input);
  } catch (firstError) {
    console.warn("Signed PDF email failed once, retrying", {
      error: firstError instanceof Error ? firstError.message : firstError,
    });
    await wait(1500);
    return sendOnce(input);
  }
}
