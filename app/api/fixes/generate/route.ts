import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { canGenerateFix, generateFix } from '@/lib/fix-generation';
import type { Fixability } from '@/lib/fixability';

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const allowFixesForFree = process.env.NODE_ENV !== 'production' && process.env.ALLOW_FIXES_FOR_FREE === 'true';
  const proMonthlyFixLimit = Math.max(1, Number(process.env.PRO_MONTHLY_FIX_LIMIT ?? 100));

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { vulnerabilityId?: string } | null;
  if (!body?.vulnerabilityId) {
    return NextResponse.json({ error: 'Missing vulnerabilityId' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const vulnerability = await prisma.vulnerability.findFirst({
    where: {
      id: body.vulnerabilityId,
      scan: {
        project: {
          ownerId: userId,
        },
      },
    },
    include: {
      fixSuggestion: true,
    },
  });

  if (!vulnerability) {
    return NextResponse.json({ error: 'Vulnerability not found' }, { status: 404 });
  }

  if (vulnerability.fixSuggestion) {
    return NextResponse.json({
      vulnerabilityId: vulnerability.id,
      cached: true,
      fix: vulnerability.fixSuggestion,
    });
  }

  const access = canGenerateFix(
    user.plan,
    (vulnerability.fixability as Fixability) ?? 'uncategorized',
    { allowFreeFixes: allowFixesForFree },
  );
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason ?? 'Fix generation not allowed for this finding.' }, { status: 403 });
  }

  const now = new Date();
  const usagePeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  if (user.plan === 'pro') {
    const usage = await prisma.fixSuggestionUsage.findUnique({
      where: {
        userId_period: {
          userId,
          period: usagePeriod,
        },
      },
      select: {
        totalRequests: true,
      },
    });

    if ((usage?.totalRequests ?? 0) >= proMonthlyFixLimit) {
      return NextResponse.json({
        error: `Monthly fix suggestion limit reached (${proMonthlyFixLimit}) for the Pro plan.`,
      }, { status: 429 });
    }
  }

  try {
    const fix = await generateFix({
      plan: user.plan,
      vulnerability: {
        id: vulnerability.id,
        type: vulnerability.type,
        category: vulnerability.category,
        severity: vulnerability.severity,
        description: vulnerability.description,
        suggestion: vulnerability.suggestion,
        code: vulnerability.code,
        file: vulnerability.file,
        line: vulnerability.line,
        fixability: vulnerability.fixability,
      },
    });

    const saved = await prisma.fixSuggestion.create({
      data: {
        vulnerabilityId: vulnerability.id,
        patchCode: fix.patchCode,
        description: fix.description,
        rationale: fix.rationale,
        confidence: fix.confidence,
        provider: fix.provider,
        model: fix.model,
      },
    });

    if (user.plan === 'pro') {
      await prisma.fixSuggestionUsage.upsert({
        where: {
          userId_period: {
            userId,
            period: usagePeriod,
          },
        },
        create: {
          userId,
          period: usagePeriod,
          totalRequests: 1,
          successfulRequests: 1,
          failedRequests: 0,
          lastRequestedAt: now,
        },
        update: {
          totalRequests: { increment: 1 },
          successfulRequests: { increment: 1 },
          lastRequestedAt: now,
        },
      });
    }

    return NextResponse.json({
      vulnerabilityId: vulnerability.id,
      cached: false,
      fix: saved,
    });
  } catch {
    if (user.plan === 'pro') {
      await prisma.fixSuggestionUsage.upsert({
        where: {
          userId_period: {
            userId,
            period: usagePeriod,
          },
        },
        create: {
          userId,
          period: usagePeriod,
          totalRequests: 1,
          successfulRequests: 0,
          failedRequests: 1,
          lastRequestedAt: now,
        },
        update: {
          totalRequests: { increment: 1 },
          failedRequests: { increment: 1 },
          lastRequestedAt: now,
        },
      });
    }

    return NextResponse.json({ error: 'Failed to generate fix.' }, { status: 500 });
  }
}
