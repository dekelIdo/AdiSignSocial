import nodemailer from "nodemailer";

type SendSignedPdfInput = {
  pdfBytes: Uint8Array;
  fileName: string;
  contractId: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export async function sendSignedPdfEmail({
  pdfBytes,
  fileName,
  contractId,
}: SendSignedPdfInput) {
  const port = Number(requiredEnv("EMAIL_PORT"));
  const user = requiredEnv("EMAIL_USER");

  const transporter = nodemailer.createTransport({
    host: requiredEnv("EMAIL_HOST"),
    port,
    secure: port === 465,
    auth: {
      user,
      pass: requiredEnv("EMAIL_PASS"),
    },
  });

  await transporter.sendMail({
    from: `"SimpleSign" <${user}>`,
    to: requiredEnv("OWNER_EMAIL"),
    subject: "Your signed contract is ready",
    text: `A client signed ${fileName}. The signed PDF is attached.\n\nContract ID: ${contractId}`,
    attachments: [
      {
        filename: fileName.replace(/\.pdf$/i, "-signed.pdf"),
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
