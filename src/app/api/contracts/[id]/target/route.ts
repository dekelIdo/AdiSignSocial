import { NextResponse } from "next/server";
import { findMetadata, updateMetadata } from "@/lib/contracts";
import { parseSignatureTarget } from "@/lib/signature-placement";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Owner: define where the customer's signature goes. */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const metadata = await findMetadata(id);

  if (!metadata) {
    return NextResponse.json({ message: "הקישור הזה כבר לא זמין." }, { status: 404 });
  }

  if (metadata.signedAt) {
    return NextResponse.json(
      { message: "ההסכם הזה כבר נחתם, ואי אפשר לשנות את מיקום החתימה." },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "מיקום החתימה לא התקבל. נסי לסמן שוב." }, { status: 400 });
  }

  const target = parseSignatureTarget(body, metadata.pageCount ?? 0);
  if (!target) {
    return NextResponse.json({ message: "מיקום החתימה לא תקין. נסי לסמן שוב." }, { status: 400 });
  }

  // The client may not decide the provenance; anything saved here is the owner's.
  const saved = { ...target, source: "owner" as const };
  await updateMetadata(id, { signatureTarget: saved });

  return NextResponse.json({ ok: true, signatureTarget: saved });
}
