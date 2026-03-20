export type PlanName = 'free' | 'pro';

export interface PlanEntitlements {
  publicVerification: boolean;
  cleanPdf: boolean;
  trustBadge: boolean;
  certificateExport: boolean;
  continuousMonitoring: boolean;
  fixSuggestions: boolean;
  monthlyScanLimit: number;
  monitoringProjectLimit: number;
}

const PLAN_MATRIX: Record<PlanName, PlanEntitlements> = {
  free: {
    publicVerification: true,
    cleanPdf: false,
    trustBadge: false,
    certificateExport: false,
    continuousMonitoring: false,
    fixSuggestions: false,
    monthlyScanLimit: 10,
    monitoringProjectLimit: 0,
  },
  pro: {
    publicVerification: true,
    cleanPdf: true,
    trustBadge: true,
    certificateExport: true,
    continuousMonitoring: true,
    fixSuggestions: true,
    monthlyScanLimit: 50,
    monitoringProjectLimit: 10,
  },
};

export function normalizePlan(plan: string | null | undefined): PlanName {
  return plan === 'pro' ? 'pro' : 'free';
}

export function getPlanEntitlements(plan: string | null | undefined): PlanEntitlements {
  return PLAN_MATRIX[normalizePlan(plan)];
}
