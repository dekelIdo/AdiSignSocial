import { NextResponse } from "next/server";
import { readMetadata, readSignedPdf } from "@/lib/contracts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const [metadata, pdfBytes] = await Promise.all([readMetadata(id), readSignedPdf(id)]);
    const signedName = metadata.originalName.replace(/\.pdf$/i, "-signed.pdf");

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(signedName)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "The signed PDF is not available yet." },
      { status: 404 },
    );
  }
}
