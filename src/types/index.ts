// src/types/index.ts

export type ClientType    = 'FRESHER' | 'MID_CAREER' | 'EXECUTIVE' | 'EXECUTIVE_PLUS';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

// ─── Line Item ─────────────────────────────────────────────────
export interface LineItem {
  id:          string;
  description: string;
  qty:         number;
  unitPrice:   number;   // in client's display currency
  lineTotal:   number;   // qty × unitPrice (computed)
}

// ─── Pricing calculation result ────────────────────────────────
export interface ClientTypePricing {
  resume:      number;
  linkedin:    number;
  coverLetter: number;
}

export interface CurrencyInfo {
  code:   string;
  symbol: string;
  name:   string;
}

export interface CountryCurrencyMap {
  [country: string]: CurrencyInfo;
}

// ─── Invoice form input ────────────────────────────────────────
export interface InvoiceFormData {
  clientName:    string;
  clientEmail:   string;
  clientPhone:   string;
  companyName?:  string;
  country:       string;
  clientType:    ClientType;
  currency?:     string;
  lineItems:     LineItem[];
  discountRate:  number;
  taxRate:       number;
  notes?:        string;
  dueDays?:      number;
}

export interface InvoiceLineItem {
  service:        string;
  descriptionKey: string;
  baseInr:        number;
  converted:      number;
  isFree?:        boolean;
}

// ─── Full Invoice (from DB) ────────────────────────────────────
export interface InvoiceData {
  id:            string;
  invoiceNumber: string;

  // Client
  clientName:   string;
  clientEmail:  string;
  clientPhone:  string;
  clientType:   ClientType;
  country:      string;
  companyName:  string | null;

  // Currency
  currency:       string;
  currencySymbol: string;
  exchangeRate:   number;

  // Line items (new model)
  lineItems:     LineItem[];

  // Invoice-level adjustments
  discountRate:   number;
  taxRate:        number;
  discountAmount: number;
  taxAmount:      number;

  // Legacy service fields
  resumeBaseInr:        number;
  linkedinBaseInr:      number;
  coverLetterBaseInr:   number;
  resumeConverted:      number;
  linkedinConverted:    number;
  coverLetterConverted: number;

  // Totals
  subtotalConverted:      number;
  processingFeeRate:      number;
  processingFeeConverted: number;
  totalPayable:           number;

  // Revisions
  revisionCount:  number;
  revisionCharge: number;

  // Meta
  notes:         string | null;
  customPricing: boolean;

  // Payment
  status:            InvoiceStatus;
  razorpayLinkId:    string | null;
  razorpayLinkUrl:   string | null;
  razorpayPaymentId: string | null;
  paidAt:            Date | null;

  // Dates
  invoiceDate: Date;
  dueDate:     Date;

  // Email
  emailSentAt:      Date | null;
  emailResendCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Pricing calculation ───────────────────────────────────────
export interface PricingCalculation {
  resumeBaseInr:        number;
  linkedinBaseInr:      number;
  coverLetterBaseInr:   number;
  resumeConverted:      number;
  linkedinConverted:    number;
  coverLetterConverted: number;
  subtotalInr:          number;
  subtotalConverted:    number;
  processingFeeRate:    number;
  processingFeeConverted: number;
  totalPayable:         number;
  exchangeRate:         number;
}

export interface RazorpayPaymentLinkResponse {
  id:        string;
  short_url: string;
  amount:    number;
  currency:  string;
  status:    string;
}

export interface DashboardStats {
  totalInvoices:  number;
  pendingInvoices: number;
  paidInvoices:   number;
  totalRevenue:   { [currency: string]: number };
}
