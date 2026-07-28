import nodemailer from "nodemailer";

type SendSignedPdfInput = {
  pdfBytes: Uint8Array;
  fileName: string;
};

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

export async function sendSignedPdfEmail({
  pdfBytes,
  fileName,
}: SendSignedPdfInput) {
  const port = getEmailPort();
  const user = requiredEnv("EMAIL_USER");

  const transporter = nodemailer.createTransport({
    host: requiredEnv("EMAIL_HOST"),
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user,
      pass: requiredEnv("EMAIL_PASS"),
    },
  });

  await transporter.verify();

  await transporter.sendMail({
    from: `"AdiSignSocial" <${user}>`,
    to: requiredEnv("OWNER_EMAIL"),
    subject: "הסכם חדש נחתם",
    text: `שלום עדי,

התקבל הסכם חדש חתום.

המסמך החתום מצורף למייל זה.

בברכה,
AdiSignSocial`,
    attachments: [
      {
        filename: fileName.replace(/\.pdf$/i, "-signed.pdf"),
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
