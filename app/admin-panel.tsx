'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Award, DollarSign, Landmark, Building, 
  Store, QrCode, TrendingUp, FileText, Settings, LogOut, Check, X, RefreshCw, Plus, Trash2, Edit2, Search
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

  const [adminTab, setAdminTab] = useState<'pending' | 'members' | 'reward' | 'salary' | 'loans' | 'estate' | 'deposits' | 'store' | 'qr' | 'funds' | 'audit' | 'system'>('pending');
  const [auditFilter, setAuditFilter] = useState<'student' | 'treasury' | 'all'>('student');
  const [auditSearchName, setAuditSearchName] = useState(''); // 1. 장부 학생명 검색 필터

  // 대원 현황 검색 & 정렬
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState<'netWorth' | 'cash' | 'name'>('netWorth');

  // 상/벌금 및 직접 수동 입출금
  const [rewardTarget, setRewardTarget] = useState('');
  const [rewardType, setRewardType] = useState<'상금(+)' | '벌금(-)' | '기타 입금(+)' | '기타 출금(-)'>('상금(+)');
  const [rewardAmt, setRewardAmt] = useState('');
  const [rewardReason, setRewardReason] = useState('');

  // 주급 세율 & 직업 관리 상태
  const [taxRate, setTaxRate] = useState(10);
  const [maintRate, setMaintRate] = useState(5);
  const [customJobs, setCustomJobs] = useState<{ [key: string]: number }>({
    '봉사위원': 180, '분리배출': 160, '우유 관리': 150, '교실 바닥 쓸기': 150,
    '특별구역 청소': 140, '복도 쓸기': 140, '창문관리 및 청소': 140,
    '에너지 관리 및 피아노 설치': 140, '책상 줄 맞추기': 130, '배달부': 130,
    '시간표 관리': 120, '우주 시민': 140
  });
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobSalary, setNewJobSalary] = useState('');

  // 대출
  const [loanTarget, setLoanTarget] = useState('');
  const [loanAmt, setLoanAmt] = useState('');
  const [loanRate, setLoanRate] = useState('5.0');
  const [globalLoanRate, setGlobalLoanRate] = useState('5.0');

  // 상점 관리 & 신규 등록
  const [shopItemsList, setShopItemsList] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('10');
  const [newItemMax, setNewItemMax] = useState('1');
  const [newItemPromo, setNewItemPromo] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // QR 검증
  const [serialInput, setSerialInput] = useState('');

  // 펀드
  const [fundNews, setFundNews] = useState('');
  const [fundHint, setFundHint] = useState('');
  const [posScore, setPosScore] = useState(0);
  const [negScore, setNegScore] = useState(0);
  const [batchFundAmt, setBatchFundAmt] = useState('40');

  // 상점 아이템 불러오기
  const loadShopItems = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
    setShopItemsList(data || []);
  };

  useEffect(() => {
    loadShopItems();
  }, [adminTab]);

  // 승인/거절 핸들러 (환불 시 +금액 기록)
  const handleResolvePending = async (tId: number, status: 'Success' | 'Rejected', name: string, isWithdrawal: boolean, amount?: number) => {
    if (!supabase) return;

    const targetStatus = (isWithdrawal && status === 'Rejected') ? 'Rejected_W' : status;
    await supabase.from('transactions').update({ status: targetStatus }).eq('id', tId);

    if (status === 'Rejected') {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const refundAmt = Math.abs(Number(amount || 0));

      if (isWithdrawal && refundAmt > 0) {
        await supabase.from('transactions').insert([
          {
            date: nowStr,
            name,
            type: '출금 반려 환불',
            amount: refundAmt,
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

  // 수동 입출금 실행 (상금/벌금 및 직접 입력 사유 지원)
  const handleRewardPenalty = async () => {
    if (!supabase) return;
    const amt = parseInt(rewardAmt);
    if (!rewardTarget || isNaN(amt) || amt <= 0) {
      if (showAlert) showAlert('⚠️ 대상과 금액을 확인하세요.');
      return;
    }

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const isDeduction = rewardType === '벌금(-)' || rewardType === '기타 출금(-)';

    if (isDeduction) {
      const { data: userTrans } = await supabase
        .from('transactions')
        .select('amount')
        .eq('name', rewardTarget)
        .neq('status', 'System')
        .neq('status', 'Deposit_Active');

      const targetBalance = (userTrans || []).reduce((a: any, c: any) => a + Number(c.amount || 0), 0);

      if (targetBalance < amt) {
        const shortage = amt - targetBalance;
        const { data: targetUser } = await supabase.from('users').select('loan_balance, weekly_repay').eq('name', rewardTarget).single();

        if (targetBalance > 0) {
          await supabase.from('transactions').insert([
            { date: nowStr, name: rewardTarget, type: rewardType, amount: -targetBalance, note: `${rewardReason || rewardType} (잔액 전액 징수)`, status: 'Success' },
            { date: nowStr, name: '국고(중앙은행)', type: rewardType === '벌금(-)' ? '벌금 수입' : '국고 수입', amount: targetBalance, note: `${rewardTarget} ${rewardType}`, status: 'Success' }
          ]);
        } else {
          await supabase.from('transactions').insert([
            { date: nowStr, name: rewardTarget, type: rewardType, amount: 0, note: `${rewardReason || rewardType} (잔액 부족으로 전액 대출 전환)`, status: 'System' }
          ]);
        }

        const newLoan = Number(targetUser?.loan_balance || 0) + shortage;
        const addWeeklyRepay = Math.ceil(shortage / 4);
        const newWeeklyRepay = Number(targetUser?.weekly_repay || 0) + addWeeklyRepay;

        await supabase.from('users').update({ 
          loan_balance: newLoan, 
          weekly_repay: newWeeklyRepay, 
          dunning: 'ON' 
        }).eq('name', rewardTarget);

        setRewardAmt(''); setRewardReason('');
        if (loadData) await loadData();
        if (showAlert) showAlert(`⚠️ 잔액 부족! 모자란 ${shortage}안이 대출로 강제 전환되었습니다.`);
        return;
      }
    }

    const val = isDeduction ? -amt : amt;
    const treasuryType = isDeduction 
      ? (rewardType === '벌금(-)' ? '벌금 수입' : '국고 수입') 
      : (rewardType === '상금(+)' ? '정부 지출' : '직접 지급 지출');

    await supabase.from('transactions').insert([
      { 
        date: nowStr, 
        name: rewardTarget, 
        type: rewardType, 
        amount: val, 
        note: rewardReason || (isDeduction ? '직접 차감' : '직접 지급'), 
        status: 'Success' 
      },
      { 
        date: nowStr, 
        name: '국고(중앙은행)', 
        type: treasuryType, 
        amount: -val, 
        note: `${rewardTarget} ${rewardType} (${rewardReason || '수동 처리'})`, 
        status: 'Success' 
      }
    ]);

    setRewardAmt(''); setRewardReason('');
    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ ${rewardTarget} 대원에게 [${rewardType} ${amt}안] 처리가 완료되었습니다.`);
  };

  // 주급 일괄 지급 (본봉 + 단기 알바 수당 합산)
  const handlePaySalaries = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const approved = safeUsers.filter((u: any) => u.status === 'Approved');
    const rows: any[] = [];

    for (const u of approved) {
      const base = Number(u.salary || 140);
      const bonus = Number(u.bonus_salary || 0);
      const totalIncome = base + bonus;

      const tax = Math.floor(totalIncome * (taxRate / 100)) + Math.floor(totalIncome * (maintRate / 100));
      const repay = Math.min(Number(u.weekly_repay || 0), Number(u.loan_balance || 0));
      const net = totalIncome - tax - repay;

      const jobDesc = u.part_time_job ? `${u.job || '시민'} + ${u.part_time_job}` : (u.job || '시민');
      rows.push({ 
        date: nowStr, 
        name: u.name, 
        type: '주급', 
        amount: net, 
        note: `직무:${jobDesc}|총급여:${totalIncome}(기본${base}+알바${bonus})|세금:${tax}|상환:${repay}`, 
        status: 'Success' 
      });

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
    if (showAlert) showAlert('💸 전 대원 본봉 + 단기 알바 합산 주급 지급이 완료되었습니다!');
  };

  // 대출 발급
  const handleIssueLoan = async () => {
    if (!supabase) return;
    const amt = parseInt(loanAmt);
    if (!loanTarget || isNaN(amt) || amt <= 0) {
      if (showAlert) showAlert('⚠️ 학생과 대출금을 확인하세요.');
      return;
    }
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

  // ================= 3. 부동산 기능 (자리 배정 / 임대료 징수 / 경매시작가 재산정) =================
  // 자리 배정 및 임대료/낙찰가 개별 설정
  const handleUpdateSeat = async (seatNo: number) => {
    if (!supabase) return;
    const ownerInput = (document.getElementById(`owner-${seatNo}`) as HTMLSelectElement)?.value || '';
    const rentInput = parseInt((document.getElementById(`rent-${seatNo}`) as HTMLInputElement)?.value || '30');
    const floorInput = parseInt((document.getElementById(`floor-${seatNo}`) as HTMLInputElement)?.value || '30');

    await supabase.from('real_estate').update({
      owner: ownerInput,
      rent: rentInput,
      floor_price: floorInput
    }).eq('seat', seatNo);

    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ ${seatNo}번 좌석 정보가 저장되었습니다.`);
  };

  // 임대료 징수
  const handleCollectRent = async () => {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const rows: any[] = [];
    
    for (const s of safeSeats.filter((seat: any) => seat && seat.owner)) {
      const rentAmt = Number(s.rent || s.floor_price || 30);
      rows.push({ date: nowStr, name: s.owner, type: '임대료 납부', amount: -rentAmt, note: `${s.seat}번 좌석 주간 임대료`, status: 'Success' });
      rows.push({ date: nowStr, name: '국고(중앙은행)', type: '임대료 수입', amount: rentAmt, note: `${s.owner} 임대료`, status: 'Success' });
    }

    if (rows.length > 0) await supabase.from('transactions').insert(rows);
    if (loadData) await loadData();
    if (showAlert) showAlert('💸 모든 입주 학생의 임대료 징수가 완료되었습니다!');
  };

  // 경매 시작가 재산정 공식 적용: (경매 시작가) = (직전 낙찰가)*0.8 + (현재 낙찰가)*0.2
  const handleResetEstateSeason = async () => {
    if (!supabase) return;
    for (const s of safeSeats) {
      const prevFloor = Number(s.floor_price || 30); // 직전 기준가/낙찰가
      const currentWinningBid = Number(s.rent || prevFloor); // 이번 시즌 실제 낙찰/임대가
      
      // 공식: (직전 낙찰가 * 0.8) + (현재 낙찰가 * 0.2)
      let calculatedFloor = Math.floor((prevFloor * 0.8) + (currentWinningBid * 0.2));
      calculatedFloor = Math.max(10, Math.min(1000, calculatedFloor)); // 10안 ~ 1000안 범위 안전장치

      await supabase.from('real_estate').update({
        floor_price: calculatedFloor,
        rent: calculatedFloor,
        owner: '' // 새 시즌 시작을 위해 거주자 초기화(공실 전환)
      }).eq('seat', s.seat);
    }

    if (loadData) await loadData();
    if (showAlert) showAlert('🔄 공식[(직전가×0.8)+(현재가×0.2)]이 적용되어 전 좌석의 새 시즌 경매 시작가가 책정되고 공실 처리되었습니다.');
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

  // ================= 2. 상점 아이템 등록 / 수정 / 삭제 / 특가 토글 =================
  const handleRegisterShopItem = async () => {
    if (!supabase) return;
    if (!newItemName.trim() || !newItemPrice) {
      if (showAlert) showAlert('⚠️ 상품명과 가격을 입력하세요.');
      return;
    }
    await supabase.from('shop_items').insert([{
      item_id: `I_${Date.now()}`, 
      name: newItemName.trim(), 
      price: parseInt(newItemPrice),
      stock: parseInt(newItemStock || '10'), 
      max_per_user: parseInt(newItemMax || '1'),
      promotion: newItemPromo ? '특가' : '', 
      description: newItemDesc.trim(), 
      status: 'Active'
    }]);
    setNewItemName(''); setNewItemPrice(''); setNewItemDesc('');
    await loadShopItems();
    if (loadData) await loadData();
    if (showAlert) showAlert('🛍️ 새 상품이 상점에 정상 등록되었습니다.');
  };

  const handleUpdateShopItem = async (item: any) => {
    if (!supabase) return;
    const price = parseInt((document.getElementById(`price-${item.id}`) as HTMLInputElement)?.value || String(item.price));
    const stock = parseInt((document.getElementById(`stock-${item.id}`) as HTMLInputElement)?.value || String(item.stock));
    const name = (document.getElementById(`name-${item.id}`) as HTMLInputElement)?.value || item.name;

    await supabase.from('shop_items').update({ price, stock, name }).eq('id', item.id);
    setEditingItemId(null);
    await loadShopItems();
    if (loadData) await loadData();
    if (showAlert) showAlert(`✅ [${name}] 상품 정보가 수정되었습니다.`);
  };

  const handleTogglePromo = async (item: any) => {
    if (!supabase) return;
    const nextPromo = item.promotion === '특가' ? '' : '특가';
    await supabase.from('shop_items').update({ promotion: nextPromo }).eq('id', item.id);
    await loadShopItems();
    if (loadData) await loadData();
    if (showAlert) showAlert(`🏷️ [${item.name}] 특가 세일 뱃지가 ${nextPromo ? 'ON' : 'OFF'} 되었습니다.`);
  };

  const handleDeleteShopItem = async (id: number) => {
    if (!supabase) return;
    if (!confirm('정말 이 상품을 삭제하시겠습니까?')) return;
    await supabase.from('shop_items').delete().eq('id', id);
    await loadShopItems();
    if (loadData) await loadData();
    if (showAlert) showAlert('🗑️ 상품이 삭제되었습니다.');
  };

  // QR 검증
  const handleVerifySerial = async () => {
    if (!supabase || !serialInput.trim()) return;
    const { data: inv } = await supabase.from('inventory').select('*').eq('serial', serialInput.trim().toUpperCase()).single();
    if (!inv) {
      if (showAlert) showAlert('❌ 등록되지 않은 시리얼 번호입니다.');
      return;
    }
    if (inv.status === 'Used') {
      if (showAlert) showAlert('⚠️ 이미 사용이 완료된 쿠폰입니다.');
      return;
    }

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
      {showAlert && (
        <div className="fixed top-4 left-0 right-0 max-w-sm mx-auto px-4 z-[9999] pointer-events-none">
          {/* 부모 App에서 넘겨받은 alertMsg 표시 */}
        </div>
      )}
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
            { id: 'members', label: '👥 대원현황' },
            { id: 'reward', label: '🏆 수동입출금' },
            { id: 'salary', label: '💸 주급정산' },
            { id: 'loans', label: '🏦 대출/독촉' },
            { id: 'estate', label: '🏠 부동산' },
            { id: 'deposits', label: '💰 예금' },
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
                    <button onClick={() => handleResolvePending(t.id, 'Rejected', t.name, true, t.amount)} className="bg-rose-600 px-3 py-1.5 rounded-lg font-bold">거절</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1-2. 대원 전체 자산 & 직업 모니터링 대시보드 */}
        {adminTab === 'members' && (() => {
          const currentFundIdx = Number(fundData?.current_index || 1000);

          const studentStats = safeUsers
            .filter((u: any) => u && u.status === 'Approved')
            .map((u: any) => {
              const uTrans = safeTrans.filter((t: any) => t && t.name === u.name && t.status !== 'System' && t.status !== 'Rejected');
              const cash = uTrans.reduce((a: any, c: any) => a + Number(c.amount || 0), 0);
              const deposit = uTrans
                .filter((t: any) => t.status === 'Deposit_Active')
                .reduce((a: any, c: any) => a + Math.abs(Number(c.amount || 0)), 0);

              const fundTrans = uTrans.filter((t: any) => t.status?.startsWith('Fund_'));
              let fundEst = 0;
              fundTrans.forEach((t: any) => {
                const parts = (t.note || '').split('|');
                const baseIdx = parseFloat(parts[1]) || 1000;
                const buyAmt = Math.abs(Number(t.amount || 0));
                fundEst += Math.floor(buyAmt * (currentFundIdx / baseIdx));
              });

              const loan = Number(u.loan_balance || 0);
              const netWorth = cash + deposit + fundEst - loan;

              return { ...u, cash, deposit, fundEst, loan, netWorth };
            });

          const filtered = studentStats
            .filter((s: any) => s.name.includes(memberSearch.trim()))
            .sort((a: any, b: any) => {
              if (memberSort === 'netWorth') return b.netWorth - a.netWorth;
              if (memberSort === 'cash') return b.cash - a.cash;
              return a.name.localeCompare(b.name);
            });

          const totalNetWorth = studentStats.reduce((a: any, c: any) => a + c.netWorth, 0);
          const avgNetWorth = studentStats.length > 0 ? Math.floor(totalNetWorth / studentStats.length) : 0;

          return (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="font-bold text-sm text-indigo-400">👥 전 대원 프로필 및 자산 현황판</h3>
                  <p className="text-xs text-slate-400 mt-0.5">전체 {studentStats.length}명 대원의 현금, 예금, 펀드, 대출 및 순자산 현황입니다.</p>
                </div>
                <div className="flex gap-3 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span>총 순자산: <b className="text-emerald-400">{totalNetWorth.toLocaleString()}안</b></span>
                  <span className="text-slate-600">|</span>
                  <span>1인 평균: <b className="text-indigo-300">{avgNetWorth.toLocaleString()}안</b></span>
                </div>
              </div>

              <div className="flex gap-2 text-xs">
                <input 
                  type="text" 
                  placeholder="대원 이름 검색..." 
                  value={memberSearch} 
                  onChange={e => setMemberSearch(e.target.value)} 
                  className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-white outline-none focus:border-indigo-500"
                />
                <select 
                  value={memberSort} 
                  onChange={e => setMemberSort(e.target.value as any)} 
                  className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-slate-300 outline-none focus:border-indigo-500"
                >
                  <option value="netWorth">순자산 많은 순</option>
                  <option value="cash">보유 현금 많은 순</option>
                  <option value="name">이름 가나다순</option>
                </select>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 pl-3">대원명</th>
                        <th className="p-2.5">직무 (본직+알바)</th>
                        <th className="p-2.5 text-right">보유 현금</th>
                        <th className="p-2.5 text-right">예금</th>
                        <th className="p-2.5 text-right">펀드평가</th>
                        <th className="p-2.5 text-right">대출금</th>
                        <th className="p-2.5 pr-3 text-right">순자산</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filtered.map((s: any, idx: number) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition">
                          <td className="p-2.5 pl-3 font-bold text-white whitespace-nowrap">
                            <span className="text-[10px] text-slate-500 mr-1.5">{idx + 1}.</span>
                            {s.name}
                          </td>
                          <td className="p-2.5 text-slate-300 whitespace-nowrap">
                            <span className="text-indigo-300 font-bold">{s.job || '우주 시민'}</span>
                            {s.part_time_job && (
                              <span className="text-emerald-400 ml-1 text-[10px] bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                +{s.part_time_job}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-200 whitespace-nowrap">
                            {s.cash.toLocaleString()}안
                          </td>
                          <td className="p-2.5 text-right text-indigo-300 whitespace-nowrap">
                            {s.deposit > 0 ? `${s.deposit.toLocaleString()}안` : '-'}
                          </td>
                          <td className="p-2.5 text-right text-purple-300 whitespace-nowrap">
                            {s.fundEst > 0 ? `${s.fundEst.toLocaleString()}안` : '-'}
                          </td>
                          <td className="p-2.5 text-right text-rose-400 whitespace-nowrap">
                            {s.loan > 0 ? `-${s.loan.toLocaleString()}안` : '-'}
                          </td>
                          <td className="p-2.5 pr-3 text-right font-bold text-emerald-400 text-xs whitespace-nowrap">
                            {s.netWorth.toLocaleString()}안
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. 수동 입출금 관리 (상/벌금 및 직접 사유) */}
        {adminTab === 'reward' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="font-bold text-sm text-indigo-400">🏆 수동 입출금 관리 (상/벌금 및 직접 입력 사유)</h3>
              <p className="text-xs text-slate-400 mt-1">상금, 벌금 외에도 이벤트 보상, 청소 보너스 등 원하는 사유를 적어 즉시 입출금할 수 있습니다.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <select 
                value={rewardTarget} 
                onChange={e => setRewardTarget(e.target.value)} 
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500"
              >
                <option value="">대상 대원 선택</option>
                {safeUsers.filter((u: any) => u && u.status === 'Approved').map((u: any) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>

              <select 
                value={rewardType} 
                onChange={e => setRewardType(e.target.value as any)} 
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500"
              >
                <option value="상금(+)">🏆 상금 (+)</option>
                <option value="기타 입금(+)">➕ 직접 입금 (+)</option>
                <option value="벌금(-)">🚨 벌금 (-)</option>
                <option value="기타 출금(-)">➖ 직접 차감 (-)</option>
              </select>

              <input 
                type="number" 
                placeholder="금액 (안)" 
                value={rewardAmt} 
                onChange={e => setRewardAmt(e.target.value)} 
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500" 
              />

              <input 
                type="text" 
                placeholder="사유 (예: 퀴즈 우승, 교구 파손)" 
                value={rewardReason} 
                onChange={e => setRewardReason(e.target.value)} 
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-indigo-500" 
              />
            </div>

            <button 
              onClick={handleRewardPenalty} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-xs shadow-lg transition"
            >
              장부 반영 실행
            </button>
          </div>
        )}

        {/* 3. 주급 정산, 직업 관리(신규 등록/삭제) & 단기 알바 */}
        {adminTab === 'salary' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-sm text-indigo-400">💰 주급 정산 & 직업 / 단기 알바 관제</h3>
                <p className="text-[11px] text-slate-400">직업 등록·배정 및 단기 알바 수당을 합산하여 주급을 자동 정산합니다.</p>
              </div>
              <span className="text-xs text-slate-400">
                대상: <b className="text-white">{safeUsers.filter((u: any) => u && u.status === 'Approved').length}명</b>
              </span>
            </div>

            {/* 신규 직업 프리셋 추가 & 등록된 직업 목록 */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <p className="font-bold text-xs text-indigo-300">➕ 신규 직업 프리셋 추가</p>
              <div className="flex gap-2 text-xs">
                <input 
                  type="text" 
                  placeholder="새 직업명 (예: 국세청장)" 
                  value={newJobTitle} 
                  onChange={e => setNewJobTitle(e.target.value)} 
                  className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded-lg font-bold text-white outline-none focus:border-indigo-500"
                />
                <input 
                  type="number" 
                  placeholder="기본급 (안)" 
                  value={newJobSalary} 
                  onChange={e => setNewJobSalary(e.target.value)} 
                  className="w-24 bg-slate-900 border border-slate-700 p-2 rounded-lg font-bold text-yellow-400 outline-none focus:border-indigo-500 text-center"
                />
                <button 
                  onClick={() => {
                    if (!newJobTitle.trim() || !newJobSalary) {
                      if (showAlert) showAlert('⚠️ 직업명과 기본급을 입력하세요.');
                      return;
                    }
                    setCustomJobs(prev => ({ ...prev, [newJobTitle.trim()]: parseInt(newJobSalary) }));
                    setNewJobTitle('');
                    setNewJobSalary('');
                    if (showAlert) showAlert(`✅ [${newJobTitle.trim()}] 직업(기본급 ${newJobSalary}안)이 추가되었습니다.`);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold text-white text-xs transition"
                >
                  추가
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(customJobs).map(([title, sal]) => (
                  <span key={title} className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700/80 text-[10px] px-2 py-0.5 rounded-md text-slate-300">
                    <span className="font-bold text-indigo-300">{title}</span>
                    <span className="text-yellow-400">({sal}안)</span>
                    <button 
                      onClick={() => {
                        const updated = { ...customJobs };
                        delete updated[title];
                        setCustomJobs(updated);
                      }} 
                      className="text-slate-500 hover:text-rose-400 ml-0.5 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* 세율 / 유지비 설정 */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400">세율 (%)</label>
                <input 
                  type="number" 
                  value={taxRate} 
                  onChange={e => setTaxRate(Number(e.target.value))} 
                  className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400">유지비 (%)</label>
                <input 
                  type="number" 
                  value={maintRate} 
                  onChange={e => setMaintRate(Number(e.target.value))} 
                  className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 대원별 직업 배정 및 정산 표 */}
            <div className="space-y-2 pt-1">
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 pl-3">대원명</th>
                        <th className="p-2.5">본 직업 (기본급)</th>
                        <th className="p-2.5">단기 알바 (수당)</th>
                        <th className="p-2.5 text-center">총 급여</th>
                        <th className="p-2.5 text-center">공제</th>
                        <th className="p-2.5 text-center">상환</th>
                        <th className="p-2.5 text-right">실지급</th>
                        <th className="p-2.5 pr-3 text-center">반영</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {safeUsers
                        .filter((u: any) => u && u.status === 'Approved')
                        .map((u: any) => {
                          const base = Number(u.salary || 140);
                          const bonus = Number(u.bonus_salary || 0);
                          const totalIncome = base + bonus;
                          const tax = Math.floor(totalIncome * (taxRate / 100)) + Math.floor(totalIncome * (maintRate / 100));
                          const repay = Math.min(Number(u.weekly_repay || 0), Number(u.loan_balance || 0));
                          const net = totalIncome - tax - repay;

                          return (
                            <tr key={u.id} className="hover:bg-slate-900/40">
                              <td className="p-2.5 pl-3 font-bold text-white whitespace-nowrap">{u.name}</td>
                              
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <select 
                                    defaultValue={u.job || '우주 시민'}
                                    id={`job-${u.id}`}
                                    onChange={(e) => {
                                      const sal = customJobs[e.target.value];
                                      if (sal !== undefined) {
                                        const salInput = document.getElementById(`sal-${u.id}`) as HTMLInputElement;
                                        if (salInput) salInput.value = String(sal);
                                      }
                                    }}
                                    className="w-32 bg-slate-900 border border-slate-700 px-1.5 py-1 rounded text-indigo-200 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  >
                                    {Object.entries(customJobs).map(([title, sal]) => (
                                      <option key={title} value={title}>
                                        {title} ({sal}안)
                                      </option>
                                    ))}
                                  </select>
                                  <input 
                                    type="number" 
                                    defaultValue={base}
                                    id={`sal-${u.id}`}
                                    className="w-14 bg-slate-900 border border-slate-700 px-1 py-1 rounded text-yellow-400 font-bold text-[11px] outline-none focus:border-indigo-500 text-center"
                                  />
                                </div>
                              </td>

                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="text" 
                                    defaultValue={u.part_time_job || ''}
                                    id={`pt-job-${u.id}`}
                                    placeholder="알바명"
                                    className="w-24 bg-slate-900 border border-slate-700 px-1.5 py-1 rounded text-emerald-300 text-[11px] outline-none focus:border-emerald-500"
                                  />
                                  <input 
                                    type="number" 
                                    defaultValue={bonus}
                                    id={`bonus-${u.id}`}
                                    placeholder="수당"
                                    className="w-12 bg-slate-900 border border-slate-700 px-1 py-1 rounded text-emerald-400 font-bold text-[11px] text-center outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </td>

                              <td className="p-2.5 text-center font-bold text-white whitespace-nowrap">{totalIncome}안</td>
                              <td className="p-2.5 text-center text-rose-400 whitespace-nowrap">-{tax}안</td>
                              <td className="p-2.5 text-center text-amber-400 whitespace-nowrap">{repay > 0 ? `-${repay}안` : '0안'}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-400 whitespace-nowrap">+{net}안</td>
                              
                              <td className="p-2 pr-3 text-center">
                                <button 
                                  onClick={async () => {
                                    const jobInput = (document.getElementById(`job-${u.id}`) as HTMLSelectElement)?.value;
                                    const salInput = (document.getElementById(`sal-${u.id}`) as HTMLInputElement)?.value;
                                    const ptJobInput = (document.getElementById(`pt-job-${u.id}`) as HTMLInputElement)?.value;
                                    const bonusInput = (document.getElementById(`bonus-${u.id}`) as HTMLInputElement)?.value;

                                    await supabase.from('users').update({ 
                                      job: jobInput, 
                                      salary: parseInt(salInput || '140'),
                                      part_time_job: ptJobInput,
                                      bonus_salary: parseInt(bonusInput || '0')
                                    }).eq('id', u.id);
                                    
                                    if (loadData) await loadData();
                                    if (showAlert) showAlert(`✅ ${u.name} 대원 설정 저장 완료!`);
                                  }}
                                  className="bg-indigo-600/40 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-200 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                                >
                                  저장
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <button 
              onClick={handlePaySalaries} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm shadow-lg transition"
            >
              전원 주급 입금 및 자동 징수 실행
            </button>
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

        {/* ================= 3. 좌석 부동산 관리 (배정/임대료/공식 재산정) ================= */}
        {adminTab === 'estate' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-indigo-400">🗺️ 교실 좌석 부동산 관리 (1~25번)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  좌석별 낙찰 대원을 배정하고 임대료를 징수합니다. 시즌 종료 시 <b>(직전가×0.8 + 현재가×0.2)</b> 공식으로 새 시작가가 책정됩니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCollectRent} className="bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition">
                  임대료 일괄 징수
                </button>
                <button onClick={handleResetEstateSeason} className="bg-amber-600 hover:bg-amber-500 px-3.5 py-2 rounded-xl font-bold text-xs shadow-lg transition">
                  새 시즌 경매시작가 재산정
                </button>
              </div>
            </div>

            {/* 좌석 그리드 배정 & 가격 설정 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {Array.from({ length: 25 }, (_, i) => i + 1).map((seatNo) => {
                const s = safeSeats.find((seat: any) => Number(seat.seat) === seatNo) || { seat: seatNo, floor_price: 30, rent: 30, owner: '' };
                const isOccupied = !!s.owner;

                return (
                  <div key={seatNo} className={`p-3.5 rounded-xl border transition ${isOccupied ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs text-white">🪑 {seatNo}번 좌석</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isOccupied ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                        {isOccupied ? '입주완료' : '공실'}
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">낙찰/배정 대원</label>
                        <select 
                          id={`owner-${seatNo}`}
                          defaultValue={s.owner || ''} 
                          className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-white font-bold outline-none focus:border-indigo-500 text-xs"
                        >
                          <option value="">공실 (없음)</option>
                          {safeUsers.filter((u: any) => u && u.status === 'Approved').map((u: any) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">경매시작가</label>
                          <input 
                            type="number" 
                            id={`floor-${seatNo}`}
                            defaultValue={s.floor_price || 30}
                            className="w-full bg-slate-900 border border-slate-700 p-1 rounded-lg text-yellow-400 font-bold text-center text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">낙찰가(임대료)</label>
                          <input 
                            type="number" 
                            id={`rent-${seatNo}`}
                            defaultValue={s.rent || s.floor_price || 30}
                            className="w-full bg-slate-900 border border-slate-700 p-1 rounded-lg text-emerald-400 font-bold text-center text-xs outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => handleUpdateSeat(seatNo)}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-1.5 rounded-lg font-bold text-[11px] transition"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. 예금 관리 */}
        {adminTab === 'deposits' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-indigo-400">💰 정기예금 수탁 및 만기 관리</h3>
                <p className="text-xs text-slate-400 mt-1">만기 도래 시 이자소득세(15%)를 원천징수 후 세후 원리금을 학생 계좌로 자동 입금합니다.</p>
              </div>
              <button 
                onClick={handleMatureAllDeposits} 
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shadow-lg transition"
              >
                만기 도래분 일괄 지급 실행
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-300 flex items-center gap-1.5">
                <span>📋</span> 현재 운용 중인 학생 예금 목록 ({safeTrans.filter((t: any) => t && t.status === 'Deposit_Active').length}건)
              </h4>

              {safeTrans.filter((t: any) => t && t.status === 'Deposit_Active').length === 0 ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  현재 활성화된 정기예금 가입 내역이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {safeTrans
                    .filter((t: any) => t && t.status === 'Deposit_Active')
                    .map((d: any) => {
                      const noteParts = Object.fromEntries(
                        (d.note || '').split('|').map((p: string) => {
                          const [k, ...v] = p.split(':');
                          return [k ? k.trim() : '', v.join(':').trim()];
                        })
                      );
                      const prin = parseInt(noteParts['원금'] || String(Math.abs(d.amount || 0)));
                      const rate = parseInt(noteParts['이율'] || '0');
                      const expiry = noteParts['만기'] || '미정';
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = expiry <= today;
                      const expectedInt = Math.floor(prin * (rate / 100));

                      return (
                        <div key={d.id} className={`p-4 rounded-xl border transition ${isExpired ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950 border-slate-800'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-white">{d.name} 대원</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isExpired ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                              {isExpired ? '만기 도래' : '예치 중'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 mb-2">
                            <div>
                              <p className="text-[10px] text-slate-400">가입 원금</p>
                              <p className="font-bold text-white mt-0.5">{prin.toLocaleString()}안</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">약정 이율</p>
                              <p className="font-bold text-indigo-400 mt-0.5">{rate}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">만기 예상 수령</p>
                              <p className="font-bold text-emerald-400 mt-0.5">{(prin + Math.floor(expectedInt * 0.85)).toLocaleString()}안</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>가입일: {d.date ? d.date.split('. ').slice(0, 3).join('.') : '-'}</span>
                            <span className={isExpired ? 'text-amber-400 font-bold' : ''}>만기일: {expiry}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 2. 상점 관리 & 신규 등록 / 목록 수정 / 특가 토글 ================= */}
        {adminTab === 'store' && (
          <div className="space-y-5">
            {/* 신규 상품 등록 폼 */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">🛍️ 신규 아이템 등록</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <input type="text" placeholder="아이템 이름" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold text-white outline-none focus:border-indigo-500" />
                <input type="number" placeholder="가격 (안)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold text-white outline-none focus:border-indigo-500" />
                <input type="number" placeholder="재고 수량" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold text-white outline-none focus:border-indigo-500" />
                <input type="text" placeholder="설명 (선택)" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-bold text-white outline-none focus:border-indigo-500" />
              </div>
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={newItemPromo} onChange={e => setNewItemPromo(e.target.checked)} className="rounded accent-indigo-600" /> 
                  <span>📢 '특가 세일' 뱃지 달기</span>
                </label>
                <button onClick={handleRegisterShopItem} className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition">
                  상점에 아이템 출시
                </button>
              </div>
            </div>

            {/* 등록된 상점 아이템 목록 (수정 / 삭제 / 특가 토글) */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-indigo-400">📦 상점 판매 아이템 관리 ({shopItemsList.length}개)</h3>
                <button onClick={loadShopItems} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                  <RefreshCw size={12}/> 새로고침
                </button>
              </div>

              {shopItemsList.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">등록된 상품이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {shopItemsList.map((item: any) => (
                    <div key={item.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="text" 
                          id={`name-${item.id}`} 
                          defaultValue={item.name} 
                          className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-white font-bold text-xs outline-none focus:border-indigo-500"
                        />
                        {item.promotion === '특가' && (
                          <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/30">
                            특가 세일
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">가격</span>
                          <input 
                            type="number" 
                            id={`price-${item.id}`} 
                            defaultValue={item.price} 
                            className="w-16 bg-slate-900 border border-slate-700 px-1.5 py-1 rounded text-yellow-400 font-bold text-center outline-none"
                          />
                          <span className="text-slate-400 text-[10px]">안</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">재고</span>
                          <input 
                            type="number" 
                            id={`stock-${item.id}`} 
                            defaultValue={item.stock} 
                            className="w-14 bg-slate-900 border border-slate-700 px-1.5 py-1 rounded text-white font-bold text-center outline-none"
                          />
                          <span className="text-slate-400 text-[10px]">개</span>
                        </div>

                        <button 
                          onClick={() => handleTogglePromo(item)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[10px] border transition ${
                            item.promotion === '특가' 
                              ? 'bg-rose-600 text-white border-rose-500' 
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          특가 {item.promotion === '특가' ? 'ON' : 'OFF'}
                        </button>

                        <button 
                          onClick={() => handleUpdateShopItem(item)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] transition"
                        >
                          수정 저장
                        </button>

                        <button 
                          onClick={() => handleDeleteShopItem(item.id)}
                          className="bg-rose-950/60 hover:bg-rose-900 border border-rose-600/40 text-rose-300 p-1.5 rounded-lg transition"
                        >
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

        {/* ================= 1. 전체 장부 감사 (학생명 검색 필터 적용) ================= */}
        {adminTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
              <h3 className="font-bold text-sm text-indigo-400">📜 거래 장부 감사(Audit)</h3>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* 🔍 1. 학생명 검색창 */}
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="학생명 검색..." 
                    value={auditSearchName} 
                    onChange={e => setAuditSearchName(e.target.value)} 
                    className="bg-slate-950 border border-slate-800 px-3 py-1.5 pl-8 rounded-xl text-xs text-white placeholder-slate-500 font-bold outline-none focus:border-indigo-500"
                  />
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                  {auditSearchName && (
                    <button 
                      onClick={() => setAuditSearchName('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button 
                    onClick={() => setAuditFilter('student')} 
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'student' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    👤 학생
                  </button>
                  <button 
                    onClick={() => setAuditFilter('treasury')} 
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'treasury' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                  >
                    🏛️ 국고
                  </button>
                  <button 
                    onClick={() => setAuditFilter('all')} 
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${auditFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                  >
                    전체
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {safeTrans
                .filter((t: any) => {
                  // 1) 탭 필터
                  if (auditFilter === 'student' && t.name === '국고(중앙은행)') return false;
                  if (auditFilter === 'treasury' && t.name !== '국고(중앙은행)') return false;
                  // 2) 학생명 검색어 필터
                  if (auditSearchName.trim() && !t.name?.includes(auditSearchName.trim())) return false;
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
