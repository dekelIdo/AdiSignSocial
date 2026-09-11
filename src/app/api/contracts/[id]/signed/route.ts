import { NextResponse } from "next/server";
import { findMetadata, readSignedPdf } from "@/lib/contracts";
import { asciiFallbackFileName, contentDisposition, signedFileName } from "@/lib/filenames";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const metadata = await findMetadata(id);

  if (!metadata) {
    return NextResponse.json({ message: "הקישור הזה כבר לא זמין." }, { status: 404 });
  }

  try {
    const pdfBytes = await readSignedPdf(id);
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const fileName = metadata.signedFileName || signedFileName(metadata.clientName);

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.byteLength),
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          fileName,
          asciiFallbackFileName(metadata.clientName),
        ),
        "Cache-Control": "private, max-age=0, must-revalidate, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "ההסכם החתום עדיין לא מוכן." }, { status: 404 });
  }
}
