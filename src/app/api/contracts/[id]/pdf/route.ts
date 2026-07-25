import { NextResponse } from "next/server";
import { readMetadata, readOriginalPdf } from "@/lib/contracts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const [metadata, pdfBytes] = await Promise.all([readMetadata(id), readOriginalPdf(id)]);

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(metadata.originalName)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "This signing link is no longer available." },
      { status: 404 },
    );
  }
}
