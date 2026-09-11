import { NextResponse } from "next/server";
import {
  findMetadata,
  readOriginalPdf,
  saveSignedPdf,
  updateMetadata,
} from "@/lib/contracts";
import { isEmailConfigured, sendSignedPdfEmail } from "@/lib/email";
import { signedFileName } from "@/lib/filenames";
import { embedSignatureInPdf } from "@/lib/pdf";
import { getPublicOrigin } from "@/lib/request-origin";
import { decodePngDataUrl } from "@/lib/signature-image";
import { parsePlacement } from "@/lib/signature-placement";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MESSAGES = {
  badRequest: "משהו בחתימה לא הגיע כמו שצריך. נסי לחתום שוב.",
  missingLink: "הקישור הזה כבר לא זמין. אפשר לבקש מעדי קישור חדש.",
  failed: "לא הצלחנו לסיים את החתימה. נסי שוב, ואם הבעיה חוזרת אפשר לפנות לעדי.",
} as const;

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: { signature?: unknown; placement?: unknown };
  try {
    body = (await request.json()) as { signature?: unknown; placement?: unknown };
  } catch {
    return NextResponse.json({ message: MESSAGES.badRequest }, { status: 400 });
  }

  const signaturePng = decodePngDataUrl(body.signature);
  if (!signaturePng) {
    return NextResponse.json({ message: MESSAGES.badRequest }, { status: 400 });
  }

  const metadata = await findMetadata(id);
  if (!metadata) {
    return NextResponse.json({ message: MESSAGES.missingLink }, { status: 404 });
  }

  const placement = parsePlacement(body.placement, metadata.pageCount ?? Number.MAX_SAFE_INTEGER);
  if (!placement) {
    return NextResponse.json({ message: MESSAGES.badRequest }, { status: 400 });
  }

  // 1. Generate and persist the signed PDF. This is the customer's outcome and
  //    must never depend on email delivery.
  let signedPdf: Uint8Array;
  const signedAt = new Date().toISOString();
  const fileName = signedFileName(metadata.clientName);

  // When the owner locked the position, the server fits the real bitmap into
  // the owner's box itself; the client's placement is only a preview.
  const target = metadata.signatureTarget;
  const fitInto = target && target.locked ? target : null;
  let embeddedPlacement = placement;

  try {
    const originalPdf = await readOriginalPdf(id);
    const embedded = await embedSignatureInPdf({
      pdfBytes: new Uint8Array(originalPdf),
      signaturePng,
      placement,
      fitInto,
    });
    signedPdf = embedded.bytes;
    embeddedPlacement = embedded.placement;
    await saveSignedPdf(id, signedPdf);
    await updateMetadata(id, { signedAt, signedFileName: fileName });
  } catch (signError) {
    console.error("Failed to sign PDF", {
      contractId: id,
      placement,
      error: signError instanceof Error ? signError.stack ?? signError.message : signError,
    });

    return NextResponse.json({ message: MESSAGES.failed }, { status: 500 });
  }

  // 2. Deliver to the owner. Failures are logged and recorded, never surfaced
  //    to the customer as a failed signature.
  let emailSent = false;
  const downloadUrl = `${getPublicOrigin(request)}/api/contracts/${id}/signed`;

  if (!isEmailConfigured()) {
    console.error("Signed PDF email skipped: SMTP is not configured", { contractId: id, downloadUrl });
    await recordEmailError(id, "SMTP is not configured");
  } else {
    try {
      await sendSignedPdfEmail({
        pdfBytes: signedPdf,
        fileName,
        originalName: metadata.originalName,
        clientName: metadata.clientName,
        signedAt,
        downloadUrl,
      });
      emailSent = true;
      await updateMetadata(id, { emailSentAt: new Date().toISOString(), emailError: undefined });
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : String(emailError);
      console.error("Failed to send signed PDF email; the signed PDF is stored", {
        contractId: id,
        downloadUrl,
        error: message,
      });
      await recordEmailError(id, message);
    }
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    signedUrl: `/api/contracts/${id}/signed`,
    fileName,
    placement: embeddedPlacement,
  });
}

async function recordEmailError(id: string, message: string) {
  try {
    await updateMetadata(id, { emailErrorAt: new Date().toISOString(), emailError: message.slice(0, 500) });
  } catch (metadataError) {
    console.error("Failed to record signed PDF email error", {
      contractId: id,
      error: metadataError instanceof Error ? metadataError.message : metadataError,
    });
  }
}
