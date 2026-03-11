import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import DashboardView from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string) {
  const [projects, recentScans] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        projectType: true,
        visibility: true,
        badgeEligible: true,
        monitoringEnabled: true,
        publicSlug: true,
        latestScan: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            score: true,
            regressionStatus: true,
            repoName: true,
            fileName: true,
            websiteUrl: true,
            _count: {
              select: {
                vulnerabilities: true,
              },
            },
            vulnerabilities: {
              select: {
                severity: true,
              },
            },
          },
        },
      },
    }),
    prisma.scan.findMany({
      where: {
        project: {
          ownerId: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { _count: { select: { vulnerabilities: true } } },
    }),
  ]);

  const sortedProjects = [...projects].sort((a, b) => {
    const aTime = a.latestScan ? new Date(a.latestScan.createdAt).getTime() : 0;
    const bTime = b.latestScan ? new Date(b.latestScan.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const latestCompletedScans = sortedProjects
    .map(project => project.latestScan)
    .filter(scan => Boolean(scan && scan.status === 'completed' && scan.score != null));

  const avgLatestScore = latestCompletedScans.length
    ? Math.round(latestCompletedScans.reduce((sum, scan) => sum + (scan?.score ?? 0), 0) / latestCompletedScans.length)
    : null;

  const projectsWithCriticalFindings = sortedProjects.filter(project =>
    project.latestScan?.vulnerabilities.some(vulnerability => vulnerability.severity === 'critical'),
  ).length;

  const improvedProjects = sortedProjects.filter(project => project.latestScan?.regressionStatus === 'improved').length;
  const degradedProjects = sortedProjects.filter(project => project.latestScan?.regressionStatus === 'degraded').length;

  return {
    projects: sortedProjects,
    recentScans,
    stats: {
      totalProjects: sortedProjects.length,
      avgLatestScore,
      projectsWithCriticalFindings,
      improvedProjects,
      degradedProjects,
    },
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/');
  }

  const { projects, recentScans, stats } = await getDashboardData(userId);

  return <DashboardView projects={projects} recentScans={recentScans} stats={stats} />;
}
