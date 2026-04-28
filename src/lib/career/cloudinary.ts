// src/lib/career/cloudinary.ts
// Cloudinary file upload — pure HTTP, no SDK required

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY    = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const FOLDER     = 'career-booster';

export interface UploadResult {
  publicId: string;
  fileUrl: string;       // secure CDN URL
  resourceType: string;  // 'raw' | 'image' | 'video'
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

/**
 * Generate a signed Cloudinary delivery URL.
 *
 * When a Cloudinary account has "secure delivery" restrictions, unsigned URLs
 * return 401. Adding a s--{sig}-- token (signed with the API secret) authorises
 * the request without exposing the secret.
 *
 * Signing spec (from Cloudinary SDK source):
 *   to_sign  = public_id_with_format  (after stripping the version prefix)
 *   sig      = base64url(SHA-1(to_sign + API_SECRET)).slice(0, 8)
 *   url      = original_url with /upload/ replaced by /upload/s--{sig}--/
 */
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf':    'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'image/png':          'png',
  'image/jpeg':         'jpg',
  'image/gif':          'gif',
  'image/webp':         'webp',
};

/**
 * Ensure a filename has the correct extension.
 * Older DB records may have been stored without an extension (Cloudinary's
 * original_filename strips it, and raw/DOCX format was sometimes empty).
 * Derives the extension from the mimeType when missing.
 */
export function ensureExtension(filename: string, mimeType: string): string {
  const base = filename.trim().replace(/\.+$/, ''); // strip trailing dots
  if (base.includes('.')) return base;              // already has extension
  const ext = MIME_TO_EXT[mimeType];
  return ext ? `${base}.${ext}` : base;
}

/**
 * Return the URL that our server should use to fetch a Cloudinary resource.
 *
 * - Images (PNG, JPEG, GIF, WEBP, …) are publicly delivered by Cloudinary
 *   without any signing needed.
 * - PDFs and office documents have restricted delivery and require a signed URL.
 *
 * Pass the stored mimeType so we can skip unnecessary signing for images.
 */
export async function getDeliveryUrl(fileUrl: string, mimeType: string): Promise<string> {
  if (mimeType.startsWith('image/')) {
    return fileUrl; // images are public — no signing needed
  }
  return getSignedCloudinaryUrl(fileUrl);
}

/**
 * Cloudinary delivery URL signing.
 *
 * Accounts created after Jan 2024 use SHA-256 by default.
 * Older accounts use SHA-1.  Set CLOUDINARY_SIGN_ALGO=sha1 to override.
 *
 * Signing spec:
 *   to_sign = public_id_with_format  (strip version prefix, keep format extension)
 *   sig     = base64url(HASH(to_sign + API_SECRET)).slice(0, 8)
 *   url     = original_url with /upload/ → /upload/s--{sig}--/
 */
export async function getSignedCloudinaryUrl(fileUrl: string): Promise<string> {
  const uploadIdx = fileUrl.indexOf('/upload/');
  if (uploadIdx === -1) return fileUrl;

  const afterUpload = fileUrl.substring(uploadIdx + '/upload/'.length);
  // Strip version prefix (v1234567890/) — NOT part of the signing string
  const publicIdWithFormat = afterUpload.replace(/^v\d+\//, '');

  const algo  = (process.env.CLOUDINARY_SIGN_ALGO ?? 'sha256').toLowerCase();
  const webAlgo = algo === 'sha1' ? 'SHA-1' : 'SHA-256';

  const str     = publicIdWithFormat + API_SECRET;
  const bytes   = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest(webAlgo, bytes);
  const hashBytes = new Uint8Array(hashBuf);

  // base64url: replace + → - and / → _, take first 8 chars
  let binary = '';
  hashBytes.forEach(b => { binary += String.fromCharCode(b); });
  const sig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').substring(0, 8);

  return fileUrl.replace('/upload/', `/upload/s--${sig}--/`);
}

async function buildSignature(params: Record<string, string>): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const str = sorted + API_SECRET;
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadToCloudinary(
  file: File,
  clientId: string,
): Promise<UploadResult> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Cloudinary env vars not configured');
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = `${FOLDER}/${clientId}`;

  // unique_filename=true → Cloudinary appends a random suffix when a public_id
  // already exists, preventing overwrites of files with the same name.
  const sigParams: Record<string, string> = {
    folder,
    timestamp,
    unique_filename: 'true',
    use_filename:    'true',
  };
  const signature = await buildSignature(sigParams);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('use_filename', 'true');
  formData.append('unique_filename', 'true');
  formData.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? 'Cloudinary upload failed');
  }

  const data = await res.json() as {
    public_id: string;
    secure_url: string;
    resource_type: string;
    format: string;
    bytes: number;
    original_filename: string;
  };

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };

  return {
    publicId:     data.public_id,
    fileUrl:      data.secure_url,
    resourceType: data.resource_type,
    mimeType:     mimeMap[data.format] ?? `${data.resource_type}/${data.format}`,
    sizeBytes:    data.bytes,
    // Cloudinary strips extension from original_filename — re-append it
    originalName: data.original_filename
      ? `${data.original_filename}.${data.format}`
      : `file.${data.format}`,
  };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const timestamp = String(Math.floor(Date.now() / 1000));

  // Try each resource type — Cloudinary requires the correct type for deletion.
  // Files uploaded via /auto/upload may land as 'image', 'video', or 'raw'.
  for (const resourceType of ['raw', 'image', 'video']) {
    const signature = await buildSignature({ public_id: publicId, resource_type: resourceType, timestamp });
    const body = new URLSearchParams({ public_id: publicId, api_key: API_KEY, timestamp, resource_type: resourceType, signature });

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.ok) {
      const data = await res.json() as { result?: string };
      if (data.result === 'ok') return; // deleted successfully
    }
  }
}
