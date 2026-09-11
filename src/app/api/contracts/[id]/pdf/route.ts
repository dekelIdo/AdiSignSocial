import { NextResponse } from "next/server";
import { findMetadata, readOriginalPdf } from "@/lib/contracts";
import { asciiFallbackFileName, contentDisposition } from "@/lib/filenames";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const metadata = await findMetadata(id);

  if (!metadata) {
    return NextResponse.json({ message: "הקישור הזה כבר לא זמין." }, { status: 404 });
  }

  try {
    const pdfBytes = await readOriginalPdf(id);

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        // Content-Length lets the browser show real loading progress.
        "Content-Length": String(pdfBytes.byteLength),
        "Content-Disposition": contentDisposition(
          "inline",
          metadata.originalName,
          asciiFallbackFileName(),
        ),
        // no-transform keeps proxies from re-compressing, which would drop
        // Content-Length and with it the loading progress.
        "Cache-Control": "private, max-age=0, must-revalidate, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Original PDF could not be read", {
      contractId: id,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ message: "הקישור הזה כבר לא זמין." }, { status: 404 });
  }
}
