import { NextResponse } from "next/server";
import { findMetadata } from "@/lib/contracts";
import { signedFileName } from "@/lib/filenames";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Non-sensitive state for the success screen. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const metadata = await findMetadata(id);

  if (!metadata) {
    return NextResponse.json({ message: "הקישור הזה כבר לא זמין." }, { status: 404 });
  }

  return NextResponse.json(
    {
      signed: Boolean(metadata.signedAt),
      emailSent: Boolean(metadata.emailSentAt),
      clientName: metadata.clientName ?? "",
      fileName: metadata.signedFileName || signedFileName(metadata.clientName),
      signatureTarget: metadata.signatureTarget ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
