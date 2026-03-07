import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scan = await prisma.scan.findUnique({
    where:   { id: params.id },
    include: { vulnerabilities: { orderBy: [{ severity: 'asc' }, { file: 'asc' }] } },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  return NextResponse.json(scan);
}
