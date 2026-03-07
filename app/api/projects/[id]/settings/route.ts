import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const INTERNAL_ADMIN_TOKEN = process.env.INTERNAL_ADMIN_TOKEN;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!INTERNAL_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'INTERNAL_ADMIN_TOKEN is not configured.' }, { status: 500 });
  }

  const body = await req.json() as {
    token?: string;
    visibility?: string;
    badgeEligible?: boolean;
    monitoringEnabled?: boolean;
  };

  if (body.token !== INTERNAL_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Invalid internal admin token.' }, { status: 403 });
  }

  if (body.visibility !== 'private' && body.visibility !== 'public') {
    return NextResponse.json({ error: 'Invalid visibility value.' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      visibility: body.visibility,
      badgeEligible: Boolean(body.badgeEligible),
      monitoringEnabled: Boolean(body.monitoringEnabled),
    },
    select: {
      id: true,
      visibility: true,
      badgeEligible: true,
      monitoringEnabled: true,
      publicSlug: true,
    },
  });

  return NextResponse.json(updated);
}
