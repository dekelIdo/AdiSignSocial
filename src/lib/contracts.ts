import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import type { SignatureTarget } from "@/lib/signature-placement";

export const MAX_PDF_BYTES = 60 * 1024 * 1024;

export type ContractMetadata = {
  id: string;
  originalName: string;
  uploadedAt: string;
  /** Optional client name entered by the owner when creating the link. */
  clientName?: string;
  /** Page count read at upload time; used to validate the signature page. */
  pageCount?: number;
  /**
   * Where the owner wants the signature (normalized page fractions).
   * Absent on links created before this feature; those fall back to
   * label detection in the browser.
   */
  signatureTarget?: SignatureTarget;
  signedAt?: string;
  /** File name offered to the client and attached to the owner email. */
  signedFileName?: string;
  emailSentAt?: string;
  emailErrorAt?: string;
  /** Last delivery error, kept for the owner. Never shown to the client. */
  emailError?: string;
};

const dataRoot = process.env.CONTRACT_STORAGE_DIR
  ? path.resolve(process.env.CONTRACT_STORAGE_DIR)
  : path.join(process.cwd(), ".data", "contracts");

const CONTRACT_ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

/** 96 bits of randomness, URL safe. Unguessable and free of filesystem meaning. */
export function createContractId() {
  return randomBytes(12).toString("base64url");
}

export function isValidContractId(id: string) {
  return CONTRACT_ID_PATTERN.test(id);
}

export function getContractDir(id: string) {
  if (!isValidContractId(id)) {
    throw new Error("Invalid contract id");
  }

  return path.join(dataRoot, id);
}

export async function ensureContractDir(id: string) {
  const contractDir = getContractDir(id);
  await mkdir(contractDir, { recursive: true });
  return contractDir;
}

export async function saveOriginalPdf(
  id: string,
  bytes: Buffer,
  details: Pick<ContractMetadata, "originalName" | "clientName" | "pageCount">,
) {
  const contractDir = await ensureContractDir(id);
  const metadata: ContractMetadata = {
    id,
    originalName: details.originalName,
    uploadedAt: new Date().toISOString(),
    ...(details.clientName ? { clientName: details.clientName } : {}),
    ...(details.pageCount ? { pageCount: details.pageCount } : {}),
  };

  await Promise.all([
    writeFile(path.join(contractDir, "original.pdf"), bytes),
    writeMetadata(id, metadata),
  ]);

  return metadata;
}

export async function readOriginalPdf(id: string) {
  return readFile(path.join(getContractDir(id), "original.pdf"));
}

export async function readSignedPdf(id: string) {
  return readFile(path.join(getContractDir(id), "signed.pdf"));
}

export async function saveSignedPdf(id: string, bytes: Uint8Array) {
  await writeFile(path.join(await ensureContractDir(id), "signed.pdf"), bytes);
}

export async function readMetadata(id: string): Promise<ContractMetadata> {
  const raw = await readFile(path.join(getContractDir(id), "metadata.json"), "utf8");
  return JSON.parse(raw) as ContractMetadata;
}

/** Returns null instead of throwing when the link is unknown or malformed. */
export async function findMetadata(id: string): Promise<ContractMetadata | null> {
  if (!isValidContractId(id)) {
    return null;
  }

  try {
    return await readMetadata(id);
  } catch {
    return null;
  }
}

export async function writeMetadata(id: string, metadata: ContractMetadata) {
  await writeFile(
    path.join(await ensureContractDir(id), "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );
}

export async function updateMetadata(id: string, patch: Partial<ContractMetadata>) {
  const current = await readMetadata(id);
  const next = { ...current, ...patch };
  await writeMetadata(id, next);
  return next;
}
