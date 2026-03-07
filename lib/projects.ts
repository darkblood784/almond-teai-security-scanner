import prisma from '@/lib/db';
import type { Project } from '@prisma/client';

type ProjectType = 'github' | 'website' | 'upload';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'project';
}

async function generateUniqueSlug(base: string): Promise<string> {
  const normalizedBase = slugify(base);

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${normalizedBase}${suffix}`;
    const existing = await prisma.project.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  return `${normalizedBase}-${Date.now()}`;
}

export function buildGitHubCanonicalKey(owner: string, repo: string): string {
  return `github:${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function buildWebsiteCanonicalKey(url: string): string {
  return `website:${url.toLowerCase()}`;
}

interface ResolveProjectInput {
  ownerId: string;
  projectType: ProjectType;
  canonicalKey: string;
  name: string;
  repoUrl?: string | null;
  websiteUrl?: string | null;
  sourceLabel?: string | null;
}

export async function resolveOrCreateProject(input: ResolveProjectInput): Promise<Project> {
  const existing = await prisma.project.findUnique({
    where: {
      ownerId_canonicalKey: {
        ownerId: input.ownerId,
        canonicalKey: input.canonicalKey,
      },
    },
  });

  if (existing) {
    return existing;
  }

  const slugBase = input.projectType === 'website'
    ? input.name
    : input.name.replace(/[\/\\]/g, '-');

  return prisma.project.create({
    data: {
      ownerId: input.ownerId,
      name: input.name,
      projectType: input.projectType,
      canonicalKey: input.canonicalKey,
      repoUrl: input.repoUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
      sourceLabel: input.sourceLabel ?? null,
      publicSlug: await generateUniqueSlug(slugBase),
    },
  });
}

interface CreateUploadProjectInput {
  ownerId: string;
  name: string;
  fileName?: string | null;
}

export async function createUploadProject(input: CreateUploadProjectInput): Promise<Project> {
  return prisma.project.create({
    data: {
      ownerId: input.ownerId,
      name: input.name,
      projectType: 'upload',
      canonicalKey: `upload:${crypto.randomUUID()}`,
      sourceLabel: input.fileName ?? input.name,
      publicSlug: await generateUniqueSlug(input.name),
    },
  });
}
