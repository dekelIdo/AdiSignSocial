import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createContractId, MAX_PDF_BYTES, saveOriginalPdf } from "@/lib/contracts";
import { sanitizeClientName } from "@/lib/filenames";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const clientName = sanitizeClientName(formData.get("clientName"));

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "לא נבחר קובץ. בחרי את ההסכם ונסי שוב." }, { status: 400 });
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json({ message: "אפשר להעלות כאן רק קובץ PDF." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ message: "הקובץ גדול מדי. אפשר להעלות PDF עד 60MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Validate up front that the document can be signed later, and remember
    // the page count so the signing request can be checked without re-parsing.
    let pageCount: number;
    try {
      const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pageCount = document.getPageCount();
    } catch (parseError) {
      console.error("Uploaded PDF could not be parsed", {
        fileName: file.name,
        error: parseError instanceof Error ? parseError.message : parseError,
      });
      return NextResponse.json(
        { message: "לא הצלחנו לקרוא את הקובץ. כדאי לייצא אותו מחדש כ-PDF ולנסות שוב." },
        { status: 400 },
      );
    }

    if (pageCount < 1) {
      return NextResponse.json({ message: "הקובץ ריק. בחרי הסכם עם לפחות עמוד אחד." }, { status: 400 });
    }

    const id = createContractId();
    await saveOriginalPdf(id, bytes, {
      originalName: file.name || "contract.pdf",
      clientName: clientName || undefined,
      pageCount,
    });

    return NextResponse.json({
      id,
      signUrl: `/sign/${id}`,
      clientName,
      pageCount,
    });
  } catch (error) {
    console.error("Contract upload failed", {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { message: "לא הצלחנו לשמור את ההסכם. נסי שוב בעוד רגע." },
      { status: 500 },
    );
  }
}
