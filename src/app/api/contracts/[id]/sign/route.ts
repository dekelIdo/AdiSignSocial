import { NextResponse } from "next/server";
import {
  readMetadata,
  readOriginalPdf,
  saveSignedPdf,
  writeMetadata,
} from "@/lib/contracts";
import { sendSignedPdfEmail } from "@/lib/email";
import { addSignatureToLastPage } from "@/lib/pdf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { signature?: string };

    if (!body.signature?.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { message: "Please add your signature before finishing." },
        { status: 400 },
      );
    }

    const [metadata, originalPdf] = await Promise.all([
      readMetadata(id),
      readOriginalPdf(id),
    ]);
    const signedPdf = await addSignatureToLastPage(originalPdf, body.signature);
    const signedAt = new Date().toISOString();

    await saveSignedPdf(id, signedPdf);

    try {
      await sendSignedPdfEmail({
        pdfBytes: signedPdf,
        fileName: metadata.originalName,
        contractId: id,
      });

      await writeMetadata(id, {
        ...metadata,
        signedAt,
        emailSentAt: new Date().toISOString(),
      });
    } catch (emailError) {
      console.error("Failed to send signed PDF email", {
        contractId: id,
        error: emailError instanceof Error ? emailError.message : emailError,
      });

      await writeMetadata(id, {
        ...metadata,
        signedAt,
        emailErrorAt: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        emailSent: false,
        signedUrl: `/api/contracts/${id}/signed`,
        message: "המסמך נשמר, אך כרגע לא ניתן לשלוח אותו במייל.",
      });
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      message: "Your document has been successfully signed.",
    });
  } catch (signError) {
    console.error("Failed to sign PDF", {
      error: signError instanceof Error ? signError.message : signError,
    });

    return NextResponse.json(
      { message: "We could not finish the signature. Please try again." },
      { status: 500 },
    );
  }
}
