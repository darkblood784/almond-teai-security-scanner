import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { renderTrustBadge } from '@/lib/badge';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const project = await prisma.project.findUnique({
    where: { publicSlug: params.slug },
    include: { latestScan: true },
  });

  if (!project || project.visibility !== 'public' || !project.latestScan || project.latestScan.score == null) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const svg = renderTrustBadge(project.latestScan.score, project.latestScan.createdAt);

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
