import prisma from '@/lib/db';
import DashboardView from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

async function getStats() {
  const [scans, vulnCounts] = await Promise.all([
    prisma.scan.findMany({
      orderBy: { createdAt: 'desc' }, take: 20,
      include: { _count: { select: { vulnerabilities: true } } },
    }),
    prisma.vulnerability.groupBy({ by: ['severity'], _count: { severity: true } }),
  ]);
  return { scans, vulnCounts };
}

export default async function DashboardPage() {
  const { scans, vulnCounts } = await getStats();
  const completed = scans.filter(s => s.status === 'completed');

  const avgScore = completed.length
    ? Math.round(completed.reduce((a, s) => a + (s.score ?? 0), 0) / completed.length)
    : null;

  const critCount = vulnCounts.find(v => v.severity === 'critical')?._count.severity ?? 0;

  return <DashboardView scans={scans} avgScore={avgScore} critCount={critCount} />;
}
