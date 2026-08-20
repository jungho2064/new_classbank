'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, LogOut, Users, DollarSign, Building, 
  TrendingUp, Snowflake, Camera, Plus, Trash2, Check, X, RefreshCw
} from 'lucide-react';

export default function AdminPanel({ supabase, userList, transactions, seats, fundData, isFrozen, loadData, showAlert, onLogout }: any) {
  const [adminTab, setAdminTab] = useState<'students' | 'salary' | 'loans' | 'estate' | 'funds' | 'qr' | 'freeze'>('students');

  // 대출 발급 폼
  const [loanTarget, setLoanTarget] = useState('');
  const [loanAmt, setLoanAmt] = useState('');
  const [loanRate, setLoanRate] = useState('5');

  // 주급 세율
  const [taxRate, setTaxRate] = useState(10);
  const [maintRate, setMaintRate] = useState(5);

  // 상/벌금 폼
  const [rewardTarget, setRewardTarget] = useState('');
  const [rewardAmt, setRewardAmt] = useState('');
  const [rewardReason, setRewardReason] = useState('');

  // QR 시리얼 수동 인증
  const [qrSerialInput, setQrSerialInput] = useState('');

  // 1. 주급 일괄 지급
  const handlePaySalaries = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const approved = userList.filter((u: any) => u.status === 'Approved');
    
    const rows: any[] = [];
    for (const u of approved) {
      const base = 140;
      const tax = Math.floor(base * (taxRate / 100)) + Math.floor(base * (maintRate / 100));
      const repay = Math.min(Number(u.weekly_repay || 0), Number(u.loan_balance || 0));
      const net = base - tax - repay;

      rows.push({
        date: nowStr, name: u.name, type: '주급', amount: net,
        note: `기본:${base}|세금:${tax}|상환:${repay}`, status: 'Success'
      });
      if (tax > 0) {
        rows.push({ date: nowStr, name: '국고(중앙은행)', type: '세금', amount: tax, note: `${u.name} 납부`, status: 'Success' });
      }
      if (repay > 0) {
        rows.push({ date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: repay, note: `${u.name} 상환`, status: 'Success' });
        const nextLoan = Math.max(0, Number(u.loan_balance) - repay);
        await supabase.from('users').update({ 
          loan_balance: nextLoan, 
          weekly_repay: nextLoan === 0 ? 0 : u.weekly_repay,
          dunning: nextLoan === 0 ? '' : u.dunning 
        }).eq('name', u.name);
      }
    }
    await supabase.from('transactions').insert(rows);
    await loadData();
    showAlert('💸 전원 주급 정산 및 세금/대출 자동 상환이 완료되었습니다!');
  };

  // 2. 특례 대출 발급
  const handleIssueLoan = async () => {
    const amt = parseInt(loanAmt);
    if (!loanTarget || isNaN(amt) || amt <= 0) { showAlert('⚠️ 대상 대원과 금액을 확인하세요.'); return; }
    const targetUser = userList.find((u: any) => u.name === loanTarget);
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
    await loadData();
    showAlert(`✅ ${loanTarget} 대원에게 ${amt}안 대출을 발급했습니다.`);
  };

  // 3. 상/벌금 개별 부여
  const handleRewardPenalty = async (isReward: boolean) => {
    const amt = parseInt(rewardAmt);
    if (!rewardTarget || isNaN(amt) || amt <= 0) { showAlert('⚠️ 대상과 금액을 확인하세요.'); return; }
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const finalType = isReward ? '상금(+)' : '벌금(-)';
    const finalAmt = isReward ? amt : -amt;

    await supabase.from('transactions').insert([
      { date: nowStr, name: rewardTarget, type: finalType, amount: finalAmt, note: rewardReason || '선생님 재량', status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: isReward ? '정부 지출' : '벌금 수입', amount: -finalAmt, note: `${rewardTarget} ${finalType}`, status: 'Success' }
    ]);

    setRewardAmt(''); setRewardReason('');
    await loadData();
    showAlert(`🏆 ${rewardTarget} 대원에게 ${finalType} ${amt}안 처리가 완료되었습니다.`);
  };

  // 4. 부동산 시즌 재산정 (거품 방지 공식)
  const handleResetEstateSeason = async () => {
    for (const s of seats) {
      const oldFloor = Number(s.floor_price);
      const rentVal = Number(s.rent);
      let newFloor = oldFloor;
      if (rentVal > oldFloor) {
        newFloor = Math.min(500, Math.floor((oldFloor * 0.8) + (rentVal * 0.2)));
      } else if (rentVal === 0 || !s.owner) {
        newFloor = Math.max(10, Math.floor(oldFloor * 0.9));
      }
      await supabase.from('real_estate').update({ floor_price: newFloor, rent: newFloor, owner: '' }).eq('seat', s.seat);
    }
    await loadData();
    showAlert('🔄 거품 방지 공식 적용! 모든 좌석이 새 시즌 경매 시작가로 재산정되었습니다.');
  };

  // 5. QR 시리얼 수동 차감/사용
  const handleVerifySerial = async () => {
    if (!qrSerialInput.trim()) return;
    const { data: inv } = await supabase.from('inventory').select('*').eq('serial', qrSerialInput.trim().toUpperCase()).single();
    if (!inv) { showAlert('❌ 유효하지 않은 시리얼 코드입니다.'); return; }
    if (inv.status === 'Used') { showAlert('⚠️ 이미 사용이 완료된 쿠폰입니다.'); return; }

    await supabase.from('inventory').update({ status: 'Used' }).eq('id', inv.id);
    setQrSerialInput('');
    await loadData();
    showAlert(`✅ [${inv.name}] 대원의 [${inv.item_name}] 쿠폰이 정상 사용 처리되었습니다!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👨‍🏫</span>
          <div>
            <h1 className="font-bold text-indigo-400">학급 중앙은행 관제 데스크</h1>
            <p className="text-xs text-slate-400">실시간 클라우드 장부 관리</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-slate-300 flex items-center gap-1">
          <LogOut size={14}/> 로그아웃
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-5">
        {/* 네비게이션 */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'students', label: '👥 학생/승인' },
            { id: 'salary', label: '💸 주급 일괄정산' },
            { id: 'loans', label: '🏦 대출/독촉' },
            { id: 'estate', label: '🏠 부동산' },
            { id: 'funds', label: '📈 펀드관제' },
            { id: 'qr', label: '🔍 QR/쿠폰검증' },
            { id: 'freeze', label: '❄️ 방학/동결' }
          ].map(m => (
            <button key={m.id} onClick={() => setAdminTab(m.id as any)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${adminTab === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* 1. 학생 계정 / 승인 관리 */}
        {adminTab === 'students' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-yellow-400">🔔 승인 대기 명단</h3>
              {userList.filter((u: any) => u.status === 'Pending').length === 0 ? (
                <p className="text-xs text-slate-500 py-2">대기 중인 신청이 없습니다.</p>
              ) : (
                userList.filter((u: any) => u.status === 'Pending').map((u: any) => (
                  <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                    <span>{u.name} (가입 신청)</span>
                    <button onClick={async () => { await supabase.from('users').update({ status: 'Approved' }).eq('id', u.id); loadData(); showAlert(`승인 완료: ${u.name}`); }} className="bg-emerald-600 px-3 py-1.5 rounded-lg font-bold">승인</button>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-300">🏆 상/벌금 개별 부여 (국고 연동)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <select value={rewardTarget} onChange={e => setRewardTarget(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <option value="">대상 선택</option>
                  {userList.filter((u: any) => u.status === 'Approved').map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <input type="number" placeholder="금액 (안)" value={rewardAmt} onChange={e => setRewardAmt(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl" />
                <input type="text" placeholder="사유 (예: 발표 우수)" value={rewardReason} onChange={e => setRewardReason(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleRewardPenalty(true)} className="flex-1 bg-emerald-600 py-2.5 rounded-xl font-bold text-xs">상금(+) 지급</button>
                <button onClick={() => handleRewardPenalty(false)} className="flex-1 bg-rose-600 py-2.5 rounded-xl font-bold text-xs">벌금(-) 징수</button>
              </div>
            </div>
          </div>
        )}

        {/* 2. 주급 일괄 지급 */}
        {adminTab === 'salary' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">💰 전 대원 주급 자동 정산기</h3>
            <p className="text-xs text-slate-400">기본급 140안에서 설정된 세율과 유지비를 공제하고 대출 상환액을 자동 회수한 뒤 실지급합니다.</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><label className="text-slate-400">세율 (%)</label><input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1"/></div>
              <div><label className="text-slate-400">학급 유지비 (%)</label><input type="number" value={maintRate} onChange={e => setMaintRate(Number(e.target.value))} className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1"/></div>
            </div>
            <button onClick={handlePaySalaries} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm">전원 주급 지급 및 자동 징수 실행</button>
          </div>
        )}

        {/* 3. 대출 / 독촉 관리 */}
        {adminTab === 'loans' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-indigo-400">🏦 신규 대출 발급 (4주 균등 분할)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <select value={loanTarget} onChange={e => setLoanTarget(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <option value="">학생 선택</option>
                  {userList.filter((u: any) => u.status === 'Approved').map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <input type="number" placeholder="대출 원금" value={loanAmt} onChange={e => setLoanAmt(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl" />
                <input type="number" placeholder="주당 이율(%)" value={loanRate} onChange={e => setLoanRate(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl" />
              </div>
              <button onClick={handleIssueLoan} className="w-full bg-indigo-600 py-2.5 rounded-xl font-bold text-xs">대출 승인 및 계좌 입금</button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-rose-400">🚨 대출 연체 및 독촉장 발송</h3>
              {userList.filter((u: any) => Number(u.loan_balance) > 0).length === 0 ? (
                <p className="text-xs text-slate-500 py-2">대출 잔액이 있는 학생이 없습니다.</p>
              ) : (
                userList.filter((u: any) => Number(u.loan_balance) > 0).map((u: any) => (
                  <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                    <div>
                      <span className="font-bold">{u.name}</span>
                      <span className="text-rose-400 font-bold ml-2">잔액: {u.loan_balance}안 (주당 {u.weekly_repay}안)</span>
                    </div>
                    <button onClick={async () => {
                      const next = u.dunning === 'ON' ? '' : 'ON';
                      await supabase.from('users').update({ dunning: next }).eq('id', u.id);
                      loadData();
                      showAlert(`독촉장 ${next ? '발송' : '해제'} 완료`);
                    }} className={`px-3 py-1.5 rounded-lg font-bold ${u.dunning === 'ON' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {u.dunning === 'ON' ? '독촉 ON' : '독촉장 발송'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. 좌석 부동산 */}
        {adminTab === 'estate' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-indigo-400">🗺️ 좌석 부동산 (1~25번)</h3>
              <button onClick={handleResetEstateSeason} className="bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs">
                🔄 거품 방지 시즌 재산정
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {seats.map((s: any) => (
                <div key={s.seat} className={`p-2 rounded-xl border ${s.owner ? 'bg-indigo-950/60 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                  <p className="font-bold">{s.seat}번</p>
                  <p className="text-[10px] text-yellow-400 font-bold">{s.floor_price}안</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.owner || '공실'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. 펀드 관제 */}
        {adminTab === 'funds' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-indigo-400">📈 바른생활 펀드 지수 조정</h3>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-emerald-400">{fundData?.current_index || 1000}p</span>
              <button onClick={async () => {
                await supabase.from('funds').update({ current_index: Number(fundData.current_index) + 50 }).eq('fund_id', fundData.fund_id);
                loadData();
              }} className="bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold">+50p 상승</button>
              <button onClick={async () => {
                await supabase.from('funds').update({ current_index: Math.max(100, Number(fundData.current_index) - 50) }).eq('fund_id', fundData.fund_id);
                loadData();
              }} className="bg-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold">-50p 하락</button>
            </div>
          </div>
        )}

        {/* 6. QR / 바코드 검증 */}
        {adminTab === 'qr' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-indigo-400">🔍 학생 쿠폰 시리얼 검증기</h3>
            <p className="text-xs text-slate-400">학생이 가방에서 보여준 시리얼 코드(SN-XXXXXX)를 입력하여 1회 차감합니다.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="SN-123456" value={qrSerialInput} onChange={e => setQrSerialInput(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-mono font-bold uppercase" />
              <button onClick={handleVerifySerial} className="bg-emerald-600 hover:bg-emerald-500 px-5 rounded-xl font-bold text-xs">사용 확정</button>
            </div>
          </div>
        )}

        {/* 7. 방학 모드 */}
        {adminTab === 'freeze' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-rose-400">❄️ 방학(경제 동결) 모드</h3>
              <p className="text-xs text-slate-400 mt-1">송금, 상점, 예금 개설을 잠그고 통장 조회 및 대출 상환만 허용합니다.</p>
            </div>
            <button onClick={async () => {
              const next = isFrozen ? 'FALSE' : 'TRUE';
              await supabase.from('system_config').upsert({ key: 'is_vacation', value: next });
              loadData();
              showAlert(isFrozen ? '☀️ 방학 모드가 해제되었습니다.' : '❄️ 방학 모드가 가동되었습니다.');
            }} className={`px-4 py-2 rounded-xl text-xs font-bold ${isFrozen ? 'bg-rose-600' : 'bg-slate-800 text-slate-400'}`}>
              {isFrozen ? '동결 중 (ON)' : '해제됨 (OFF)'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
