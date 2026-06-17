import { NextResponse } from 'next/server';

// This endpoint has been permanently disabled for security reasons.
// It previously exposed the database schema without authentication.
export async function GET() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}