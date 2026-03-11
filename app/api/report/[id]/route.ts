import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getPlanEntitlements } from '@/lib/entitlements';
import { generatePdfBuffer } from '@/lib/pdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const scan = await prisma.scan.findFirst({
    where: {
      id: params.id,
      project: {
        ownerId: userId,
      },
    },
    include: {
      vulnerabilities: true,
      project: {
        select: {
          publicSlug: true,
          visibility: true,
          owner: {
            select: {
              plan: true,
            },
          },
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
    const entitlements = getPlanEntitlements(scan.project?.owner?.plan);
    const pdf = await generatePdfBuffer(scan, {
      watermarked: !entitlements.cleanPdf,
    });
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
