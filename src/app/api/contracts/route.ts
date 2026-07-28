import { NextResponse } from "next/server";
import { createContractId, MAX_PDF_BYTES, saveOriginalPdf } from "@/lib/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Please choose a PDF contract to upload." },
        { status: 400 },
      );
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { message: "This needs to be a PDF file." },
        { status: 400 },
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { message: "Please upload a PDF up to 60MB." },
        { status: 400 },
      );
    }

    const id = createContractId();
    const bytes = Buffer.from(await file.arrayBuffer());
    await saveOriginalPdf(id, file.name || "contract.pdf", bytes);

    return NextResponse.json({
      id,
      signUrl: `/sign/${id}`,
    });
  } catch {
    return NextResponse.json(
      { message: "We could not upload this PDF. Please try again." },
      { status: 500 },
    );
  }
}
