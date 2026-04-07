// src/types/index.ts

export type ClientType = 'FRESHER' | 'MID_CAREER' | 'EXECUTIVE' | 'EXECUTIVE_PLUS';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface ClientTypePricing {
  resume: number;
  linkedin: number;
  coverLetter: number;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export interface CountryCurrencyMap {
  [country: string]: CurrencyInfo;
}

export interface InvoiceFormData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  country: string;
  clientType: ClientType;
  currency?: string; // optional override
  selectedServices: {
    resume: boolean;
    linkedin: boolean;
    coverLetter: boolean;
  };
}

export interface InvoiceLineItem {
  service: string;
  descriptionKey: string;
  baseInr: number;
  converted: number;
  isFree?: boolean;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientType: ClientType;
  country: string;
  currency: string;
  currencySymbol: string;
  exchangeRate: number;
  resumeBaseInr: number;
  linkedinBaseInr: number;
  coverLetterBaseInr: number;
  resumeConverted: number;
  linkedinConverted: number;
  coverLetterConverted: number;
  subtotalConverted: number;
  processingFeeRate: number;
  processingFeeConverted: number;
  totalPayable: number;
  status: InvoiceStatus;
  razorpayLinkId: string | null;
  razorpayLinkUrl: string | null;
  razorpayPaymentId: string | null;
  paidAt: Date | null;
  invoiceDate: Date;
  dueDate: Date;
  emailSentAt: Date | null;
  emailResendCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingCalculation {
  resumeBaseInr: number;
  linkedinBaseInr: number;
  coverLetterBaseInr: number;
  resumeConverted: number;
  linkedinConverted: number;
  coverLetterConverted: number;
  subtotalInr: number;
  subtotalConverted: number;
  processingFeeRate: number;
  processingFeeConverted: number;
  totalPayable: number;
  exchangeRate: number;
}

export interface RazorpayPaymentLinkResponse {
  id: string;
  short_url: string;
  amount: number;
  currency: string;
  status: string;
}

export interface DashboardStats {
  totalInvoices: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalRevenue: { [currency: string]: number };
}
