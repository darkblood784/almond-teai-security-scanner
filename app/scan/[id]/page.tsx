import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import ScanReportView from '@/components/ScanReportView';

export const dynamic = 'force-dynamic';

async function getScan(id: string) {
  return prisma.scan.findUnique({
    where:   { id },
    include: {
      vulnerabilities: { orderBy: { severity: 'asc' } },
      project: {
        select: {
          id: true,
          visibility: true,
          badgeEligible: true,
          monitoringEnabled: true,
          publicSlug: true,
        },
      },
    },
  });
}

export default async function ScanPage({ params }: { params: { id: string } }) {
  const scan = await getScan(params.id);
  if (!scan) notFound();
  return <ScanReportView scan={scan} />;
}
