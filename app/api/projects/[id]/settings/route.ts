import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getPlanEntitlements } from '@/lib/entitlements';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await req.json() as {
    visibility?: string;
    badgeEligible?: boolean;
    monitoringEnabled?: boolean;
  };

  if (body.visibility !== 'private' && body.visibility !== 'public') {
    return NextResponse.json({ error: 'Invalid visibility value.' }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      ownerId: userId,
    },
    select: {
      id: true,
      monitoringEnabled: true,
      owner: {
        select: {
          plan: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const entitlements = getPlanEntitlements(project.owner.plan);

  if (body.visibility === 'public' && !entitlements.publicVerification) {
    return NextResponse.json({ error: 'Your plan does not allow public verification pages.' }, { status: 403 });
  }

  if (body.badgeEligible && !entitlements.trustBadge) {
    return NextResponse.json({ error: 'Your plan does not allow trust badges.' }, { status: 403 });
  }

  if (body.monitoringEnabled && !entitlements.continuousMonitoring) {
    return NextResponse.json({ error: 'Your plan does not allow continuous monitoring.' }, { status: 403 });
  }

  if (body.monitoringEnabled && !project.monitoringEnabled) {
    const enabledMonitoringCount = await prisma.project.count({
      where: {
        ownerId: userId,
        monitoringEnabled: true,
        id: { not: params.id },
      },
    });

    if (enabledMonitoringCount >= entitlements.monitoringProjectLimit) {
      return NextResponse.json({ error: 'Monitoring project limit reached for your plan.' }, { status: 403 });
    }
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
