'use client';

import React, { useState, useMemo } from 'react';
import { PartTimeJob, parsePartTimeJobs } from '../lib/bank-utils';

interface AdminPartTimeTabProps {
  supabase: any;
  users: any[];
  transactions: any[];
  systemConfigs: Record<string, string>;
  loadData: () => Promise<void> | void;
  showAlert: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  openConfirm: (opts: {
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
  }) => void;
}

const PT_TEMPLATES = [
  { title: '칠판·교실 정리 도우미', desc: '수업 종료 후 칠판 지우기 및 책상 줄 맞추기', pay: 30, slots: 2 },
  { title: '유인물 배부·심부름 지원', desc: '가정통신문·학습지 배부 및 교무실 전달 보조', pay: 20, slots: 2 },
  { title: '분리배출·환경 점검원', desc: '종례 전 분리수거함 정리 및 교실 환경 점검', pay: 30, slots: 2 },
  { title: '학급문고·도서 정리', desc: '학급 문고 책 정돈 및 반납 도서 분류', pay: 25, slots: 1 },
  { title: '학습 멘토(친구 도우미)', desc: '과제·학습 어려워하는 친구 1:1 도우미 활동', pay: 40, slots: 2 },
];

export default function AdminPartTimeTab({
  supabase,
  users,
  transactions,
  systemConfigs,
  loadData,
  showAlert,
  openConfirm,
}: AdminPartTimeTabProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [pay, setPay] = useState('30');
  const [slots, setSlots] = useState('2');
  const [autoRepay, setAutoRepay] = useState(true);
  const [visibility, setVisibility] = useState<'low_liquidity' | 'selected' | 'public'>('low_liquidity');
  const [maxCash, setMaxCash] = useState('50');
  const [includeLoan, setIncludeLoan] = useState(true);
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const jobs = useMemo(() => parsePartTimeJobs(systemConfigs.part_time_jobs), [systemConfigs.part_time_jobs]);

  const approvedStudents = useMemo(
    () => users.filter((u) => u && u.status === 'Approved'),
    [users]
  );

  const cashByUser = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      if (!t || !t.name) return;
      if (t.status === 'Rejected' || t.status === 'Rejected_W') return;
      if (t.status === 'Pending' && Number(t.amount) > 0) return;
      map.set(t.name, (map.get(t.name) || 0) + Number(t.amount || 0));
    });
    return map;
  }, [transactions]);

  const lowLiquidityStudents = useMemo(() => {
    return approvedStudents
      .map((u) => ({
        name: u.name,
        cash: cashByUser.get(u.name) || 0,
        loan: Number(u.loan_balance || 0),
      }))
      .filter((s) => s.cash < 50 || s.loan > 0);
  }, [approvedStudents, cashByUser]);

  const saveJobs = async (nextJobs: PartTimeJob[]) => {
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: 'part_time_jobs', value: JSON.stringify(nextJobs) }, { onConflict: 'key' });
    if (error) throw error;
    await loadData();
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showAlert('⚠️ 아르바이트 제목을 입력해주세요.', 'warning');
      return;
    }
    const numPay = Math.max(5, Number(pay) || 30);
    const numSlots = Math.max(1, Number(slots) || 1);
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    const newJob: PartTimeJob = {
      id: `PT${Date.now()}`,
      title: title.trim(),
      desc: desc.trim(),
      pay: numPay,
      slots: numSlots,
      visibility,
      max_cash: Math.max(0, Number(maxCash) || 50),
      include_loan: includeLoan,
      allowed_users:
        visibility === 'selected'
          ? allowedUsers
          : lowLiquidityStudents.map((s) => s.name),
      auto_repay: autoRepay,
      status: 'Open',
      created_at: nowStr,
      applicants: [],
    };

    setBusy(true);
    try {
      await saveJobs([newJob, ...jobs]);
      setTitle('');
      setDesc('');
      showAlert(`📢 [${newJob.title}] 아르바이트 공고가 등록되었습니다.`, 'success');
    } catch {
      showAlert('❌ 공고 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePayApplicant = async (job: PartTimeJob, studentName: string) => {
    setBusy(true);
    try {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const targetUser = approvedStudents.find((u) => u.name === studentName);
      const currentLoan = Number(targetUser?.loan_balance || 0);
      const payAmt = Number(job.pay || 0);

      let repayAmt = 0;
      let cashAmt = payAmt;
      if (job.auto_repay && currentLoan > 0) {
        repayAmt = Math.min(currentLoan, payAmt);
        cashAmt = payAmt - repayAmt;
      }

      const txRows: any[] = [
        {
          date: nowStr,
          name: '국고(중앙은행)',
          type: '알바 급여 지급',
          amount: -payAmt,
          note: `${studentName} · ${job.title}`,
          status: 'Success',
        },
      ];

      if (cashAmt > 0) {
        txRows.push({
          date: nowStr,
          name: studentName,
          type: '아르바이트 급여',
          amount: cashAmt,
          note: repayAmt > 0 ? `${job.title} (대출 ${repayAmt}안 자동 상환 후 잔액)` : job.title,
          status: 'Success',
        });
      }

      if (repayAmt > 0) {
        txRows.push({
          date: nowStr,
          name: studentName,
          type: '알바 급여 대출상환',
          amount: 0,
          note: `${job.title} 급여로 대출 ${repayAmt}안 우선 상환`,
          status: 'Success',
        });
        await supabase
          .from('users')
          .update({ loan_balance: Math.max(0, currentLoan - repayAmt) })
          .eq('name', studentName);
      }

      await supabase.from('transactions').insert(txRows);

      const nextJobs = jobs.map((j) =>
        j.id !== job.id
          ? j
          : {
              ...j,
              applicants: j.applicants.map((a) =>
                a.name === studentName ? { ...a, status: 'Paid' as const, paid_at: nowStr } : a
              ),
            }
      );
      await saveJobs(nextJobs);

      showAlert(
        repayAmt > 0
          ? `✅ ${studentName} 대원 급여 ${payAmt}안 지급 완료! (대출 ${repayAmt}안 자동 상환, 현금 +${cashAmt}안)`
          : `✅ ${studentName} 대원에게 알바 급여 ${payAmt}안 지급 완료!`,
        'success'
      );
    } catch {
      showAlert('❌ 급여 지급 중 오류가 발생했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectApplicant = async (job: PartTimeJob, studentName: string) => {
    setBusy(true);
    try {
      const nextJobs = jobs.map((j) =>
        j.id !== job.id
          ? j
          : {
              ...j,
              applicants: j.applicants.map((a) =>
                a.name === studentName ? { ...a, status: 'Rejected' as const } : a
              ),
            }
      );
      await saveJobs(nextJobs);
      showAlert(`❌ ${studentName} 대원 지원을 반려했습니다.`, 'info');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleJobStatus = async (job: PartTimeJob) => {
    setBusy(true);
    try {
      const nextStatus: 'Open' | 'Closed' = job.status === 'Open' ? 'Closed' : 'Open';
      const nextJobs = jobs.map((j) => (j.id === job.id ? { ...j, status: nextStatus } : j));
      await saveJobs(nextJobs);
      showAlert(nextStatus === 'Closed' ? '🔒 공고를 마감했습니다.' : '🟢 공고를 다시 열었습니다.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteJob = (job: PartTimeJob) => {
    openConfirm({
      title: '아르바이트 공고 삭제',
      message: `[${job.title}] 공고를 삭제하시겠습니까?`,
      confirmText: '삭제하기',
      variant: 'danger',
      onConfirm: async () => {
        setBusy(true);
        try {
          await saveJobs(jobs.filter((j) => j.id !== job.id));
          showAlert('🗑️ 공고가 삭제되었습니다.', 'info');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* 저유동성 / 대출 보유 학생 추천 */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <h3 className="font-bold text-sm text-amber-400">💼 학급 아르바이트 관리 (저유동성·대출 상환 지원)</h3>
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-slate-300">
          {lowLiquidityStudents.length > 0 ? (
            <p>
              💡 현재 현금 50안 미만 또는 대출 보유 대원 <b className="text-amber-300">{lowLiquidityStudents.length}명</b>:{' '}
              {lowLiquidityStudents
                .slice(0, 6)
                .map((s) => `${s.name}(현금 ${s.cash}/대출 ${s.loan})`)
                .join(', ')}
              {lowLiquidityStudents.length > 6 ? ` 외 ${lowLiquidityStudents.length - 6}명` : ''}
            </p>
          ) : (
            <p className="text-slate-400">💡 현재 현금 50안 미만 또는 대출 보유 대원이 없습니다.</p>
          )}
        </div>

        {/* 빠른 템플릿 */}
        <div className="flex flex-wrap gap-1.5">
          {PT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.title}
              type="button"
              onClick={() => {
                setTitle(tpl.title);
                setDesc(tpl.desc);
                setPay(String(tpl.pay));
                setSlots(String(tpl.slots));
              }}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-300 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
            >
              ⚡ {tpl.title} ({tpl.pay}안)
            </button>
          ))}
        </div>
      </div>

      {/* 새 공고 등록 */}
      <form onSubmit={handleCreateJob} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 text-xs">
        <h4 className="font-bold text-sm text-indigo-400">📝 새 아르바이트 공고 올리기</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            placeholder="아르바이트 제목 (예: 칠판·교실 정리 도우미)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="업무 내용 설명"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-center">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">급여 (안)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">모집 인원</label>
            <input
              type="number"
              min={1}
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-white"
            />
          </div>
          <label className="flex items-center gap-2 pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRepay}
              onChange={(e) => setAutoRepay(e.target.checked)}
              className="rounded"
            />
            <span className="font-bold text-slate-200">💳 대출 우선 상환</span>
          </label>
        </div>

        <div className="space-y-2 pt-1">
          <label className="text-[11px] text-slate-400 block">공고 열람/지원 권한</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'low_liquidity', label: '저유동성·대출자 자동' },
              { id: 'selected', label: '선택 학생 지정' },
              { id: 'public', label: '전체 공개' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVisibility(opt.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold border transition ${
                  visibility === opt.id
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {visibility === 'low_liquidity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">자동 기준 현금 이하(안)</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={maxCash}
                  onChange={(e) => setMaxCash(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg font-bold"
                />
              </div>
              <label className="flex items-center gap-2 pt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLoan}
                  onChange={(e) => setIncludeLoan(e.target.checked)}
                />
                <span>대출 잔액 보유 학생 자동 포함</span>
              </label>
            </div>
          )}

          {visibility === 'selected' && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {approvedStudents.map((u) => {
                const checked = allowedUsers.includes(u.name);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setAllowedUsers((prev) =>
                        checked ? prev.filter((n) => n !== u.name) : [...prev, u.name]
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold border text-[11px] ${
                      checked
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition disabled:opacity-50"
        >
          📢 아르바이트 공고 등록
        </button>
      </form>

      {/* 등록된 공고 및 지원자 관리 */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 text-xs">
        <h4 className="font-bold text-sm text-emerald-400">📋 등록된 공고 및 지원자 관리 ({jobs.length}건)</h4>
        {jobs.length === 0 ? (
          <p className="text-slate-500 py-4 text-center">등록된 아르바이트 공고가 없습니다.</p>
        ) : (
          jobs.map((job) => {
            const activeCount = (job.applicants || []).filter((a) => a.status !== 'Rejected').length;
            return (
              <div key={job.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.status === 'Open' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                        {job.status === 'Open' ? '모집중' : '마감'}
                      </span>
                      <span className="font-bold text-sm text-white">{job.title}</span>
                      <span className="text-yellow-300 font-black">{job.pay.toLocaleString()}안</span>
                    </div>
                    {job.desc && <p className="text-slate-400 mt-1">{job.desc}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">
                      모집 {activeCount}/{job.slots}명 · {job.auto_repay ? '💳 대출 우선 상환' : '현금 직접 지급'} · {job.created_at}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleJobStatus(job)}
                      className="bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg font-bold"
                    >
                      {job.status === 'Open' ? '마감하기' : '다시열기'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteJob(job)}
                      className="bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 px-2.5 py-1.5 rounded-lg font-bold"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {job.applicants && job.applicants.length > 0 && (
                  <div className="border-t border-slate-800 pt-2.5 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-400">지원자 목록</p>
                    {job.applicants.map((app) => (
                      <div key={app.name} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                        <div>
                          <span className="font-bold text-white">{app.name}</span>
                          <span className="text-[10px] text-slate-500 ml-2">{app.applied_at}</span>
                        </div>
                        {app.status === 'Pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handlePayApplicant(job, app.name)}
                              className="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-lg font-bold"
                            >
                              승인 및 지급
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRejectApplicant(job, app.name)}
                              className="bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg font-bold"
                            >
                              거절
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-bold ${app.status === 'Paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {app.status === 'Paid' ? '✅ 지급 완료' : '❌ 반려됨'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
