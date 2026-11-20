export type Lang = 'ko' | 'ru';

export function tr(lang: Lang, koText: string, ruText: string): string {
  return lang === 'ru' ? ruText : koText;
}

export function getCreditTier(balance: number, lang: Lang = 'ko'): string {
  if (balance >= 1000) return tr(lang, '👑 은하 대부호', '👑 Галактический магнат');
  if (balance >= 500) return tr(lang, '🚀 행성 개척자', '🚀 Первопроходец');
  return tr(lang, '👨‍🚀 우주 시민', '👨‍🚀 Гражданин космоса');
}

export interface PartTimeApplicant {
  name: string;
  applied_at: string;
  status: 'Pending' | 'Paid' | 'Rejected';
  paid_at?: string;
}

export interface PartTimeJob {
  id: string;
  title: string;
  desc: string;
  pay: number;
  slots: number;
  visibility: 'low_liquidity' | 'selected' | 'public';
  max_cash: number;
  include_loan: boolean;
  allowed_users: string[];
  auto_repay: boolean;
  status: 'Open' | 'Closed';
  created_at: string;
  applicants: PartTimeApplicant[];
}

export function parsePartTimeJobs(rawValue?: string | null): PartTimeJob[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function canViewPartTimeJob(
  job: PartTimeJob,
  userName: string,
  userCash: number,
  userLoan: number
): boolean {
  if (job.applicants?.some((a) => a.name === userName)) return true;
  if (job.visibility === 'public') return true;
  if (job.visibility === 'selected') {
    return Array.isArray(job.allowed_users) && job.allowed_users.includes(userName);
  }
  // low_liquidity
  const cashOk = userCash <= Number(job.max_cash ?? 50);
  const loanOk = Boolean(job.include_loan) && userLoan > 0;
  return cashOk || loanOk;
}

export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    const blob = new Blob(['\uFEFF'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const escapeCell = (val: any) => {
    const str = val === null || val === undefined ? '' : String(val);
    const escaped = str.replace(/"/g, '""');
    return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row?.[h])).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
