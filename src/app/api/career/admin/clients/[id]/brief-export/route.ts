// src/app/api/career/admin/clients/[id]/brief-export/route.ts
// Admin-only: export a client's submitted brief (form submission) as a .docx
// for a local/offline copy. READ-ONLY — reads the existing CareerFormSubmission
// and generates a Word document on the fly. No data is written.
//
//   GET /api/career/admin/clients/:id/brief-export?formType=career_profile
//   (omit formType to export every submitted brief for the client)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { DEFAULT_FORM_SCHEMAS } from '@/lib/career/forms';
import type { FormType } from '@/lib/career/types';
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, BorderStyle,
} from 'docx';

const BRAND = '#B8935B';

function humanizeKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Render a stored value into a readable string (handles files, arrays, objects). */
function valueToText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(valueToText).filter(Boolean).join(', ') || '—';
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    // File-upload shape used by the intake forms
    if (typeof o.name === 'string') return `📎 ${o.name}`;
    return Object.entries(o).map(([k, v]) => `${humanizeKey(k)}: ${valueToText(v)}`).join('; ');
  }
  return String(value);
}

interface FieldMeta { label: string; section: string; order: number }

/** Build id -> {label, section, order} from the form schema so the doc reads well. */
function fieldMetaFor(formType: string): Record<string, FieldMeta> {
  const schema = DEFAULT_FORM_SCHEMAS[formType as FormType];
  const map: Record<string, FieldMeta> = {};
  if (!schema) return map;
  schema.fields.forEach((f, i) => {
    map[f.id] = { label: f.label ?? humanizeKey(f.id), section: f.section ?? 'Details', order: i };
  });
  return map;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = params.id;
  const formTypeFilter = req.nextUrl.searchParams.get('formType') || undefined;

  const client = await db.careerClient.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, email: true, packageType: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Latest version per formType (ordered desc; first seen per type wins).
  const submissions = await db.careerFormSubmission.findMany({
    where: { clientId, ...(formTypeFilter ? { formType: formTypeFilter } : {}) },
    orderBy: [{ formType: 'asc' }, { version: 'desc' }],
    select: { formType: true, formData: true, version: true, submittedAt: true },
  });
  if (submissions.length === 0) {
    return NextResponse.json({ error: 'No submitted brief found for this client' }, { status: 404 });
  }
  const latestByType = new Map<string, typeof submissions[number]>();
  for (const s of submissions) if (!latestByType.has(s.formType)) latestByType.set(s.formType, s);

  const children: Paragraph[] = [];

  // Document title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CATALYST', bold: true, size: 28, color: BRAND, characterSpacing: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Client Brief', size: 20, color: '888888' })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${client.name}`, bold: true, size: 24 }),
        new TextRun({ text: `   ${client.email}`, size: 18, color: '666666' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 8 } },
      children: [new TextRun({ text: client.packageType ? `Package: ${client.packageType}` : '', size: 16, color: '999999' })],
    }),
  );

  for (const [formType, sub] of latestByType) {
    const schema = DEFAULT_FORM_SCHEMAS[formType as FormType];
    const meta = fieldMetaFor(formType);
    const data = (sub.formData ?? {}) as Record<string, unknown>;

    // Form heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: schema?.title ?? humanizeKey(formType), bold: true, color: BRAND })],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: `Version ${sub.version} · Submitted ${new Date(sub.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, italics: true, size: 16, color: '999999' })],
      }),
    );

    // Order keys by the schema order; unknown keys go last.
    const keys = Object.keys(data).sort((a, b) => (meta[a]?.order ?? 999) - (meta[b]?.order ?? 999));

    let currentSection = '';
    for (const key of keys) {
      const m = meta[key];
      const section = m?.section ?? 'Additional Information';
      if (section !== currentSection) {
        currentSection = section;
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 60 },
            children: [new TextRun({ text: section, bold: true, size: 20, color: '444444' })],
          }),
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 40 },
          children: [new TextRun({ text: m?.label ?? humanizeKey(key), bold: true, size: 19 })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: valueToText(data[key]), size: 19 })],
        }),
      );
    }
  }

  const doc = new Document({
    creator: 'Catalyst',
    title: `Brief — ${client.name}`,
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = client.name.replace(/[^\w.\- ]/g, '_').trim() || 'client';
  const suffix = formTypeFilter ? `_${formTypeFilter}` : '';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Brief_${safeName}${suffix}.docx"`,
      'Cache-Control': 'no-store',
    },
  });
}
