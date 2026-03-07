/* eslint-disable @typescript-eslint/no-require-imports */
import type { Scan, Vulnerability } from '@prisma/client';

type ScanWithVulns = Scan & { vulnerabilities: Vulnerability[] };

function severityOrder(s: string) {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s.toLowerCase()] ?? 5;
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return '#ef4444';
    case 'high':     return '#f97316';
    case 'medium':   return '#eab308';
    case 'low':      return '#3b82f6';
    default:         return '#64748b';
  }
}

export async function generatePdfBuffer(scan: ScanWithVulns): Promise<Buffer> {
  // Dynamic import for pdfmake (server-side only)
  const PdfPrinter = require('pdfmake/build/pdfmake');
  const vfsFonts   = require('pdfmake/build/vfs_fonts');

  PdfPrinter.vfs = vfsFonts.pdfMake?.vfs ?? vfsFonts.vfs;

  const score     = scan.score ?? 0;
  const totalVuln = scan.vulnerabilities.length;
  const counts    = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const v of scan.vulnerabilities) counts[v.severity as keyof typeof counts]++;

  const sorted = [...scan.vulnerabilities].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity),
  );

  const vulnRows = sorted.map(v => [
    { text: v.severity.toUpperCase(), color: severityColor(v.severity), bold: true, fontSize: 9 },
    { text: v.type,         fontSize: 9 },
    { text: v.file + (v.line ? `:${v.line}` : ''), fontSize: 8, color: '#64748b' },
    { text: v.description,  fontSize: 9, wrapText: true },
  ]);

  const docDef = {
    pageSize:    'A4',
    pageMargins: [40, 60, 40, 60] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },

    content: [
      // ── Header ──
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 80, color: '#0f172a' }],
      },
      {
        columns: [
          {
            text: 'AI Code Security Scanner',
            color: '#10b981', bold: true, fontSize: 20,
            absolutePosition: { x: 50, y: 18 },
          },
          {
            text: 'SECURITY REPORT',
            color: '#94a3b8', fontSize: 10,
            absolutePosition: { x: 380, y: 25 },
          },
        ],
      },
      { text: '', margin: [0, 55, 0, 0] },

      // ── Meta ──
      {
        columns: [
          { text: [{ text: 'Repository: ', bold: true }, scan.repoName ?? scan.fileName ?? 'Uploaded Project'] },
          { text: [{ text: 'Date: ', bold: true }, new Date(scan.createdAt).toLocaleString()], alignment: 'right' },
        ],
        margin: [0, 12, 0, 4],
      },
      {
        columns: [
          { text: [{ text: 'Files Scanned: ', bold: true }, String(scan.scannedFiles)] },
          { text: [{ text: 'Lines Analyzed: ', bold: true }, scan.linesScanned.toLocaleString()], alignment: 'right' },
        ],
        margin: [0, 0, 0, 16],
      },

      // ── Score Card ──
      {
        table: {
          widths: ['*', '*', '*', '*', '*'],
          body: [
            [
              { text: `${score}/100`, fontSize: 36, bold: true, color: score >= 70 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444', alignment: 'center', border: [false,false,false,false] },
              { text: `${counts.critical}\nCRITICAL`, alignment: 'center', color: '#ef4444', bold: true, fontSize: 11, border: [false,false,false,false] },
              { text: `${counts.high}\nHIGH`,     alignment: 'center', color: '#f97316', bold: true, fontSize: 11, border: [false,false,false,false] },
              { text: `${counts.medium}\nMEDIUM`,  alignment: 'center', color: '#eab308', bold: true, fontSize: 11, border: [false,false,false,false] },
              { text: `${counts.low}\nLOW`,       alignment: 'center', color: '#3b82f6', bold: true, fontSize: 11, border: [false,false,false,false] },
            ],
            [
              { text: scoreLabel(score), alignment: 'center', color: '#64748b', fontSize: 10, border: [false,false,false,false] },
              { text: '', border: [false,false,false,false] },
              { text: '', border: [false,false,false,false] },
              { text: '', border: [false,false,false,false] },
              { text: '', border: [false,false,false,false] },
            ],
          ],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        },
        margin: [0, 0, 0, 20],
      },

      // ── Summary ──
      ...(scan.summary ? [
        { text: 'Summary', style: 'sectionHeader' },
        { text: scan.summary, margin: [0, 0, 0, 12] },
      ] : []),

      // ── AI Summary ──
      ...(scan.aiSummary ? [
        { text: 'AI Analysis', style: 'sectionHeader' },
        { text: scan.aiSummary, margin: [0, 0, 0, 12] },
      ] : []),

      // ── Vulnerabilities Table ──
      { text: `Vulnerabilities (${totalVuln})`, style: 'sectionHeader' },
      totalVuln === 0
        ? { text: '✓ No vulnerabilities found.', color: '#10b981', margin: [0, 0, 0, 12] }
        : {
            table: {
              headerRows: 1,
              widths: [55, 100, 120, '*'],
              body: [
                [
                  { text: 'Severity', bold: true, fillColor: '#0f172a', color: '#94a3b8', fontSize: 9 },
                  { text: 'Type',     bold: true, fillColor: '#0f172a', color: '#94a3b8', fontSize: 9 },
                  { text: 'Location', bold: true, fillColor: '#0f172a', color: '#94a3b8', fontSize: 9 },
                  { text: 'Description', bold: true, fillColor: '#0f172a', color: '#94a3b8', fontSize: 9 },
                ],
                ...vulnRows,
              ],
            },
            layout: {
              hLineWidth: (i: number) => (i === 0 || i === 1) ? 0 : 0.5,
              vLineWidth: () => 0,
              hLineColor: () => '#e2e8f0',
              fillColor: (row: number) => row % 2 === 0 ? '#f8fafc' : '#ffffff',
            },
            margin: [0, 0, 0, 20],
          },

      // ── Footer ──
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }] },
      {
        text: 'Generated by AI Code Security Scanner · Confidential',
        color: '#94a3b8', fontSize: 8, alignment: 'center', margin: [0, 6, 0, 0],
      },
    ],

    styles: {
      sectionHeader: {
        fontSize: 13, bold: true, color: '#0f172a',
        margin: [0, 8, 0, 6],
        decoration: 'underline',
      },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = PdfPrinter.createPdf(docDef);
      const chunks: Buffer[] = [];
      pdfDoc.getBuffer((buffer: Buffer) => resolve(buffer));
    } catch (err) {
      reject(err);
    }
  });
}
