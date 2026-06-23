// Shared human-readable labels for CareerEmailLog trigger values.
// Used in both the career client detail page and the email logs admin page.
export const TRIGGER_LABELS: Record<string, string> = {
  WELCOME:           'Welcome Email',
  FORM_CONFIRM:      'Form Confirmation',
  DRAFT_READY:       'Draft Ready',
  LINKEDIN_DRAFT:    'LinkedIn Draft Ready',
  REVISED_DRAFT:     'Revised Draft Ready',
  REVISION:          'Revision Update',
  FINAL_DELIVERY:    'Final Delivery',
  LINKEDIN_SECURITY: 'LinkedIn Security Steps',
  DELETE_OTP:        'Deletion OTP',
  LOGIN_LINK:        'Magic Link',
  MESSAGE_NOTIFY:    'Message Notification',
  GHOST_WARNING:     'Revision Window Warning',
  GHOST_CLOSURE:     'Order Finalised',
  STALE_REMINDER:    'Stale Reminder',
  DRAFT_REMINDER:    'Draft Reminder',
  KEEP_WARM:         'Keep Warm',
  UPSELL_PITCH:      'Upsell',
  REVISION_EXPIRING: 'Revision Expiring',
};
