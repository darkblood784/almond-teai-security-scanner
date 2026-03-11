import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getPlanEntitlements } from '@/lib/entitlements';
import { scanDirectory } from '@/lib/scanner/index';
import { scanUrl } from '@/lib/scanner/url-scanner';
import { downloadGitHubZip } from '@/lib/github';
import { aiAnalyze } from '@/lib/ai';
import { compareScans } from '@/lib/regression';
import { safeExtractZip } from '@/lib/safe-extract';
import { parseGitHubUrl } from '@/lib/utils';
import {
  buildGitHubCanonicalKey,
  buildWebsiteCanonicalKey,
  createUploadProject,
  resolveOrCreateProject,
} from '@/lib/projects';

export const maxDuration = 60;

async function loadScanningUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      monthlyScansUsed: true,
    },
  });
}

async function enforceAndConsumeScanCredit(userId: string) {
  const user = await loadScanningUser(userId);
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  const entitlements = getPlanEntitlements(user.plan);
  if (user.monthlyScansUsed >= entitlements.monthlyScanLimit) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Monthly scan limit reached for the ${user.plan ?? 'free'} plan.` },
        { status: 403 },
      ),
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      monthlyScansUsed: {
        increment: 1,
      },
      monthlyScanLimit: entitlements.monthlyScanLimit,
      monitoringProjectLimit: entitlements.monitoringProjectLimit,
    },
  });

  return { ok: true as const };
}

async function loadPreviousCompletedScan(projectId: string, currentScanId: string) {
  return prisma.scan.findFirst({
    where: {
      projectId,
      status: 'completed',
      id: { not: currentScanId },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      vulnerabilities: {
        select: {
          type: true,
          category: true,
          severity: true,
          file: true,
          line: true,
        },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  // ── Case: Website URL scan ─────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const rawBody = await req.json() as { url?: string; scanType?: string };

    if (rawBody.scanType === 'website') {
      if (!rawBody.url) {
        return NextResponse.json({ error: 'Missing url field' }, { status: 400 });
      }
      let normalizedUrl: string;
      try {
        const u = new URL(rawBody.url.startsWith('http') ? rawBody.url : `https://${rawBody.url}`);
        normalizedUrl = u.href;
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const creditCheck = await enforceAndConsumeScanCredit(userId);
      if (!creditCheck.ok) {
        return creditCheck.response;
      }

      const { hostname } = new URL(normalizedUrl);
      const project = await resolveOrCreateProject({
        ownerId: userId,
        projectType: 'website',
        canonicalKey: buildWebsiteCanonicalKey(normalizedUrl),
        name: hostname,
        websiteUrl: normalizedUrl,
        sourceLabel: normalizedUrl,
      });
      const scan = await prisma.scan.create({
        data: {
          projectId: project.id,
          scanType: 'website',
          websiteUrl: normalizedUrl,
          repoName: hostname,
          status: 'scanning',
        },
      });

      let result;
      try {
        result = await scanUrl(normalizedUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Website scan failed';
        await prisma.scan.update({ where: { id: scan.id }, data: { status: 'failed', errorMessage: msg } });
        return NextResponse.json({ error: msg, scanId: scan.id }, { status: 422 });
      }

      const aiResult = await aiAnalyze(hostname, result.vulnerabilities as never[], result.score);
      const previousScan = await loadPreviousCompletedScan(project.id, scan.id);
      const regression = compareScans(previousScan, {
        id: scan.id,
        score: result.score,
        vulnerabilities: result.vulnerabilities.map(v => ({
          type: v.type,
          category: v.category,
          severity: v.severity,
          file: v.file,
          line: v.line ?? null,
        })),
      });
      const completedScanData = {
        status:       'completed',
        score:        result.score,
        summary:      result.summary,
        totalFiles:   result.totalChecks,
        scannedFiles: result.passedChecks,
        filesSkipped: result.filesSkipped,
        filesSkippedBySize: result.filesSkippedBySize,
        filesSkippedByType: result.filesSkippedByType,
        linesScanned: result.probedPaths,
        dependencyAnalysisComplete: result.dependencyAnalysisComplete,
        dependencyWarning: result.dependencyWarning,
        coverageNotes: result.coverageNotes.join('\n'),
        safeVerificationOnly: result.safeVerificationOnly,
        networkChecksPartial: result.networkChecksPartial,
        aiSummary:    aiResult ? `${aiResult.summary}\n\nRemediation: ${aiResult.remediationPlan}` : null,
        previousScanId: regression.previousScanId,
        previousScore: regression.previousScore,
        scoreDelta: regression.scoreDelta,
        regressionStatus: regression.regressionStatus,
        regressionSummary: regression.regressionSummary,
        newFindingsCount: regression.newFindingsCount,
        resolvedFindingsCount: regression.resolvedFindingsCount,
        unchangedFindingsCount: regression.unchangedFindingsCount,
      } as any;

      await prisma.scan.update({
        where: { id: scan.id },
        data: completedScanData,
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { latestScanId: scan.id },
      });

      if (result.vulnerabilities.length > 0) {
        await prisma.vulnerability.createMany({
          data: result.vulnerabilities.map(v => ({
            scanId: scan.id, type: v.type, category: v.category, severity: v.severity,
            confidence: v.confidence,
            exploitability: v.exploitability,
            file: v.file, line: v.line, code: v.code,
            description: v.description, suggestion: v.suggestion,
          })),
        });
      }
      return NextResponse.json({ scanId: scan.id, score: result.score });
    }

    // ── Case: GitHub URL scan ──────────────────────────────────────────────
    const body = rawBody;
    if (!body.url) return NextResponse.json({ error: 'Missing url field' }, { status: 400 });
    const parsed = parseGitHubUrl(body.url);
    if (!parsed) return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 });

    const creditCheck = await enforceAndConsumeScanCredit(userId);
    if (!creditCheck.ok) {
      return creditCheck.response;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiss-'));
    try {
      const repoUrl  = body.url;
      const repoName = `${parsed.owner}/${parsed.repo}`;
      const project = await resolveOrCreateProject({
        ownerId: userId,
        projectType: 'github',
        canonicalKey: buildGitHubCanonicalKey(parsed.owner, parsed.repo),
        name: repoName,
        repoUrl,
        sourceLabel: repoUrl,
      });

      let zipPath: string;
      try {
        zipPath = await downloadGitHubZip(parsed.owner, parsed.repo, 'HEAD', tmpDir);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to download repository' }, { status: 422 });
      }

      let extractDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(extractDir);
      await safeExtractZip(zipPath, extractDir);
      const entries = fs.readdirSync(extractDir);
      if (entries.length === 1) { const inner = path.join(extractDir, entries[0]); if (fs.statSync(inner).isDirectory()) extractDir = inner; }

      const scan = await prisma.scan.create({
        data: { projectId: project.id, scanType: 'github', repoName, repoUrl, status: 'scanning' },
      });

      let result;
      try { result = await scanDirectory(extractDir); }
      catch (err) {
        await prisma.scan.update({ where: { id: scan.id }, data: { status: 'failed', errorMessage: String(err) } });
        return NextResponse.json({ error: 'Scanner failed', scanId: scan.id }, { status: 500 });
      }

      const aiResult = await aiAnalyze(repoName, result.vulnerabilities, result.score);
      const previousScan = await loadPreviousCompletedScan(project.id, scan.id);
      const regression = compareScans(previousScan, {
        id: scan.id,
        score: result.score,
        vulnerabilities: result.vulnerabilities.map(v => ({
          type: v.type,
          category: v.category,
          severity: v.severity,
          file: v.file,
          line: v.line ?? null,
        })),
      });
      const completedScanData = {
        status: 'completed',
        score: result.score,
        summary: result.summary,
        totalFiles: result.totalFiles,
        scannedFiles: result.scannedFiles,
        filesSkipped: result.filesSkipped,
        filesSkippedBySize: result.filesSkippedBySize,
        filesSkippedByType: result.filesSkippedByType,
        linesScanned: result.linesScanned,
        dependencyAnalysisComplete: result.dependencyAnalysisComplete,
        dependencyWarning: result.dependencyWarning,
        coverageNotes: result.coverageNotes.join('\n'),
        safeVerificationOnly: result.safeVerificationOnly,
        networkChecksPartial: result.networkChecksPartial,
        aiSummary: aiResult ? `${aiResult.summary}\n\nRemediation: ${aiResult.remediationPlan}` : null,
        previousScanId: regression.previousScanId,
        previousScore: regression.previousScore,
        scoreDelta: regression.scoreDelta,
        regressionStatus: regression.regressionStatus,
        regressionSummary: regression.regressionSummary,
        newFindingsCount: regression.newFindingsCount,
        resolvedFindingsCount: regression.resolvedFindingsCount,
        unchangedFindingsCount: regression.unchangedFindingsCount,
      } as any;
      await prisma.scan.update({
        where: { id: scan.id },
        data: completedScanData,
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { latestScanId: scan.id },
      });

      if (result.vulnerabilities.length > 0) {
        await prisma.vulnerability.createMany({
          data: result.vulnerabilities.map(v => ({
            scanId: scan.id, type: v.type, category: v.category, severity: v.severity,
            confidence: v.confidence,
            exploitability: v.exploitability,
            file: v.file, line: v.line ?? null, code: v.code ?? null,
            description: v.description, suggestion: v.suggestion,
          })),
        });
      }
      return NextResponse.json({ scanId: scan.id, score: result.score });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ── Case: ZIP file upload ──────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.zip')) return NextResponse.json({ error: 'Only .zip files are supported' }, { status: 400 });

    const creditCheck = await enforceAndConsumeScanCredit(userId);
    if (!creditCheck.ok) {
      return creditCheck.response;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiss-'));
    try {
      const fileName = file.name;
      const repoName = file.name.replace(/\.zip$/, '');
      const project = await createUploadProject({ ownerId: userId, name: repoName, fileName });
      const zipPath  = path.join(tmpDir, file.name);
      fs.writeFileSync(zipPath, Buffer.from(await file.arrayBuffer()));

      let extractDir = path.join(tmpDir, 'repo');
      fs.mkdirSync(extractDir);
      await safeExtractZip(zipPath, extractDir);
      const entries = fs.readdirSync(extractDir);
      if (entries.length === 1) { const inner = path.join(extractDir, entries[0]); if (fs.statSync(inner).isDirectory()) extractDir = inner; }

      const scan = await prisma.scan.create({
        data: { projectId: project.id, scanType: 'upload', repoName, fileName, status: 'scanning' },
      });

      let result;
      try { result = await scanDirectory(extractDir); }
      catch (err) {
        await prisma.scan.update({ where: { id: scan.id }, data: { status: 'failed', errorMessage: String(err) } });
        return NextResponse.json({ error: 'Scanner failed', scanId: scan.id }, { status: 500 });
      }

      const aiResult = await aiAnalyze(repoName, result.vulnerabilities, result.score);
      const previousScan = await loadPreviousCompletedScan(project.id, scan.id);
      const regression = compareScans(previousScan, {
        id: scan.id,
        score: result.score,
        vulnerabilities: result.vulnerabilities.map(v => ({
          type: v.type,
          category: v.category,
          severity: v.severity,
          file: v.file,
          line: v.line ?? null,
        })),
      });
      const completedScanData = {
        status: 'completed',
        score: result.score,
        summary: result.summary,
        totalFiles: result.totalFiles,
        scannedFiles: result.scannedFiles,
        filesSkipped: result.filesSkipped,
        filesSkippedBySize: result.filesSkippedBySize,
        filesSkippedByType: result.filesSkippedByType,
        linesScanned: result.linesScanned,
        dependencyAnalysisComplete: result.dependencyAnalysisComplete,
        dependencyWarning: result.dependencyWarning,
        coverageNotes: result.coverageNotes.join('\n'),
        safeVerificationOnly: result.safeVerificationOnly,
        networkChecksPartial: result.networkChecksPartial,
        aiSummary: aiResult ? `${aiResult.summary}\n\nRemediation: ${aiResult.remediationPlan}` : null,
        previousScanId: regression.previousScanId,
        previousScore: regression.previousScore,
        scoreDelta: regression.scoreDelta,
        regressionStatus: regression.regressionStatus,
        regressionSummary: regression.regressionSummary,
        newFindingsCount: regression.newFindingsCount,
        resolvedFindingsCount: regression.resolvedFindingsCount,
        unchangedFindingsCount: regression.unchangedFindingsCount,
      } as any;
      await prisma.scan.update({
        where: { id: scan.id },
        data: completedScanData,
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { latestScanId: scan.id },
      });

      if (result.vulnerabilities.length > 0) {
        await prisma.vulnerability.createMany({
          data: result.vulnerabilities.map(v => ({
            scanId: scan.id, type: v.type, category: v.category, severity: v.severity,
            confidence: v.confidence,
            exploitability: v.exploitability,
            file: v.file, line: v.line ?? null, code: v.code ?? null,
            description: v.description, suggestion: v.suggestion,
          })),
        });
      }
      return NextResponse.json({ scanId: scan.id, score: result.score });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
}
