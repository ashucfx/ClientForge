// src/lib/validateFile.ts
// Server-side file content validation using magic bytes.
// Validates actual file content — not the client-declared Content-Type.

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Magic byte signatures for each allowed MIME type.
// DOCX / DOC are ZIP-based (PK\x03\x04) — we accept both since
// distinguishing DOCX from DOC by magic bytes alone requires reading the ZIP
// central directory, which is impractical here.
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF.... (webp check below)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // DOCX / DOC both start with PK zip header
  { mime: 'application/zip-office', bytes: [0x50, 0x4B, 0x03, 0x04] },
  // Legacy DOC (Compound Document)
  { mime: 'application/msword', bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] },
];

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

function matchesSignature(header: Uint8Array, sig: number[], offset = 0): boolean {
  if (header.length < offset + sig.length) return false;
  return sig.every((b, i) => header[offset + i] === b);
}

export async function validateFileContent(
  file: File,
  declaredMime: string,
): Promise<ValidationResult> {
  if (!ALLOWED_MIMES.has(declaredMime)) {
    return { valid: false, reason: 'File type not allowed' };
  }

  // Read the first 16 bytes for magic byte check
  const slice = file.slice(0, 16);
  const buf   = await slice.arrayBuffer();
  const header = new Uint8Array(buf);

  // JPEG
  if (declaredMime === 'image/jpeg') {
    if (!matchesSignature(header, [0xFF, 0xD8, 0xFF])) {
      return { valid: false, reason: 'File content does not match JPEG format' };
    }
    return { valid: true };
  }

  // PNG
  if (declaredMime === 'image/png') {
    if (!matchesSignature(header, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
      return { valid: false, reason: 'File content does not match PNG format' };
    }
    return { valid: true };
  }

  // WEBP — RIFF at 0, WEBP at offset 8
  if (declaredMime === 'image/webp') {
    const isRiff = matchesSignature(header, [0x52, 0x49, 0x46, 0x46]);
    const isWebP = header.length >= 12 &&
      header[8] === 0x57 && header[9] === 0x45 &&
      header[10] === 0x42 && header[11] === 0x50;
    if (!isRiff || !isWebP) {
      return { valid: false, reason: 'File content does not match WEBP format' };
    }
    return { valid: true };
  }

  // PDF
  if (declaredMime === 'application/pdf') {
    if (!matchesSignature(header, [0x25, 0x50, 0x44, 0x46])) {
      return { valid: false, reason: 'File content does not match PDF format' };
    }
    return { valid: true };
  }

  // DOCX — ZIP-based PK header
  if (declaredMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!matchesSignature(header, [0x50, 0x4B, 0x03, 0x04])) {
      return { valid: false, reason: 'File content does not match DOCX format' };
    }
    return { valid: true };
  }

  // DOC — Compound Document header
  if (declaredMime === 'application/msword') {
    const isDoc = matchesSignature(header, [0xD0, 0xCF, 0x11, 0xE0]);
    // Also allow DOCX accidentally sent as msword
    const isZip = matchesSignature(header, [0x50, 0x4B, 0x03, 0x04]);
    if (!isDoc && !isZip) {
      return { valid: false, reason: 'File content does not match DOC format' };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'Unrecognised file type' };
}
