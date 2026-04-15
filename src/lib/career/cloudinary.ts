// src/lib/career/cloudinary.ts
// Cloudinary file upload — pure HTTP, no SDK required

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY    = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const FOLDER     = 'career-booster';

export interface UploadResult {
  publicId: string;
  fileUrl: string;  // secure CDN URL
  mimeType: string;
  sizeBytes: number;
  originalName: string;
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

  const sigParams: Record<string, string> = { folder, timestamp };
  const signature = await buildSignature(sigParams);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
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
    publicId: data.public_id,
    fileUrl: data.secure_url,
    mimeType: mimeMap[data.format] ?? `${data.resource_type}/${data.format}`,
    sizeBytes: data.bytes,
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
