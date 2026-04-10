// src/lib/career/types.ts

export type CareerPackage = 'RESUME' | 'LINKEDIN' | 'COVER_LETTER' | 'FULL';
export type CareerStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'UNDER_PROCESS'
  | 'DRAFT_SENT'
  | 'REVISION_REQUESTED'
  | 'COMPLETED';

export type EmailTrigger =
  | 'WELCOME'
  | 'FORM_CONFIRM'
  | 'DRAFT_READY'
  | 'REVISION'
  | 'FINAL_DELIVERY'
  | 'LINKEDIN_SECURITY';

export type FormType = 'resume' | 'linkedin' | 'cover_letter';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'tags' | 'file' | 'url' | 'password' | 'checkbox' | 'rating';
  placeholder?: string;
  hint?: string;       // help text shown below the label
  options?: string[];  // for select, checkbox
  required: boolean;
  accept?: string;     // for file inputs
  section?: string;    // optional section grouping for form UI
}

export interface FormSchema {
  formType: FormType;
  title: string;
  description: string;
  fields: FormField[];
  disclaimer: string;
}

export interface CareerClientSafe {
  id: string;
  name: string;
  email: string;
  packageType: CareerPackage;
  status: CareerStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DeliverablePublic {
  id: string;
  label: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  createdAt: string;
}

export const PACKAGE_LABELS: Record<CareerPackage, string> = {
  RESUME: 'Resume Writing',
  LINKEDIN: 'LinkedIn Optimisation',
  COVER_LETTER: 'Cover Letter',
  FULL: 'Full Career Package',
};

export const STATUS_LABELS: Record<CareerStatus, string> = {
  NOT_STARTED: 'Not Started',
  SUBMITTED: 'Form Submitted',
  UNDER_PROCESS: 'Under Process',
  DRAFT_SENT: 'Draft Sent',
  REVISION_REQUESTED: 'Revision Requested',
  COMPLETED: 'Completed',
};

export const STATUS_ORDER: CareerStatus[] = [
  'NOT_STARTED',
  'SUBMITTED',
  'UNDER_PROCESS',
  'DRAFT_SENT',
  'REVISION_REQUESTED',
  'COMPLETED',
];

// Which forms each package unlocks
// Cover Letter is part of the Career Information Form (resume), not a separate form
export const PACKAGE_FORMS: Record<CareerPackage, FormType[]> = {
  RESUME:       ['resume'],
  LINKEDIN:     ['linkedin'],
  COVER_LETTER: ['resume'],           // Cover letter details are inside the resume form
  FULL:         ['resume', 'linkedin'],
};
