import type { Metadata } from "next";
import { SigningFlow } from "@/components/signing/SigningFlow";
import { MissingLinkScreen } from "@/components/signing/StatusScreens";
import { findMetadata } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type SignPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "הסכם העבודה שלך לחתימה",
  description: "כמה רגעים: קוראים, חותמים עם האצבע, ומסיימים.",
};

export default async function SignPage({ params }: SignPageProps) {
  const { id } = await params;
  const contract = await findMetadata(id);

  if (!contract) {
    return <MissingLinkScreen />;
  }

  return (
    <SigningFlow
      contractId={id}
      clientName={contract.clientName}
      signatureTarget={contract.signatureTarget ?? null}
    />
  );
}
