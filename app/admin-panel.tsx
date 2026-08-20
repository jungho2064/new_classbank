'use client';

import React, { useState } from 'react';
import { 
  Users, Award, DollarSign, Landmark, Building, 
  Store, QrCode, TrendingUp, FileText, Settings, LogOut, Check, X, RefreshCw, Plus, Trash2
} from 'lucide-react';

export default function AdminPanel({ 
  supabase, 
  userList = [], 
  transactions = [], 
  seats = [], 
  fundData = null, 
  isFrozen = false, 
  depositOpen = true, 
  setDepositOpen, 
  loadData, 
  showAlert, 
  onLogout 
}: any) {
  const safeUsers = Array.isArray(userList) ? userList : [];
  const safeTrans = Array.isArray(transactions) ? transactions : [];
  const safeSeats = Array.isArray(seats) ? seats : [];

  const [adminTab, setAdminTab] = useState<'pending' | 'reward' | 'salary' | 'loans' | 'estate' | 'deposits' | 'store' | 'qr' | 'funds' | 'audit' | 'system'>('pending');
  const [auditFilter, setAuditFilter] = useState<'student' | 'treasury' | 'all'>('student');

  // 상/벌금
  const [rewardTarget, setRewardTarget] = useState('');
  const [rewardType, setRewardType] = useState<'상금(+)' | '벌금(-)'>('상금(+)');
  const [rewardAmt, setRewardAmt] = useState('');
  const [rewardReason, setRewardReason] = useState('');

  // 주급 세율
  const [taxRate, setTaxRate] = useState(10);
  const [maintRate, setMaintRate] = useState(5);

  // 대출
  const [loanTarget, setLoanTarget] = useState('');
  const [loanAmt, setLoanAmt] = useState('');
  const [loanRate, setLoanRate] = useState('5.0');
  const [globalLoanRate, setGlobalLoanRate] = useState('5.0');

  // 상점 신규 등록
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('10');
  const [newItemMax, setNewItemMax] = useState('1');
  const [newItemPromo, setNewItemPromo] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState('');

  // QR 검증
  const [serialInput, setSerialInput] = useState('');

  // 펀드
  const [fundNews, setFundNews] = useState('');
  const [fundHint, setFundHint] = useState('');
  const [posScore, setPosScore] = useState(0);
  const [negScore, setNegScore] = useState(0);
  const [batchFundAmt, setBatchFundAmt] = useState('40');

  // 승인/거절 핸들러 (최종 완성본)
  const handleResolvePending = async (tId: number, status: 'Success' | 'Rejected', name: string, isWithdrawal: boolean, amount?: number) => {
    if (!supabase) return;

    // 1. 기존 출금 신청 내역의 상태를 처리 (출금 거절이면 'Rejected_W'로 변경)
    const targetStatus = (isWithdrawal && status === 'Rejected') ? 'Rejected_W' : status;
    await supabase.from('transactions').update({ status: targetStatus }).eq('id', tId);
    
    // 2. 출금 거절 시 +환불금액을 새로 장부에 추가!
    if (status === 'Rejected') {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const refundAmt = Math.abs(Number(amount || 0));

      if (isWithdrawal && refundAmt > 0) {
        await supabase.from('transactions').insert([
          {
            date: nowStr,
            name,
            type: '출금 반려 환불',
            amount: refundAmt, // 👈 장부에 +800안 찍히고 실제로 입금됨!
            note: '현금 출금 요청 반려로 인한 잔액 환불',
            status: 'Success'
          }
        ]);
      } else {
        await supabase.from('transactions').insert([
          {
            date: nowStr,
            name,
            type: '송금 반려',
            amount: 0,
            note: '관리자 반려 처리',
            status: 'System'
          }
        ]);
      }
    }

    if (loadData) await loadData();
    if (showAlert) showAlert(`요청이 [${status === 'Success' ? '승인' : '거절 (환불 완료)'}] 처리되었습니다.`);
  };

  // 상/벌금 실행
  const handleRewardPenalty = async () => {
    if (!supabase) return;
    const amt = parseInt(rewardAmt);
    if (!rewardTarget || isNaN(amt) || amt <= 0) { if (showAlert) showAlert('⚠️ 대상과 금액을 확인하세요.'); return; }
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const isReward = rewardType === '상금(+)';
    const val = isReward ? amt : -amt;

    await supabase.from('transactions').insert([
      { date: nowStr, name: rewardTarget, type: rewardType, amount: val, note: rewardReason || '선생님 재량', status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: isReward ? '정부 지출' : '벌금 수입', amount: -val, note: `${rewardTarget} ${rewardType}`, status: 'Success' }
    ]);
    setRewardAmt(''); setRewardReason('');
    if (loadData) await loadData();
    if (showAlert) showAlert(`🏆 ${rewardTarget} 대원에게 ${rewardType} ${amt}안 반영 완료!`);
  };

  // 주급 일괄 지급
  const handlePaySalaries = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const approved = safeUsers.filter((u: any) => u.status === 'Approved');
    const rows: any[] = [];

    for (const u of approved) {
      const base = 140;
      const tax = Math.floor(base * (taxRate / 100)) + Math.floor(base * (maintRate / 100));
      const repay = Math.min(Number(u.weekly_repay || 0), Number(u.loan_balance || 0));
      const net = base - tax - repay;

      rows.push({ date: nowStr, name: u.name, type: '주급', amount: net, note: `기본:${base}|세금:${tax}|상환:${repay}`, status: 'Success' });
      if (tax > 0) rows.push({ date: nowStr, name: '국고(중앙은행)', type: '세금', amount: tax, note: `${u.name} 세금 납부`, status: 'Success' });
      if (repay > 0) {
        rows.push({ date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: repay, note: `${u.name} 대출 상환`, status: 'Success' });
        const nextLoan = Math.max(0, Number(u.loan_balance) - repay);
        await supabase.from('users').update({
          loan_balance: nextLoan,
          weekly_repay: nextLoan === 0 ? 0 : u.weekly_repay,
          dunning: nextLoan === 0 ? '' : u.dunning
        }).eq('name', u.name);
      }
    }
    if (rows.length > 0) await supabase.from('transactions').insert(rows);
    if (loadData) await loadData();
    if (showAlert) showAlert('💸 전 대원 주급 지급 및 자동 징수가 완료되었습니다!');
  };

  // 대출 발급
  const handleIssueLoan = async () => {
    if (!supabase) return;
    const amt = parseInt(loanAmt);
    if (!loanTarget || isNaN(amt) || amt <= 0) { if (showAlert) showAlert('⚠️ 학생과 대출금을 확인하세요.'); return; }
    const targetUser = safeUsers.find((u: any) => u.name === loanTarget);
    if (!targetUser) return;
    const newLoan = Number(targetUser.loan_balance || 0) + amt;
    const newWeekly = Math.ceil(amt / 4);

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    await supabase.from('transactions').insert([
      { date: nowStr, name: loanTarget, type: '특례 대출 입금', amount: amt, note: `4주 분할 (이율 ${loanRate}%)`, status: 'Success' }
    ]);
    await supabase.from('users').update({
      loan_balance: newLoan,
      weekly_repay: Number(targetUser.weekly_repay || 0) + newWeekly,
      individual_rate: parseFloat(loanRate) || 0
    }).eq('name', loanTarget);

    setLoanAmt('');
    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ ${loanTarget} 대원에게 ${amt}안 대출을 발급했습니다.`);
  };

  // 일괄 이율 설정
  const handleUpdateGlobalRate = async () => {
    if (!supabase) return;
    const rate = parseFloat(globalLoanRate);
    await supabase.from('system_config').upsert({ key: 'weekly_loan_rate', value: String(rate) }, { onConflict: 'key' });
    await supabase.from('users').update({ individual_rate: 0 }).neq('id', 0);
    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ 일괄 이율 ${rate}%가 적용되었습니다.`);
  };

  // 임대료 징수 및 재산정
  const handleCollectRent = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const rows: any[] = [];
    for (const s of safeSeats.filter((seat: any) => seat && seat.owner)) {
      rows.push({ date: nowStr, name: s.owner, type: '임대료 납부', amount: -Number(s.rent || s.floor_price || 0), note: `${s.seat}번 좌석`, status: 'Success' });
      rows.push({ date: nowStr, name: '국고(중앙은행)', type: '임대료 수입', amount: Number(s.rent || s.floor_price || 0), note: `${s.owner} 임대료`, status: 'Success' });
    }
    if (rows.length > 0) await supabase.from('transactions').insert(rows);
    if (loadData) await loadData();
    if (showAlert) showAlert('💸 모든 입주 학생의 임대료 징수가 완료되었습니다!');
  };

  const handleResetEstateSeason = async () => {
    if (!supabase) return;
    for (const s of safeSeats) {
      const oldFloor = Number(s.floor_price || 30);
      const rentVal = Number(s.rent || oldFloor);
      let newFloor = oldFloor;
      if (rentVal > oldFloor) newFloor = Math.min(500, Math.floor((oldFloor * 0.8) + (rentVal * 0.2)));
      else if (rentVal === 0 || !s.owner) newFloor = Math.max(10, Math.floor(oldFloor * 0.9));
      await supabase.from('real_estate').update({ floor_price: newFloor, rent: newFloor, owner: '' }).eq('seat', s.seat);
    }
    if (loadData) await loadData();
    if (showAlert) showAlert('🔄 거품 방지 공식이 적용되어 모든 좌석의 새 시즌 가격이 책정되었습니다.');
  };

  // 만기 예금 일괄 지급
  const handleMatureAllDeposits = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const today = new Date().toISOString().split('T')[0];
    const activeDeposits = safeTrans.filter((t: any) => t && t.status === 'Deposit_Active');
    const rows: any[] = [];

    for (const d of activeDeposits) {
      try {
        if (!d.note) continue;
        const parts = Object.fromEntries(d.note.split('|').map((p: string) => p.split(':')));
        if (parts['만기'] && parts['만기'] <= today) {
          const prin = parseInt(parts['원금'] || '0');
          const rate = parseInt(parts['이율'] || '0');
          const grossInt = Math.floor(prin * (rate / 100));
          const tax = Math.floor(grossInt * 0.15);
          const net = prin + grossInt - tax;

          await supabase.from('transactions').update({ status: 'Deposit_Matured' }).eq('id', d.id);
          rows.push({ date: nowStr, name: d.name, type: '예금 만기', amount: net, note: '만기 일괄 지급', status: 'Success' });
          if (tax > 0) rows.push({ date: nowStr, name: '국고(중앙은행)', type: '이자소득세', amount: tax, note: `${d.name} 예금 세금`, status: 'Success' });
        }
      } catch (e) {}
    }
    if (rows.length > 0) await supabase.from('transactions').insert(rows);
    if (loadData) await loadData();
    if (showAlert) showAlert('💰 만기 도래 예금의 원리금 지급 및 세금 원천징수가 완료되었습니다!');
  };

  // 신규 상품 등록
  const handleRegisterShopItem = async () => {
    if (!supabase) return;
    if (!newItemName.trim() || !newItemPrice) { if (showAlert) showAlert('⚠️ 상품명과 가격을 입력하세요.'); return; }
    await supabase.from('shop_items').insert([{
      item_id: `I_${Date.now()}`, name: newItemName.trim(), price: parseInt(newItemPrice),
      stock: parseInt(newItemStock || '10'), max_per_user: parseInt(newItemMax || '1'),
      promotion: newItemPromo ? '특가' : '', description: newItemDesc.trim(), status: 'Active'
    }]);
    setNewItemName(''); setNewItemPrice(''); setNewItemDesc('');
    if (loadData) await loadData();
    if (showAlert) showAlert('🛍️ 새 상품이 상점에 정상 등록되었습니다.');
  };

  // QR 검증
  const handleVerifySerial = async () => {
    if (!supabase || !serialInput.trim()) return;
    const { data: inv } = await supabase.from('inventory').select('*').eq('serial', serialInput.trim().toUpperCase()).single();
    if (!inv) { if (showAlert) showAlert('❌ 등록되지 않은 시리얼 번호입니다.'); return; }
    if (inv.status === 'Used') { if (showAlert) showAlert('⚠️ 이미 사용이 완료된 쿠폰입니다.'); return; }

    await supabase.from('inventory').update({ status: 'Used' }).eq('id', inv.id);
    setSerialInput('');
    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ [${inv.name}] 대원의 [${inv.item_name}] 사용 처리가 확정되었습니다!`);
  };

  // 펀드 업데이트 및 일괄 가입
  const handleUpdateFundIndex = async () => {
    if (!supabase) return;
    const current = Number(fundData?.current_index || 1000);
    const newIdx = Math.max(10, current + posScore - negScore);
    await supabase.from('funds').update({ current_index: newIdx, news: fundNews, hint: fundHint }).eq('fund_id', fundData?.fund_id || 'F_LIFE');
    setPosScore(0); setNegScore(0);
    if (loadData) await loadData();
    if (showAlert) showAlert(`📈 펀드 지수가 [${newIdx}p]로 업데이트되었습니다!`);
  };

  const handleBatchFundBuy = async () => {
    if (!supabase) return;
    const amt = parseInt(batchFundAmt);
    if (isNaN(amt) || amt <= 0) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const approved = safeUsers.filter((u: any) => u.status === 'Approved');
    const rows: any[] = [];

    for (const u of approved) {
      const myBal = safeTrans.filter((t: any) => t && t.name === u.name && t.status !== 'Rejected' && t.status !== 'Deposit_Active').reduce((a: any, c: any) => a + Number(c.amount || 0), 0);
      if (myBal >= amt) {
        rows.push({ date: nowStr, name: u.name, type: '펀드 가입', amount: -amt, note: `${fundData?.name || '바른생활'}|${fundData?.current_index || 1000}`, status: `Fund_${fundData?.fund_id || 'F_LIFE'}` });
        rows.push({ date: nowStr, name: '국고(중앙은행)', type: '펀드 예치금', amount: amt, note: `${u.name} 일괄 가입 예치`, status: 'Success' });
      }
    }
    if (rows.length > 0) await supabase.from('transactions').insert(rows);
    if (loadData) await loadData();
    if (showAlert) showAlert(`🚀 ${rows.length / 2}명의 대원이 펀드에 자동 가입되었습니다!`);
  };

  const treasuryBal = safeTrans.filter((t: any) => t && t.name === '국고(중앙은행)' && t.status === 'Success').reduce((a: any, c: any) => a + Number(c.amount || 0), 0);
  const totalMoneySupply = safeTrans.filter((t: any) => t && t.name !== '국고(중앙은행)' && t.status !== 'Rejected' && t.status !== 'Deposit_Active').reduce((a: any, c: any) => a + Number(c.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👨‍🏫</span>
          <div>
            <h1 className="font-bold text-indigo-400">학급 중앙은행 종합 관제 센터</h1>
            <p className="text-xs text-slate-400">국고: {treasuryBal.toLocaleString()}안 | 통화량: {totalMoneySupply.toLocaleString()}안</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-slate-300 flex items-center gap-1 border border-slate-700">
          <LogOut size={14}/> 로그아웃
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-5">
        {/* 11개 탭 네비게이션 */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'pending', label: '🔔 승인대기' },
            { id: 'reward', label: '🏆 상/벌금' },
            { id: 'salary', label: '💸 주급정산' },
            { id: 'loans', label: '🏦 대출/독촉' },
            { id: 'estate', label: '🏠 부동산' },
            { id: 'deposits', label: '💰 예금만기' },
            { id: 'store', label: '🛒 상점/재고' },
            { id: 'qr', label: '🔍 QR검증' },
            { id: 'funds', label: '📈 펀드관제' },
            { id: 'audit', label: '📜 전체장부' },
            { id: 'system', label: '⚙️ 시스템' }
          ].map(m => (
            <button key={m.id} onClick={() => setAdminTab(m.id as any)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${adminTab === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* 1. 승인대기 */}
        {adminTab === 'pending' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-yellow-400">👤 회원가입 승인 대기</h3>
              {safeUsers.filter((u: any) => u && u.status === 'Pending').length === 0 ? <p className="text-xs text-slate-500 py-2">대기 중인 가입 신청이 없습니다.</p> : safeUsers.filter((u: any) => u && u.status === 'Pending').map((u: any) => (
                <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                  <span>{u.name} 대원</span>
                  <button onClick={async () => { await supabase.from('users').update({ status: 'Approved' }).eq('id', u.id); if (loadData) loadData(); if (showAlert) showAlert(`승인 완료: ${u.name}`); }} className="bg-emerald-600 px-3 py-1.5 rounded-lg font-bold">승인</button>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-yellow-400">🏧 현금 출금 승인 대기</h3>
              {safeTrans.filter((t: any) => t && t.status === 'Pending_W').length === 0 ? <p className="text-xs text-slate-500 py-2">대기 중인 출금 요청이 없습니다.</p> : safeTrans.filter((t: any) => t && t.status === 'Pending_W').map((t: any) => (
                <div key={t.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                  <div><p className="font-bold">{t.name}</p><p className="text-slate-400">출금 요청: {Math.abs(t.amount)}안</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleResolvePending(t.id, 'Success', t.name, true)} className="bg-emerald-600 px-3 py-1.5 rounded-lg font-bold">승인</button>
                    <button onClick={() => handleResolvePending(t.id, 'Rejected', t.name, true)} className="bg-rose-600 px-3 py-1.5 rounded-lg font-bold">거절</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. 상/벌금 */}
        {adminTab === 'reward' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">🏆 개별 상/벌금 지급 및 징수 (국고 연동)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <select value={rewardTarget} onChange={e => setRewardTarget(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold">
                <option value="">대상 대원 선택</option>
                {safeUsers.filter((u: any) => u && u.status === 'Approved').map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
              <select value={rewardType} onChange={e => setRewardType(e.target.value as any)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold">
                <option value="상금(+)">상금 (+)</option>
                <option value="벌금(-)">벌금 (-)</option>
              </select>
              <input type="number" placeholder="금액 (안)" value={rewardAmt} onChange={e => setRewardAmt(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold" />
              <input type="text" placeholder="사유 (예: 발표 우수)" value={rewardReason} onChange={e => setRewardReason(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold" />
            </div>
            <button onClick={handleRewardPenalty} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-xs shadow-lg">상/벌금 장부 반영 실행</button>
          </div>
        )}

        {/* 3. 주급정산 */}
        {adminTab === 'salary' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">💰 전 대원 주급 자동 정산기</h3>
            <p className="text-xs text-slate-400">기본급 140안에서 세율({taxRate}%)과 유지비({maintRate}%)를 공제하고 대출 상환액을 자동 회수한 뒤 실지급액을 계좌에 입금합니다.</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><label className="text-slate-400">세율 (%)</label><input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold"/></div>
              <div><label className="text-slate-400">유지비 (%)</label><input type="number" value={maintRate} onChange={e => setMaintRate(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold"/></div>
            </div>
            <button onClick={handlePaySalaries} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm">전원 주급 입금 및 자동 징수 실행</button>
          </div>
        )}

        {/* 4. 대출/독촉 */}
        {adminTab === 'loans' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-400">🏦 신규 대출 발급 (4주 균등 분할 상환)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <select value={loanTarget} onChange={e => setLoanTarget(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold">
                  <option value="">학생 선택</option>
                  {safeUsers.filter((u: any) => u && u.status === 'Approved').map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <input type="number" placeholder="대출 원금" value={loanAmt} onChange={e => setLoanAmt(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold" />
                <input type="number" placeholder="주당 이율(%)" value={loanRate} onChange={e => setLoanRate(e.target.value)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold" />
              </div>
              <button onClick={handleIssueLoan} className="w-full bg-indigo-600 py-2.5 rounded-xl font-bold text-xs">대출 승인 및 계좌 입금</button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-400">⚙️ 일괄 주당 이자율 설정</h3>
              <div className="flex gap-2 text-xs">
                <input type="number" value={globalLoanRate} onChange={e => setGlobalLoanRate(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold" placeholder="새 일괄 이율(%)"/>
                <button onClick={handleUpdateGlobalRate} className="bg-slate-800 border border-slate-700 px-5 rounded-xl font-bold">일괄 적용</button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-rose-400">🚨 대출 연체 및 독촉장 발송</h3>
              {safeUsers.filter((u: any) => u && Number(u.loan_balance) > 0).length === 0 ? <p className="text-xs text-slate-500 py-2">대출 잔액이 있는 학생이 없습니다.</p> : safeUsers.filter((u: any) => u && Number(u.loan_balance) > 0).map((u: any) => (
                <div key={u.id} className="bg-slate-950 p-3.5 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                  <div><span className="font-bold">{u.name}</span><span className="text-rose-400 font-bold ml-2">잔액: {u.loan_balance}안 (매주 {u.weekly_repay}안)</span></div>
                  <button onClick={async () => {
                    const next = u.dunning === 'ON' ? '' : 'ON';
                    await supabase.from('users').update({ dunning: next }).eq('id', u.id);
                    if (loadData) await loadData();
                    if (showAlert) showAlert(`독촉장 ${next ? '발송' : '해제'} 완료`);
                  }} className={`px-3.5 py-1.5 rounded-lg font-bold ${u.dunning === 'ON' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {u.dunning === 'ON' ? '독촉 켜짐' : '독촉장 발송'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. 좌석 부동산 */}
        {adminTab === 'estate' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-indigo-400">🗺️ 교실 좌석 부동산 관리 (1~25번)</h3>
              <div className="flex gap-2">
                <button onClick={handleCollectRent} className="bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold">임대료 일괄 징수</button>
                <button onClick={handleResetEstateSeason} className="bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs">거품 방지 시즌 재산정</button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {safeSeats.map((s: any) => (
                <div key={s.seat} className={`p-2.5 rounded-xl border ${s.owner ? 'bg-indigo-950/60 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                  <p className="font-bold">{s.seat}번</p>
                  <p className="text-[10px] text-yellow-400 font-bold">{s.floor_price}안</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.owner || '공실'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. 예금 만기 지급 */}
        {adminTab === 'deposits' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-indigo-400">💰 만기 예금 원리금 일괄 지급</h3>
              <button onClick={handleMatureAllDeposits} className="bg-emerald-600 px-4 py-2 rounded-xl text-xs font-bold">만기 도래분 일괄 지급 실행</button>
            </div>
            <p className="text-xs text-slate-400">만기일이 지난 예금의 이자소득세(15%)를 원천 징수하여 국고에 넣고 세후 원리금을 학생 계좌로 자동 입금합니다.</p>
          </div>
        )}

        {/* 7. 상점 / 재고 관리 */}
        {adminTab === 'store' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">🛍️ 신규 아이템 등록</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <input type="text" placeholder="아이템 이름" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold" />
              <input type="number" placeholder="가격 (안)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold" />
              <input type="number" placeholder="재고 수량" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold" />
              <input type="text" placeholder="설명" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={newItemPromo} onChange={e => setNewItemPromo(e.target.checked)} /> 📢 '특가 세일' 뱃지 달기
            </label>
            <button onClick={handleRegisterShopItem} className="w-full bg-indigo-600 py-2.5 rounded-xl font-bold text-xs">상점에 아이템 출시</button>
          </div>
        )}

        {/* 8. QR 검증 */}
        {adminTab === 'qr' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">🔍 학생 쿠폰 시리얼 코드 검증기</h3>
            <p className="text-xs text-slate-400">학생이 가방에서 보여주는 시리얼 번호(SN-XXXXXX)를 입력해 사용을 확정합니다.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="SN-123456" value={serialInput} onChange={e => setSerialInput(e.target.value)} className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono font-bold uppercase" />
              <button onClick={handleVerifySerial} className="bg-emerald-600 px-5 rounded-xl font-bold text-xs">사용 확정</button>
            </div>
          </div>
        )}

        {/* 9. 펀드 컨트롤타워 */}
        {adminTab === 'funds' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-400">📈 펀드 지수 및 뉴스/힌트 업데이트</h3>
              <p className="text-xs text-slate-300 font-bold">현재 지수: {fundData?.current_index || 1000}p</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><label className="text-slate-400">상승 점수 가산(+)</label><input type="number" value={posScore} onChange={e => setPosScore(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold"/></div>
                <div><label className="text-slate-400">하락 점수 감산(-)</label><input type="number" value={negScore} onChange={e => setNegScore(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold"/></div>
              </div>
              <input type="text" placeholder="어제의 뉴스" value={fundNews} onChange={e => setFundNews(e.target.value)} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-bold" />
              <input type="text" placeholder="오늘의 이모저모 힌트" value={fundHint} onChange={e => setFundHint(e.target.value)} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-bold" />
              <button onClick={handleUpdateFundIndex} className="w-full bg-indigo-600 py-2.5 rounded-xl font-bold text-xs">지표 반영 및 지수 갱신</button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-400">🚀 전 대원 일괄 가입 엔진</h3>
              <div className="flex gap-2">
                <input type="number" placeholder="1인당 가입액" value={batchFundAmt} onChange={e => setBatchFundAmt(e.target.value)} className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-bold" />
                <button onClick={handleBatchFundBuy} className="bg-indigo-600 px-5 rounded-xl font-bold text-xs">일괄 가입 실행</button>
              </div>
            </div>
          </div>
        )}

        {/* 10. 전체 장부 감사 (학생/국고 분리) */}
        {adminTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
              <h3 className="font-bold text-sm text-indigo-400">📜 거래 장부 감사(Audit)</h3>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button 
                  onClick={() => setAuditFilter('student')} 
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'student' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  👤 학생 거래 장부
                </button>
                <button 
                  onClick={() => setAuditFilter('treasury')} 
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'treasury' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                >
                  🏛️ 국고 장부
                </button>
                <button 
                  onClick={() => setAuditFilter('all')} 
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  통합 전체
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {safeTrans
                .filter((t: any) => {
                  if (auditFilter === 'student') return t.name !== '국고(중앙은행)';
                  if (auditFilter === 'treasury') return t.name === '국고(중앙은행)';
                  return true;
                })
                .map((t: any) => {
                  const isTreasury = t.name === '국고(중앙은행)';
                  return (
                    <div 
                      key={t.id} 
                      className={`p-2.5 rounded-xl border text-[11px] flex justify-between items-center ${
                        isTreasury 
                          ? 'bg-amber-950/30 border-amber-500/30' 
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div>
                        <span className={`font-bold ${isTreasury ? 'text-amber-400' : 'text-white'}`}>
                          {t.name}
                        </span>
                        <span className="text-slate-400 ml-1.5">
                          [{t.type}] {t.note}
                        </span>
                        <span className="text-slate-500 text-[10px] ml-2">
                          ({t.date})
                        </span>
                      </div>
                      <span className={`font-bold ${Number(t.amount || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(t.amount || 0) > 0 ? `+${t.amount}` : t.amount} 안
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 11. 시스템 제어 */}
        {adminTab === 'system' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">⚙️ 학급 경제 특수 제어</h3>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div><p className="font-bold text-sm">❄️ 방학(경제 동결) 모드</p><p className="text-xs text-slate-400">송금, 상점, 예금 개설 동결</p></div>
              <button onClick={async () => {
                const next = isFrozen ? 'FALSE' : 'TRUE';
                await supabase.from('system_config').upsert({ key: 'is_vacation', value: next }, { onConflict: 'key' });
                if (loadData) await loadData();
                if (showAlert) showAlert(isFrozen ? '방학 해제' : '방학 가동');
              }} className={`px-4 py-2 rounded-xl text-xs font-bold ${isFrozen ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{isFrozen ? '동결 ON' : '해제 OFF'}</button>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div><p className="font-bold text-sm">🏦 정기예금 가입 창구</p><p className="text-xs text-slate-400">정기예금 신규 가입 허용 여부</p></div>
              <button onClick={async () => {
                const next = depositOpen ? 'FALSE' : 'TRUE';
                await supabase.from('system_config').upsert({ key: 'deposit_open', value: next }, { onConflict: 'key' });
                if (setDepositOpen) setDepositOpen(!depositOpen);
                if (loadData) await loadData();
                if (showAlert) showAlert(depositOpen ? '🔒 예금 창구가 닫혔습니다.' : '🟢 예금 창구가 열렸습니다.');
              }} className={`px-4 py-2 rounded-xl text-xs font-bold ${depositOpen ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{depositOpen ? '창구 ON' : '창구 OFF'}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
