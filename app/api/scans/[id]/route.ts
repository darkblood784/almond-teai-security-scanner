import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';

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
    include: { vulnerabilities: { orderBy: [{ severity: 'asc' }, { file: 'asc' }] } },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  return NextResponse.json(scan);
}
