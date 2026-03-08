import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generatePdfBuffer } from '@/lib/pdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scan = await prisma.scan.findUnique({
    where:   { id: params.id },
    include: {
      vulnerabilities: true,
      project: {
        select: {
          publicSlug: true,
          visibility: true,
        },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }
  if (scan.status !== 'completed') {
    return NextResponse.json({ error: 'Scan not complete yet' }, { status: 409 });
  }

  try {
    const pdf = await generatePdfBuffer(scan);
    const name = (scan.repoName ?? scan.fileName ?? 'scan').replace(/[^a-zA-Z0-9_\-]/g, '_');

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${name}-security-report.pdf"`,
        'Content-Length':      String(pdf.length),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
