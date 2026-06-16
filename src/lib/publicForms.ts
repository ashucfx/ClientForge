export interface PublicFormMeta {
  website?: string;
  startedAt?: number;
}

export function validatePublicFormMeta(meta: PublicFormMeta): string | null {
  if (meta.website && meta.website.trim().length > 0) {
    return 'Invalid submission';
  }

  if (typeof meta.startedAt !== 'number' || !Number.isFinite(meta.startedAt)) {
    return 'Invalid submission';
  }

  const ageMs = Date.now() - meta.startedAt;
  if (ageMs < 1500) {
    return 'Please review your details and try again.';
  }

  if (ageMs > 24 * 60 * 60 * 1000) {
    return 'Form expired. Please reload and try again.';
  }

  return null;
}
