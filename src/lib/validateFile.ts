// src/lib/validateFile.ts
// Server-side file content validation using magic bytes.
// Validates actual file content — not just the client-declared Content-Type.

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/x-png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/x-pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream',
]);

function matchesSignature(header: Uint8Array, sig: number[], offset = 0): boolean {
  if (header.length < offset + sig.length) return false;
  return sig.every((b, i) => header[offset + i] === b);
}

function deriveMimeFromExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    default:
      return null;
  }
}

export async function validateFileContent(
  file: File,
  declaredMime: string,
): Promise<ValidationResult> {
  const normalizedInputMime = declaredMime.toLowerCase().trim();

  // Handle octet-stream or non-standard MIMEs by looking at file extension
  let canonicalMime = normalizedInputMime;
  if (
    normalizedInputMime === 'application/octet-stream' ||
    normalizedInputMime === 'image/jpg' ||
    normalizedInputMime === 'image/pjpeg'
  ) {
    const derived = deriveMimeFromExtension(file.name);
    canonicalMime = derived ?? (normalizedInputMime.startsWith('image/') ? 'image/jpeg' : normalizedInputMime);
  } else if (normalizedInputMime === 'image/x-png') {
    canonicalMime = 'image/png';
  } else if (normalizedInputMime === 'application/x-pdf') {
    canonicalMime = 'application/pdf';
  }

  if (!ALLOWED_MIMES.has(normalizedInputMime) && !ALLOWED_MIMES.has(canonicalMime)) {
    return { valid: false, reason: `File type "${declaredMime}" not allowed` };
  }

  // Read the first 24 bytes for magic byte check
  const slice = file.slice(0, 24);
  const buf   = await slice.arrayBuffer();
  const header = new Uint8Array(buf);

  // JPEG
  if (canonicalMime === 'image/jpeg' || canonicalMime === 'image/jpg') {
    if (!matchesSignature(header, [0xFF, 0xD8, 0xFF])) {
      return { valid: false, reason: 'File content does not match JPEG format' };
    }
    return { valid: true };
  }

  // PNG
  if (canonicalMime === 'image/png') {
    if (!matchesSignature(header, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
      return { valid: false, reason: 'File content does not match PNG format' };
    }
    return { valid: true };
  }

  // WEBP — RIFF at 0, WEBP at offset 8
  if (canonicalMime === 'image/webp') {
    const isRiff = matchesSignature(header, [0x52, 0x49, 0x46, 0x46]);
    const isWebP = header.length >= 12 &&
      header[8] === 0x57 && header[9] === 0x45 &&
      header[10] === 0x42 && header[11] === 0x50;
    if (!isRiff || !isWebP) {
      return { valid: false, reason: 'File content does not match WEBP format' };
    }
    return { valid: true };
  }

  // GIF
  if (canonicalMime === 'image/gif') {
    const isGif87 = matchesSignature(header, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const isGif89 = matchesSignature(header, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    if (!isGif87 && !isGif89) {
      return { valid: false, reason: 'File content does not match GIF format' };
    }
    return { valid: true };
  }

  // HEIC / HEIF — check for ftyp at offset 4
  if (canonicalMime === 'image/heic' || canonicalMime === 'image/heif') {
    const isFtyp = matchesSignature(header, [0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    if (!isFtyp) {
      return { valid: false, reason: 'File content does not match HEIC/HEIF format' };
    }
    return { valid: true };
  }

  // PDF
  if (canonicalMime === 'application/pdf') {
    if (!matchesSignature(header, [0x25, 0x50, 0x44, 0x46])) {
      return { valid: false, reason: 'File content does not match PDF format' };
    }
    return { valid: true };
  }

  // DOCX — ZIP-based PK header
  if (canonicalMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!matchesSignature(header, [0x50, 0x4B, 0x03, 0x04])) {
      return { valid: false, reason: 'File content does not match DOCX format' };
    }
    return { valid: true };
  }

  // DOC — Compound Document header
  if (canonicalMime === 'application/msword') {
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

