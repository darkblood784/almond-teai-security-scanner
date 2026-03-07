import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const scans = await prisma.scan.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { vulnerabilities: true } } },
  });

  return NextResponse.json(scans);
}
