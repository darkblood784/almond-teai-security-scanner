import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import ProjectVerificationView from '@/components/ProjectVerificationView';

export const dynamic = 'force-dynamic';

async function getPublicProject(slug: string) {
  return prisma.project.findUnique({
    where: { publicSlug: slug },
    include: {
      latestScan: {
        include: {
          vulnerabilities: true,
        },
      },
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          _count: { select: { vulnerabilities: true } },
        },
      },
    },
  });
}

export default async function ProjectVerificationPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = await getPublicProject(params.slug);

  if (!project || project.visibility !== 'public' || !project.latestScan) {
    notFound();
  }

  const latestScan = project.latestScan;
  return <ProjectVerificationView project={{ ...project, latestScan }} />;
}
