'use client';

import React, { useState, useMemo } from 'react';
import { downloadCsv } from '../lib/bank-utils';

interface AdminTreasuryTabProps {
  supabase: any;
  users: any[];
  transactions: any[];
  systemConfigs: Record<string, string>;
  treasuryBal: number;
  totalMoneySupply: number;
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

export default function AdminTreasuryTab({
  supabase,
  users,
  transactions,
  systemConfigs,
  treasuryBal,
  totalMoneySupply,
  loadData,
  showAlert,
  openConfirm,
}: AdminTreasuryTabProps) {
  const [noticeTarget, setNoticeTarget] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [budgetInput, setBudgetInput] = useState(systemConfigs.class_budget || '0');
  const [budgetSpendAmt, setBudgetSpendAmt] = useState('');
  const [budgetSpendNote, setBudgetSpendNote] = useState('');
  const [newCfgKey, setNewCfgKey] = useState('');
  const [newCfgVal, setNewCfgVal] = useState('');
  const [busy, setBusy] = useState(false);

  const approvedStudents = useMemo(
    () => users.filter((u) => u && u.status === 'Approved'),
    [users]
  );

  const fundCustodyBal = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t &&
          t.name === '국고(중앙은행)' &&
          t.status === 'Success' &&
          (t.type === '펀드 예치금' || t.type === '펀드 환매금 지급' || t.type === '펀드 환매 지급')
      )
      .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [transactions]);

  const fiscalBal = treasuryBal - fundCustodyBal;
  const avgCash = approvedStudents.length > 0 ? Math.floor(totalMoneySupply / approvedStudents.length) : 0;

  const advices = useMemo(() => {
    const list: string[] = [];
    if (fiscalBal < 0) {
      list.push(`🚨 [재정 적자 경보] 가용 국고가 ${fiscalBal.toLocaleString()}안으로 적자입니다. 상금 지급을 줄이고 임대료·세율 점검 또는 기초 국고 보충을 권장합니다.`);
    } else if (fiscalBal < 500) {
      list.push(`⚠️ [국고 여력 주의] 가용 국고가 ${fiscalBal.toLocaleString()}안으로 여유가 적습니다. 큰 규모의 국고 지출 전 잔액을 확인하세요.`);
    } else {
      list.push(`✅ [재정 안정] 가용 국고(${fiscalBal.toLocaleString()}안)가 충분하여 학급 복지나 이벤트 예산을 안정적으로 집행할 수 있습니다.`);
    }

    if (treasuryBal > 0 && totalMoneySupply > treasuryBal * 3) {
      list.push(`📈 [인플레이션 주의] 시중 통화량(${totalMoneySupply.toLocaleString()}안)이 국고 대비 높습니다. 예금·펀드·상점 소비를 유도해 유동성을 흡수하세요.`);
    } else if (approvedStudents.length > 0 && avgCash < 30) {
      list.push(`💧 [유동성 부족] 1인당 평균 현금이 ${avgCash.toLocaleString()}안입니다. 아르바이트 공고나 주급 지급으로 현금을 공급해 보세요.`);
    } else {
      list.push(`⚖️ [통화량 균형] 시중 통화량(${totalMoneySupply.toLocaleString()}안)과 1인당 평균 현금(${avgCash.toLocaleString()}안)이 안정적인 범위입니다.`);
    }
    return list;
  }, [fiscalBal, treasuryBal, totalMoneySupply, approvedStudents.length, avgCash]);

  const currentPersonalNotice = noticeTarget ? systemConfigs[`notice_${noticeTarget}`] || '' : '';

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTarget) {
      showAlert('⚠️ 쪽지 받을 학생을 선택해주세요.', 'warning');
      return;
    }
    if (!noticeText.trim()) {
      showAlert('⚠️ 보낼 쪽지 내용을 입력해주세요.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await supabase
        .from('system_config')
        .upsert({ key: `notice_${noticeTarget}`, value: noticeText.trim() }, { onConflict: 'key' });
      await loadData();
      setNoticeText('');
      showAlert(`📩 ${noticeTarget} 대원에게 개별 쪽지를 전송했습니다!`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!noticeTarget) return;
    setBusy(true);
    try {
      await supabase
        .from('system_config')
        .upsert({ key: `notice_${noticeTarget}`, value: '' }, { onConflict: 'key' });
      await loadData();
      showAlert(`🗑️ ${noticeTarget} 대원의 기존 쪽지를 회수했습니다.`, 'info');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBudget = async () => {
    setBusy(true);
    try {
      await supabase
        .from('system_config')
        .upsert({ key: 'class_budget', value: String(Number(budgetInput) || 0) }, { onConflict: 'key' });
      await loadData();
      showAlert('💳 학급운영비 예산이 저장되었습니다.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleSpendBudget = async () => {
    const amt = Number(budgetSpendAmt);
    if (isNaN(amt) || amt <= 0) {
      showAlert('⚠️ 지출 금액을 정확히 입력하세요.', 'warning');
      return;
    }
    const currBudget = Number(systemConfigs.class_budget || 0);
    setBusy(true);
    try {
      const nextBudget = currBudget - amt;
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase
        .from('system_config')
        .upsert({ key: 'class_budget', value: String(nextBudget) }, { onConflict: 'key' });
      await supabase.from('transactions').insert([
        {
          date: nowStr,
          name: '국고(중앙은행)',
          type: '학급운영비 지출',
          amount: -amt,
          note: budgetSpendNote.trim() || '학급운영비 집행',
          status: 'Success',
        },
      ]);
      await loadData();
      setBudgetInput(String(nextBudget));
      setBudgetSpendAmt('');
      setBudgetSpendNote('');
      showAlert(`💸 학급운영비 ${amt.toLocaleString()}안 지출이 기록되었습니다.`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const handlePartialReset = (target: 'transactions' | 'inventory' | 'notifications', label: string) => {
    openConfirm({
      title: `부분 초기화: ${label}`,
      message: `정말 [${label}] 데이터를 모두 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`,
      confirmText: '모두 삭제',
      variant: 'danger',
      onConfirm: async () => {
        setBusy(true);
        try {
          await supabase.from(target).delete().neq('id', -1);
          await loadData();
          showAlert(`🧹 ${label} 데이터가 초기화되었습니다.`, 'info');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleNewAcademicYear = () => {
    openConfirm({
      title: '새 학년도 시작 (전체 데이터 초기화)',
      message:
        '학생 계정, 거래내역, 가방, 알림, 상점, 펀드를 모두 삭제하고 부동산 좌석을 공실로 초기화합니다.\n정말 진행하시겠습니까?',
      confirmText: '전체 초기화 실행',
      variant: 'danger',
      onConfirm: async () => {
        setBusy(true);
        try {
          await Promise.all([
            supabase.from('transactions').delete().neq('id', -1),
            supabase.from('inventory').delete().neq('id', -1),
            supabase.from('notifications').delete().neq('id', -1),
            supabase.from('users').delete().neq('id', -1),
            supabase.from('shop_items').delete().neq('id', -1),
            supabase.from('funds').delete().neq('id', -1),
            supabase.from('real_estate').update({ owner: '', prev_price: null }).neq('seat', -1),
            supabase.from('system_config').upsert({ key: 'banker_name', value: '' }, { onConflict: 'key' }),
          ]);
          await loadData();
          showAlert('🌱 새 학년도 전체 데이터 초기화가 완료되었습니다!', 'success');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleSaveConfigEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCfgKey.trim()) {
      showAlert('⚠️ Config 키 이름을 입력하세요.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await supabase
        .from('system_config')
        .upsert({ key: newCfgKey.trim(), value: newCfgVal }, { onConflict: 'key' });
      await loadData();
      setNewCfgKey('');
      setNewCfgVal('');
      showAlert('⚙️ Config 설정이 저장되었습니다.', 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 국고 관리 센터 & 실시간 경제 브리핑 */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
        <h3 className="font-bold text-sm text-indigo-400">🏛️ 국고 관리 센터 & 경제부 장관 브리핑</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
            <p className="text-[11px] text-slate-400">가용 국고 (순수 재정)</p>
            <p className={`text-base font-black mt-1 ${fiscalBal < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {fiscalBal.toLocaleString()} 안
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
            <p className="text-[11px] text-slate-400">펀드 예치·운용 잔액</p>
            <p className="text-base font-black mt-1 text-purple-300">{fundCustodyBal.toLocaleString()} 안</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
            <p className="text-[11px] text-slate-400">총 통화량 (시중 현금)</p>
            <p className="text-base font-black mt-1 text-indigo-300">{totalMoneySupply.toLocaleString()} 안</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
            <p className="text-[11px] text-slate-400">1인당 평균 현금</p>
            <p className="text-base font-black mt-1 text-yellow-300">{avgCash.toLocaleString()} 안</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-indigo-500/30 p-4 rounded-xl space-y-1.5">
          <p className="font-bold text-indigo-300">🎩 가상 국고 비서관 실시간 경제 브리핑</p>
          {advices.map((adv, idx) => (
            <p key={idx} className="text-slate-300 leading-relaxed">
              {adv}
            </p>
          ))}
        </div>

        {/* 학급운영비 예산 */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5">
          <p className="font-bold text-amber-300">💳 학급운영비 예산 관리 (현재 잔여 예산: {Number(systemConfigs.class_budget || 0).toLocaleString()}안)</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              placeholder="예산 총액 설정"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="bg-slate-900 border border-slate-800 p-2 rounded-lg font-bold w-36"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveBudget}
              className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg font-bold"
            >
              예산 설정
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              placeholder="지출액"
              value={budgetSpendAmt}
              onChange={(e) => setBudgetSpendAmt(e.target.value)}
              className="bg-slate-900 border border-slate-800 p-2 rounded-lg font-bold w-28"
            />
            <input
              type="text"
              placeholder="지출 사유 (예: 학급 간식 구입)"
              value={budgetSpendNote}
              onChange={(e) => setBudgetSpendNote(e.target.value)}
              className="flex-1 min-w-[160px] bg-slate-900 border border-slate-800 p-2 rounded-lg font-bold"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleSpendBudget}
              className="bg-amber-600 hover:bg-amber-500 px-3 py-2 rounded-lg font-bold"
            >
              지출 집행
            </button>
          </div>
        </div>
      </div>

      {/* 2. 학생 개별 쪽지 발송 */}
      <form onSubmit={handleSaveNotice} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <h3 className="font-bold text-sm text-emerald-400">📬 학생 개별 쪽지 발송 (이자 설명/개인 안내)</h3>
        <select
          value={noticeTarget}
          onChange={(e) => setNoticeTarget(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold"
        >
          <option value="">쪽지 받을 대원 선택</option>
          {approvedStudents.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>
        {currentPersonalNotice && (
          <div className="bg-slate-950 border border-emerald-500/30 p-2.5 rounded-xl text-emerald-300">
            ℹ️ 현재 전송된 쪽지: {currentPersonalNotice}
          </div>
        )}
        <textarea
          rows={2}
          placeholder="예: 이번 예금 이자는 방학 기간 규정에 따라 정산되었습니다."
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold outline-none focus:border-emerald-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold"
          >
            📩 쪽지 전송
          </button>
          <button
            type="button"
            disabled={busy || !noticeTarget}
            onClick={handleDeleteNotice}
            className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl font-bold disabled:opacity-50"
          >
            🗑️ 기존 쪽지 회수
          </button>
        </div>
      </form>

      {/* 3. CSV 백업 & 부분/전체 초기화 */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
        <h3 className="font-bold text-sm text-sky-400">💾 CSV 백업 및 데이터 초기화</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => downloadCsv('trans.csv', transactions)}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-700 py-3 rounded-xl font-bold text-sky-300"
          >
            📥 거래내역 백업 (trans.csv · {transactions.length}건)
          </button>
          <button
            type="button"
            onClick={() => downloadCsv('users.csv', users)}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-700 py-3 rounded-xl font-bold text-emerald-300"
          >
            📥 명부/계정 백업 (users.csv · {users.length}명)
          </button>
        </div>

        <div className="border-t border-slate-800 pt-3 space-y-2">
          <p className="font-bold text-slate-300">🧹 부분 데이터 초기화</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => handlePartialReset('transactions', '거래내역')} className="bg-slate-950 hover:bg-rose-950/60 border border-slate-800 px-3 py-2 rounded-xl font-bold text-rose-300">
              거래내역만 비우기
            </button>
            <button type="button" disabled={busy} onClick={() => handlePartialReset('inventory', '가방/쿠폰')} className="bg-slate-950 hover:bg-rose-950/60 border border-slate-800 px-3 py-2 rounded-xl font-bold text-rose-300">
              가방 아이템만 비우기
            </button>
            <button type="button" disabled={busy} onClick={() => handlePartialReset('notifications', '알림함')} className="bg-slate-950 hover:bg-rose-950/60 border border-slate-800 px-3 py-2 rounded-xl font-bold text-rose-300">
              알림함만 비우기
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 flex flex-wrap justify-between items-center gap-2">
          <div>
            <p className="font-bold text-rose-400">💡 새 학년도 시작 (전체 데이터 삭제)</p>
            <p className="text-[11px] text-slate-400">학생, 거래, 가방, 알림, 상점, 펀드를 모두 삭제하고 좌석을 공실로 초기화합니다.</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleNewAcademicYear}
            className="bg-rose-600 hover:bg-rose-500 px-4 py-2.5 rounded-xl font-bold"
          >
            전체 초기화 실행
          </button>
        </div>
      </div>

      {/* 4. Config 설정 에디터 */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <h3 className="font-bold text-sm text-slate-300">⚙️ system_config 설정 에디터</h3>
        <form onSubmit={handleSaveConfigEntry} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Key (예: currency_unit)"
            value={newCfgKey}
            onChange={(e) => setNewCfgKey(e.target.value)}
            className="bg-slate-950 border border-slate-800 p-2 rounded-xl font-bold w-44"
          />
          <input
            type="text"
            placeholder="Value"
            value={newCfgVal}
            onChange={(e) => setNewCfgVal(e.target.value)}
            className="flex-1 min-w-[160px] bg-slate-950 border border-slate-800 p-2 rounded-xl font-bold"
          />
          <button type="submit" disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-bold">
            저장
          </button>
        </form>
        <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          {Object.entries(systemConfigs).map(([k, v]) => (
            <div
              key={k}
              onClick={() => {
                setNewCfgKey(k);
                setNewCfgVal(v);
              }}
              className="flex justify-between gap-2 py-1 border-b border-slate-800/60 last:border-none cursor-pointer hover:bg-slate-900 px-2 rounded"
            >
              <span className="font-bold text-indigo-300">{k}</span>
              <span className="text-slate-400 truncate max-w-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
