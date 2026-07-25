import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export type ContractMetadata = {
  id: string;
  originalName: string;
  uploadedAt: string;
  signedAt?: string;
  emailSentAt?: string;
  emailErrorAt?: string;
};

const dataRoot = path.join(process.cwd(), ".data", "contracts");

export function createContractId() {
  return randomBytes(9).toString("base64url");
}

export function getContractDir(id: string) {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) {
    throw new Error("Invalid contract id");
  }

  return path.join(dataRoot, id);
}

export async function ensureContractDir(id: string) {
  const contractDir = getContractDir(id);
  await mkdir(contractDir, { recursive: true });
  return contractDir;
}

export async function saveOriginalPdf(id: string, fileName: string, bytes: Buffer) {
  const contractDir = await ensureContractDir(id);
  const metadata: ContractMetadata = {
    id,
    originalName: fileName,
    uploadedAt: new Date().toISOString(),
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

export async function writeMetadata(id: string, metadata: ContractMetadata) {
  await writeFile(
    path.join(await ensureContractDir(id), "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );
}
