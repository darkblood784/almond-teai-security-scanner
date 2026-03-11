import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const scans = await prisma.scan.findMany({
    where: {
      project: {
        ownerId: userId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { vulnerabilities: true } } },
  });

  return NextResponse.json(scans);
}
