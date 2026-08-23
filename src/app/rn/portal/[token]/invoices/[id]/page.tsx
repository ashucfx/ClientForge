import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import Link from 'next/link';
import { formatCurrency } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function BankTransferInstructionsPage({ params }: { params: { token: string, id: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token }
  });
  if (!client) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id, clientEmail: client.email }
  });
  if (!invoice || !invoice.paymentGateway?.startsWith('RAZORPAY_INTERNATIONAL_BANK_TRANSFER')) notFound();

  // Fetch the configured bank account for this currency
  const bankAccount = await prisma.internationalBankAccount.findFirst({
    where: { currency: invoice.currency, isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="portal-invoices">
      <div className="mb-6">
        <Link href={`/rn/portal/${params.token}/invoices`} className="text-[#7C5CFF] text-sm hover:underline">
          &larr; Back to Invoices
        </Link>
      </div>

      <div className="panel glass-panel">
        <div className="panel-header">
          <h2>Bank Transfer Instructions</h2>
          <p className="text-slate-500 text-sm mt-1">
            Invoice <strong>{invoice.invoiceNumber}</strong> &mdash; {formatCurrency(invoice.totalPayable, invoice.currencySymbol)} {invoice.currency}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {bankAccount ? (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl">
                <strong>Important:</strong> You must include your invoice number <code>{invoice.invoiceNumber}</code> in the payment reference or message field so we can match your payment.
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bank Name</div>
                  <div className="text-slate-800 font-medium">{bankAccount.bankName || 'N/A'}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Name</div>
                  <div className="text-slate-800 font-medium">{bankAccount.accountName}</div>
                </div>
                {bankAccount.accountNumber && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Number</div>
                    <div className="text-slate-800 font-mono font-medium">{bankAccount.accountNumber}</div>
                  </div>
                )}
                {bankAccount.routingNumber && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Routing Number (ACH/ABA)</div>
                    <div className="text-slate-800 font-mono font-medium">{bankAccount.routingNumber}</div>
                  </div>
                )}
                {bankAccount.sortCode && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sort Code</div>
                    <div className="text-slate-800 font-mono font-medium">{bankAccount.sortCode}</div>
                  </div>
                )}
                {bankAccount.iban && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">IBAN</div>
                    <div className="text-slate-800 font-mono font-medium">{bankAccount.iban}</div>
                  </div>
                )}
                {bankAccount.swiftBic && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">SWIFT / BIC</div>
                    <div className="text-slate-800 font-mono font-medium">{bankAccount.swiftBic}</div>
                  </div>
                )}
              </div>

              {bankAccount.paymentInstructions && (
                <div className="mt-8">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Additional Instructions</div>
                  <div className="bg-slate-100 p-4 rounded-xl text-slate-700 text-sm whitespace-pre-wrap">
                    {bankAccount.paymentInstructions}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              No bank account configured for {invoice.currency}. Please contact support.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
