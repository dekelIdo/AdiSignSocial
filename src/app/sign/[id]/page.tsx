import { PdfSigner } from "@/components/PdfSigner";

type SignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SignPage({ params }: SignPageProps) {
  const { id } = await params;
  return <PdfSigner contractId={id} />;
}
