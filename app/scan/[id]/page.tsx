import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import ScanReportView from '@/components/ScanReportView';

export const dynamic = 'force-dynamic';

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

export default async function ScanPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) notFound();

  const scan = await getOwnedScan(params.id, userId);
  if (!scan) notFound();
  return <ScanReportView scan={scan} />;
}
