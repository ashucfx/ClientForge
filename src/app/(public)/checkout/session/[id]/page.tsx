import { redirect } from 'next/navigation';
import { prisma as db } from '@/lib/db';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

interface Props {
  params: { id: string };
}

export default async function CheckoutSessionPage({ params }: Props) {
  const session = await db.checkoutSession.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      paymentUrl: true,
      name: true,
      email: true,
    },
  }).catch(() => null);

  // If we have a payment URL, redirect immediately
  if (session?.paymentUrl) {
    redirect(session.paymentUrl);
  }

  // Session not found or no payment link yet
  const notFound = !session;
  const pending = session && !session.paymentUrl;

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col">
      <div className="h-[2px] w-full bg-brand-gold" />
      <header className="px-8 md:px-16 lg:px-24 py-8">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
      </header>
      <main className="flex-1 flex items-center px-8 md:px-16 lg:px-24 pb-24">
        <div className="max-w-2xl">
          {notFound ? (
            <>
              <h1 className="font-serif text-display-lg text-brand-obsidian mb-6">
                Session not found
              </h1>
              <p className="text-subheading text-brand-obsidian/60 mb-8">
                This checkout session has expired or does not exist. Please start a new checkout.
              </p>
              <Link
                href="/checkout"
                className="inline-flex items-center gap-2 bg-brand-obsidian text-brand-bone px-8 py-3.5 font-semibold uppercase tracking-widest text-sm hover:bg-brand-graphite"
              >
                Start checkout
              </Link>
            </>
          ) : pending ? (
            <>
              <h1 className="font-serif text-display-lg text-brand-obsidian mb-6">
                Preparing your payment link&hellip;
              </h1>
              <p className="text-subheading text-brand-obsidian/60 mb-8">
                Your payment link is being generated. Check your email at{' '}
                <strong>{session.email}</strong> — it will arrive within a minute.
                You can also{' '}
                <Link href="/checkout" className="text-brand-gold hover:underline">
                  start a new checkout
                </Link>
                {' '}if this takes too long.
              </p>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
