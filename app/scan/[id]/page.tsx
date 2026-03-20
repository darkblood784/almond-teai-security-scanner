import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import ScanReportView from '@/components/ScanReportView';

export const dynamic = 'force-dynamic';

function getUsagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getOwnedScan(id: string, ownerId: string) {
  return prisma.scan.findFirst({
    where: {
      id,
      project: {
        ownerId,
      },
    },
    include: {
      vulnerabilities: { orderBy: { severity: 'asc' } },
      project: {
        select: {
          id: true,
          visibility: true,
          badgeEligible: true,
          monitoringEnabled: true,
          publicSlug: true,
          owner: {
            select: {
              plan: true,
            },
          },
        },
      },
    },
  });
}

async function getProFixUsage(ownerId: string, plan: string | null | undefined) {
  if (plan !== 'pro') {
    return null;
  }

  const period = getUsagePeriod();
  const limit = Math.max(1, Number(process.env.PRO_MONTHLY_FIX_LIMIT ?? 100));

  const usage = await prisma.fixSuggestionUsage.findUnique({
    where: {
      userId_period: {
        userId: ownerId,
        period,
      },
    },
    select: {
      totalRequests: true,
    },
  });

  const used = usage?.totalRequests ?? 0;
  return {
    period,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export default async function ScanPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) notFound();

  const scan = await getOwnedScan(params.id, userId);
  if (!scan) notFound();
  const userPlan = scan.project?.owner?.plan ?? 'free';
  const fixUsage = await getProFixUsage(userId, userPlan);
  const allowFixesForFree = process.env.NODE_ENV !== 'production' && process.env.ALLOW_FIXES_FOR_FREE === 'true';
  return <ScanReportView scan={scan} allowFixesForFree={allowFixesForFree} fixUsage={fixUsage} />;
}
