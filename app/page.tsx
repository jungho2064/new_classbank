'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Wallet, Store, QrCode, TrendingUp, Settings, ShieldCheck, 
  ArrowRightLeft, Landmark, FileText, AlertTriangle, 
  User, UserPlus, Receipt, LogOut, ChevronLeft, Loader2
} from 'lucide-react';
import AdminPanel from './admin-panel';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [lang, setLang] = useState<'ko' | 'ru'>('ko');
  const [loginMode, setLoginMode] = useState<'None' | 'Student' | 'Admin'>('None');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [loginName, setLoginName] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [adminPwInput, setAdminPwInput] = useState('');

  const [regName, setRegName] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regTransferPw, setRegTransferPw] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [bagItems, setBagItems] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [fundData, setFundData] = useState<any>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(true);
  const [notice, setNotice] = useState('');

  const [activeTab, setActiveTab] = useState<'wallet' | 'transfer' | 'withdraw' | 'deposit' | 'loan' | 'payslip' | 'settings' | 'store' | 'bag' | 'fund'>('wallet');

  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferPw, setTransferPw] = useState('');

  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawPw, setWithdrawPw] = useState('');

  const [depositType, setDepositType] = useState<'short' | 'long'>('long');
  const [depositAmt, setDepositAmt] = useState('');
  const [depositPw, setDepositPw] = useState('');

  const [repayAmt, setRepayAmt] = useState('');
  const [repayPw, setRepayPw] = useState('');
  const [newLoginPw, setNewLoginPw] = useState('');

  const [selectedQr, setSelectedQr] = useState<any>(null);

  // 알림 토스트 팝업 상태
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  // 💡 학생 전용 비동기 작업 잠금 & 동글뱅이 로딩 상태
  const [isProcessing, setIsProcessing] = useState(false);
  const [studentLoadingText, setStudentLoadingText] = useState<string | null>(null);

  // 학생 작업 실행 래퍼 함수 (광클/오조작 방지 락 + 최소 0.6초 동글뱅이 회전)
  const runStudentTask = async (taskName: string, action: () => Promise<void>) => {
    if (isProcessing) return; // 이미 작업 중이면 중복 클릭 원천 차단
    setIsProcessing(true);
    setStudentLoadingText(taskName);

    const minDelay = new Promise(res => setTimeout(res, 600)); // 최소 0.6초 보장
    try {
      await Promise.all([action(), minDelay]);
    } finally {
      setIsProcessing(false);
      setStudentLoadingText(null);
    }
  };

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    if (msg.includes('❌') || msg.includes('불가') || msg.includes('부족') || msg.includes('실패')) {
      setAlertType('error');
    } else if (msg.includes('⚠️') || msg.includes('경고') || msg.includes('도래')) {
      setAlertType('warning');
    } else if (msg.includes('✅') || msg.includes('완료') || msg.includes('성공') || msg.includes('입금')) {
      setAlertType('success');
    } else {
      setAlertType('info');
    }

    setTimeout(() => {
      setAlertMsg(null);
    }, 3000);
  };

  const loadData = async () => {
    if (!supabase) return;
    try {
      const { data: users } = await supabase.from('users').select('*');
      if (users) {
        setUserList(users);
        if (currentUser) {
          const updated = users.find(u => u.name === currentUser.name);
          if (updated) setCurrentUser(updated);
        }
      }
      const { data: trans } = await supabase.from('transactions').select('*').order('id', { ascending: false });
      if (trans) setTransactions(trans);

      const { data: shop } = await supabase.from('shop_items').select('*').eq('status', 'Active');
      if (shop) setShopItems(shop);

      const { data: estate } = await supabase.from('real_estate').select('*').order('seat', { ascending: true });
      if (estate) setSeats(estate);

      const { data: funds } = await supabase.from('funds').select('*').order('id', { ascending: true });
      if (funds) setFundData(funds);

      const { data: configs } = await supabase.from('system_config').select('*');
      if (configs) {
        const vMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
        setIsFrozen(String(vMap.is_vacation || '').toUpperCase() === 'TRUE');
        setDepositOpen(String(vMap.deposit_open || 'TRUE').toUpperCase() === 'TRUE');
        setNotice(vMap.maintenance_notice || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadBag = async (userName: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('inventory').select('*').eq('name', userName).order('id', { ascending: false });
    if (data) setBagItems(data);
  };

  useEffect(() => { loadData(); }, []);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPw.trim()) { showAlert('⚠️ 이름과 비밀번호를 입력해주세요.'); return; }
    
    await runStudentTask('대원 인증 및 통장 동기화 중...', async () => {
      const { data, error } = await supabase!.from('users').select('*').eq('name', loginName.trim()).eq('password', loginPw.trim()).single();
      if (error || !data) { showAlert('❌ 대원 이름 또는 비밀번호가 틀렸습니다.'); return; }
      if (data.status === 'Pending') { showAlert('⏳ 선생님의 승인을 기다리고 있습니다.'); return; }
      setCurrentUser(data);
      setLoginMode('Student');
      loadBag(data.name);
      showAlert(`🚀 ${data.name} 대원 환영합니다!`);
      setLoginPw('');
    });
  };

  const handleLogout = () => {
    setLoginMode('None');
    setCurrentUser(null);
    setLoginName('');
    setLoginPw('');
    setAdminPwInput('');
  };

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPw.trim()) { showAlert('⚠️ 필수 정보를 입력해주세요.'); return; }
    
    await runStudentTask('대원 가입 신청서 전송 중...', async () => {
      const { error } = await supabase!.from('users').insert([{
        name: regName.trim(), password: regPw.trim(), transfer_password: regTransferPw.trim() || regPw.trim(),
        status: 'Pending', job: '우주 시민', loan_balance: 0, weekly_repay: 0
      }]);
      if (!error) {
        showAlert('🎉 가입 신청 완료! 선생님의 승인 후 로그인하세요.');
        setShowSignupModal(false);
        await loadData();
      } else showAlert('⚠️ 이미 존재하는 이름입니다.');
    });
  };

  const handleTransfer = async () => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 송금이 불가합니다.'); return; }
    const amt = parseInt(transferAmt);
    if (!transferTarget || isNaN(amt) || amt <= 0) { showAlert('⚠️ 정보를 확인해주세요.'); return; }
    const myBalance = transactions.filter(t => t.name === currentUser?.name && t.status !== 'Rejected' && t.status !== 'Deposit_Active').reduce((a, c) => a + Number(c.amount || 0), 0);
    const fee = myBalance >= 1000 ? 0 : 1;
    if (myBalance < amt + fee) { showAlert('⚠️ 잔액이 부족합니다.'); return; }
    if (transferPw !== currentUser?.transfer_password) { showAlert('❌ 2차 비밀번호가 틀렸습니다.'); return; }

    await runStudentTask(`💸 [${transferTarget}] 대원에게 ${amt}안 송금 처리 중...`, async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const rows: any[] = [
        { date: nowStr, name: currentUser.name, type: '송금(출금)', amount: -amt, note: `${transferTarget} 송금`, status: 'Success' },
        { date: nowStr, name: transferTarget, type: '송금(입금)', amount: amt, note: `${currentUser.name} 입금`, status: 'Success' }
      ];
      if (fee > 0) rows.push({ date: nowStr, name: currentUser.name, type: '송금 수수료', amount: -fee, note: '타행 송금 수수료', status: 'Success' });
      await supabase!.from('transactions').insert(rows);
      setTransferAmt(''); setTransferPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(`💸 ${transferTarget} 대원에게 ${amt}안 송금 완료!`);
    });
  };

  const handleWithdraw = async () => {
    const amt = parseInt(withdrawAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('⚠️ 금액을 확인하세요.'); return; }
    if (myBalance < amt) { showAlert('❌ 출금 신청 금액이 보유 잔액보다 많습니다.'); return; }

    await runStudentTask('🏧 현금 출금 전표 발행 중...', async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase!.from('transactions').insert([{ date: nowStr, name: currentUser?.name, type: '현금 출금', amount: -amt, note: '사전 신청', status: 'Pending_W' }]);
      setWithdrawAmt(''); setWithdrawPw(''); setActiveTab('wallet');
      await loadData();
      showAlert('🏧 출금 신청 접수 완료!');
    });
  };

  const handleDeposit = async () => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 예금 가입이 불가합니다.'); return; }
    if (!depositOpen) { showAlert('🔒 현재 정기예금 가입 창구가 닫혀 있습니다.'); return; }
    const amt = parseInt(depositAmt);
    if (isNaN(amt) || amt < 10) { showAlert('⚠️ 최소 10안 이상부터 가능합니다.'); return; }
    if (myBalance < amt) { showAlert(`❌ 보유 잔액(${myBalance}안)을 초과하여 예금에 가입할 수 없습니다.`); return; }

    const days = depositType === 'short' ? 7 : 28;
    const rate = depositType === 'short' ? 3 : 15;
    const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    await runStudentTask(`🏛️ 정기예금(${rate}%) 신규 계좌 개설 중...`, async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase!.from('transactions').insert([
        { date: nowStr, name: currentUser?.name, type: '예금 가입', amount: -amt, note: `만기:${expiry}|이율:${rate}|원금:${amt}`, status: 'Deposit_Active' },
        { date: nowStr, name: '국고(중앙은행)', type: '예금 예치금', amount: amt, note: `${currentUser?.name} 예금 수탁`, status: 'Success' }
      ]);
      setDepositAmt(''); setDepositPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(`🏦 정기예금(${rate}%) 가입 완료!`);
    });
  };

  const handleLoanRepay = async () => {
    const currentLoan = Number(currentUser?.loan_balance || 0);
    if (currentLoan <= 0) { showAlert('🎉 현재 갚아야 할 대출금이 없습니다.'); return; }

    const amt = parseInt(repayAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('⚠️ 상환할 금액을 정확히 입력하세요.'); return; }
    if (amt > currentLoan) { showAlert(`⚠️ 남은 대출 잔액(${currentLoan}안) 이하로만 상환할 수 있습니다.`); return; }
    if (myBalance < amt) { showAlert('❌ 통장 잔액이 부족하여 상환할 수 없습니다.'); return; }
    if (repayPw !== currentUser?.transfer_password) { showAlert('❌ 결제용 비밀번호가 일치하지 않습니다.'); return; }

    await runStudentTask('대출금 상환 및 담보 정리 중...', async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase!.from('transactions').insert([
        { date: nowStr, name: currentUser?.name, type: '자진 대출 상환', amount: -amt, note: '학생 직접 상환', status: 'Success' },
        { date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: amt, note: `${currentUser?.name} 상환`, status: 'Success' }
      ]);

      const nextLoan = Math.max(0, currentLoan - amt);
      await supabase!.from('users').update({ 
        loan_balance: nextLoan, 
        weekly_repay: nextLoan === 0 ? 0 : currentUser?.weekly_repay,
        dunning: nextLoan === 0 ? '' : currentUser?.dunning 
      }).eq('name', currentUser?.name);

      setRepayAmt(''); setRepayPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(`💸 ${amt}안 대출 상환이 완료되었습니다! (남은 대출: ${nextLoan}안)`);
    });
  };

  const handleBuyItem = async (item: any) => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 상점을 이용할 수 없습니다.'); return; }
    if (myBalance < item.price) { showAlert('❌ 잔액이 부족하여 아이템을 구매할 수 없습니다.'); return; }

    await runStudentTask(`🛒 [${item.name}] 구매 및 쿠폰 시리얼 발급 중...`, async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const serial = 'SN-' + Math.floor(100000 + Math.random() * 900000);
      await supabase!.from('transactions').insert([{ date: nowStr, name: currentUser?.name, type: '상점 결제', amount: -item.price, note: `상품 구매: ${item.name}`, status: 'Success' }]);
      await supabase!.from('inventory').insert([{ date: nowStr, name: currentUser?.name, item_id: item.item_id, item_name: item.name, serial, status: 'Unused', expiry: '2026-08-31' }]);
      await supabase!.from('shop_items').update({ stock: item.stock - 1 }).eq('item_id', item.item_id);
      await loadData();
      await loadBag(currentUser?.name);
      showAlert(`🎉 '${item.name}' 구매 완료! [가방]에서 확인하세요.`);
    });
  };

  // 관리자 패널 렌더링
  if (loginMode === 'Admin') {
    return (
      <AdminPanel 
        supabase={supabase} 
        userList={userList} 
        transactions={transactions} 
        seats={seats} 
        fundData={fundData} 
        isFrozen={isFrozen} 
        depositOpen={depositOpen} 
        setDepositOpen={setDepositOpen} 
        loadData={loadData} 
        showAlert={showAlert} 
        alertMsg={alertMsg} 
        alertType={alertType}
        onLogout={handleLogout} 
      />
    );
  }

  // 로그인 전 메인
  if (loginMode === 'None') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 relative">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <div className="text-4xl mb-1">🚀</div>
            <h1 className="text-2xl font-black text-indigo-400">우주 디지털 학급은행</h1>
            <p className="text-xs text-slate-400">화성 테라포밍 경제 포털</p>
          </div>
          {notice && <div className="bg-indigo-950/60 p-3 rounded-2xl text-xs text-indigo-200 border border-indigo-500/30">✨ {notice}</div>}
          <form onSubmit={handleStudentLogin} className="space-y-3">
            <input type="text" placeholder="대원 이름 (실명)" value={loginName} onChange={e => setLoginName(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-50"/>
            <input type="password" placeholder="비밀번호" value={loginPw} onChange={e => setLoginPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-50"/>
            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 py-3.5 rounded-xl font-bold text-sm shadow-lg transition disabled:opacity-50">통장 접속하기</button>
          </form>
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button onClick={() => setShowSignupModal(true)} disabled={isProcessing} className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"><UserPlus size={16}/> 처음 왔나요? 회원가입 신청</button>
            <button onClick={() => setShowAdminModal(true)} disabled={isProcessing} className="w-full bg-slate-800 text-slate-400 py-2.5 rounded-xl font-bold text-xs border border-slate-700/60 flex items-center justify-center gap-1 active:scale-95 transition disabled:opacity-50"><ShieldCheck size={15}/> 선생님 관제 센터</button>
          </div>
        </div>

        {showSignupModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-3">
              <h3 className="font-bold text-emerald-400">대원 회원가입</h3>
              <form onSubmit={handleStudentSignup} className="space-y-2.5 text-xs">
                <input type="text" placeholder="실명 입력" value={regName} onChange={e => setRegName(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <input type="password" placeholder="접속 비밀번호" value={regPw} onChange={e => setRegPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <input type="password" placeholder="송금 비밀번호(선택)" value={regTransferPw} onChange={e => setRegTransferPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowSignupModal(false)} disabled={isProcessing} className="flex-1 bg-slate-800 py-2.5 rounded-xl font-bold">취소</button>
                  <button type="submit" disabled={isProcessing} className="flex-1 bg-emerald-600 py-2.5 rounded-xl font-bold">신청 완료</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full space-y-3 text-center">
              <h3 className="font-bold text-indigo-400">선생님 접속</h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (adminPwInput === 'admin1234' || adminPwInput === '1234') {
                    setLoginMode('Admin');
                    setShowAdminModal(false);
                  } else {
                    showAlert('비밀번호 불일치');
                  }
                }} 
                className="space-y-3"
              >
                <input 
                  type="password" 
                  autoFocus
                  placeholder="마스터 비밀번호" 
                  value={adminPwInput} 
                  onChange={e => setAdminPwInput(e.target.value)} 
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold text-center text-xs outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAdminModal(false)} 
                    className="flex-1 bg-slate-800 py-2 rounded-xl text-xs"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl text-xs font-bold"
                  >
                    접속
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 최상단 알림 팝업 */}
        {alertMsg && (
          <div style={{ zIndex: 99999 }} className="fixed top-5 left-1/2 -translate-x-1/2 max-w-md w-[90%] sm:w-auto transition-all">
            <div className={`px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs font-bold ${
              alertType === 'error' 
                ? 'bg-rose-950/90 border-rose-500/80 text-rose-200' 
                : alertType === 'warning'
                ? 'bg-amber-950/90 border-amber-500/80 text-amber-200'
                : alertType === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200'
                : 'bg-indigo-950/90 border-indigo-500/80 text-indigo-200'
            }`}>
              <span>{alertMsg}</span>
              <button type="button" onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-white ml-2 text-sm font-bold">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 💡 학생 전용 화면 잠금 동글뱅이 스피너 */}
        {studentLoadingText && (
          <div style={{ zIndex: 999999 }} className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs mx-auto animate-in fade-in zoom-in duration-200">
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">{studentLoadingText}</p>
                <p className="text-[11px] text-slate-400">데이터를 안전하게 처리하고 있습니다...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 학생 메인 화면
  const myTrans = transactions.filter(t => t.name === currentUser?.name && t.status !== 'System' && t.status !== 'Rejected');
  const myBalance = myTrans.reduce((a, c) => a + Number(c.amount || 0), 0);
  const myDepositBalance = myTrans.filter(t => t.status === 'Deposit_Active').reduce((a, c) => a + Math.abs(Number(c.amount || 0)), 0);

  return (
    <div className="max-w-md mx-auto bg-slate-950 min-h-screen shadow-2xl pb-28 text-white relative">
      {/* 최상단 알림 팝업 */}
      {alertMsg && (
        <div style={{ zIndex: 99999 }} className="fixed top-5 left-1/2 -translate-x-1/2 max-w-md w-[90%] sm:w-auto transition-all">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs font-bold ${
            alertType === 'error' 
              ? 'bg-rose-950/90 border-rose-500/80 text-rose-200' 
              : alertType === 'warning'
              ? 'bg-amber-950/90 border-amber-500/80 text-amber-200'
              : alertType === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200'
              : 'bg-indigo-950/90 border-indigo-500/80 text-indigo-200'
          }`}>
            <span>{alertMsg}</span>
            <button type="button" onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-white ml-2 text-sm font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 💡 학생 전용 화면 잠금 동글뱅이 스피너 (버튼 연타 방지) */}
      {studentLoadingText && (
        <div style={{ zIndex: 999999 }} className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs mx-auto animate-in fade-in zoom-in duration-200">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-white">{studentLoadingText}</p>
              <p className="text-[11px] text-slate-400">데이터를 안전하게 처리하고 있습니다...</p>
            </div>
          </div>
        </div>
      )}

      {/* 학생 상단 헤더 */}
      <header className="bg-gradient-to-b from-indigo-700 to-indigo-900 p-6 rounded-b-[2rem] shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="font-black text-xs text-indigo-200">SPACE CLASS BANK</span>
          <button onClick={handleLogout} className="bg-black/30 p-1.5 rounded-full text-xs hover:bg-black/50 transition">
            <LogOut size={14}/>
          </button>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-white">{currentUser?.name} 대원</span>
          <span className="text-xs text-indigo-200">({currentUser?.job || '우주 시민'})</span>
          {currentUser?.part_time_job && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
              🛠️ 알바: {currentUser.part_time_job} (+{currentUser.bonus_salary || 0}안)
            </span>
          )}
        </div>

        <div className="text-4xl font-black text-yellow-300 mt-1">
          {myBalance.toLocaleString()} <span className="text-lg text-yellow-400">안</span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2">
          <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-yellow-400/30">
            {myBalance >= 1000 ? '👑 은하 대부호' : '👨‍🚀 우주 시민'}
          </span>

          {myDepositBalance > 0 && (
            <span className="bg-blue-400/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-400/30">
              🏦 예금: {myDepositBalance.toLocaleString()}안
            </span>
          )}

          {(() => {
            const mySeat = seats.find((s: any) => s && s.owner === currentUser?.name);
            if (mySeat) {
              return (
                <span className="bg-indigo-400/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-400/30 flex items-center gap-1">
                  🪑 좌석: {mySeat.seat}번 (주 {mySeat.rent || mySeat.floor_price || 30}안)
                </span>
              );
            }
            return (
              <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700">
                🪑 좌석: 미배정 (공실)
              </span>
            );
          })()}
        </div>
      </header>

      {currentUser?.dunning === 'ON' && !isFrozen && (
        <div className="bg-rose-900/60 p-3 mx-4 mt-4 rounded-xl text-xs text-rose-200 border-l-4 border-rose-500">
          🚨 <strong>중앙은행 독촉장:</strong> 대출이 연체되었습니다. 즉시 상환해주세요!
        </div>
      )}

      <main className="p-4 space-y-4">
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => setActiveTab('transfer')} disabled={isProcessing} className="bg-indigo-600 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 shadow active:scale-95 transition disabled:opacity-50"><ArrowRightLeft size={18}/> 송금</button>
              <button onClick={() => setActiveTab('deposit')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><Landmark size={18} className="text-yellow-400"/> 정기예금</button>
              <button onClick={() => setActiveTab('loan')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><AlertTriangle size={18} className={currentUser?.loan_balance > 0 ? "text-rose-400" : "text-slate-400"}/> 대출상환</button>
              <button onClick={() => setActiveTab('withdraw')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><Receipt size={18} className="text-indigo-300"/> 현금출금</button>
              <button onClick={() => setActiveTab('payslip')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><FileText size={18} className="text-emerald-400"/> 명세서</button>
              <button onClick={() => setActiveTab('settings')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><Settings size={18} className="text-slate-400"/> 비번관리</button>
              <button onClick={() => setActiveTab('fund')} disabled={isProcessing} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50"><TrendingUp size={18} className="text-purple-400"/> 펀드투자</button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h3 className="font-bold text-xs text-slate-400">최근 입출금 내역</h3>
              {myTrans.slice(0, 5).map(t => (
                <div key={t.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 last:border-none">
                  <div><p className="font-bold">{t.note || t.type}</p><p className="text-[10px] text-slate-500">{t.date}</p></div>
                  <span className={`font-black ${Number(t.amount) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(t.amount) > 0 ? `+${t.amount}` : t.amount} 안</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center"><h2 className="font-bold text-indigo-400 text-sm">안전 송금</h2><button onClick={() => setActiveTab('wallet')} disabled={isProcessing}><ChevronLeft size={16}/></button></div>
            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"><option value="">받는 대원 선택</option>{userList.filter(u => u.name !== currentUser?.name && u.status === 'Approved').map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select>
            <input type="number" placeholder="보낼 금액" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <input type="password" placeholder="송금 비밀번호" value={transferPw} onChange={e => setTransferPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <button onClick={handleTransfer} disabled={isProcessing} className="w-full bg-indigo-600 py-3 rounded-xl font-bold active:scale-95 transition disabled:opacity-50">송금 실행</button>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center"><h2 className="font-bold text-indigo-400 text-sm">현금 출금 사전 신청</h2><button onClick={() => setActiveTab('wallet')} disabled={isProcessing}><ChevronLeft size={16}/></button></div>
            <input type="number" placeholder="출금액" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <input type="password" placeholder="비밀번호" value={withdrawPw} onChange={e => setWithdrawPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <button onClick={handleWithdraw} disabled={isProcessing} className="w-full bg-indigo-600 py-3 rounded-xl font-bold active:scale-95 transition disabled:opacity-50">신청하기</button>
          </div>
        )}

        {activeTab === 'deposit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-1">
              <h2 className="font-bold text-yellow-400 text-sm flex items-center gap-1.5">
                <span>🏛️</span> 정기예금 센터
              </h2>
              <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white p-1">
                <ChevronLeft size={18}/>
              </button>
            </div>

            {/* 내가 가입한 예금 현황 목록 */}
            <div className="space-y-2">
              <p className="font-bold text-slate-300 flex items-center justify-between text-xs">
                <span>📋 내 예금 보유 현황</span>
                <span className="text-[11px] text-indigo-400 font-normal">
                  총 {myTrans.filter((t: any) => t.status === 'Deposit_Active').length}건
                </span>
              </p>

              {myTrans.filter((t: any) => t.status === 'Deposit_Active').length === 0 ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-slate-500">
                  현재 가입 중인 정기예금이 없습니다.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {myTrans
                    .filter((t: any) => t.status === 'Deposit_Active')
                    .map((d: any) => {
                      const parts = Object.fromEntries(
                        (d.note || '').split('|').map((p: string) => {
                          const [k, ...v] = p.split(':');
                          return [k ? k.trim() : '', v.join(':').trim()];
                        })
                      );
                      const prin = parseInt(parts['원금'] || String(Math.abs(d.amount || 0)));
                      const rate = parseInt(parts['이율'] || '0');
                      const expiry = parts['만기'] || '미정';
                      const expNet = prin + Math.floor(prin * (rate / 100) * 0.85);

                      return (
                        <div key={d.id} className="bg-slate-950 border border-indigo-500/30 p-3.5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-indigo-300">정기예금 ({rate}%)</span>
                            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                              만기일: {expiry}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-lg text-center">
                            <div>
                              <p className="text-[10px] text-slate-400">예치 원금</p>
                              <p className="font-bold text-white mt-0.5">{prin.toLocaleString()}안</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">만기 세후 수령액</p>
                              <p className="font-bold text-emerald-400 mt-0.5">+{expNet.toLocaleString()}안</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 신규 예금 가입 창구 */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <p className="font-bold text-slate-300">➕ 신규 예금 가입</p>
              {!depositOpen ? (
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-1.5">
                  <p className="text-xl">🔒</p>
                  <p className="text-xs font-bold text-slate-300">현재 신규 가입 창구가 닫혀 있습니다.</p>
                  <p className="text-[11px] text-slate-500">선생님이 예금 가입 기간을 오픈할 때까지 기다려주세요.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setDepositType('short')} 
                      disabled={isProcessing}
                      className={`p-3 rounded-xl border font-bold transition disabled:opacity-50 ${depositType === 'short' ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                    >
                      단기 (7일, 3%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDepositType('long')} 
                      disabled={isProcessing}
                      className={`p-3 rounded-xl border font-bold transition disabled:opacity-50 ${depositType === 'long' ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                    >
                      장기 (28일, 15%)
                    </button>
                  </div>
                  <input 
                    type="number" 
                    placeholder="예금할 금액 (최소 10안)" 
                    value={depositAmt} 
                    onChange={e => setDepositAmt(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <input 
                    type="password" 
                    placeholder="비밀번호" 
                    value={depositPw} 
                    onChange={e => setDepositPw(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleDeposit} 
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
                  >
                    예금 개설
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'loan' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-rose-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} /> 대출금 상환
              </h2>
              <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-xs text-slate-400 hover:text-white flex items-center gap-0.5">
                <ChevronLeft size={14} /> 뒤로가기
              </button>
            </div>

            {Number(currentUser?.loan_balance || 0) <= 0 ? (
              <div className="p-8 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                <p className="text-3xl">🎉</p>
                <p className="text-sm font-bold text-emerald-400">현재 갚아야 할 대출이 없습니다!</p>
                <p className="text-xs text-slate-500">대출금이 발생하면 이곳에서 자진 상환할 수 있습니다.</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-rose-950/40 rounded-xl text-center border border-rose-500/20">
                  <p className="text-xs text-rose-300">현재 남은 대출 잔액</p>
                  <p className="text-2xl font-black text-rose-400">{currentUser?.loan_balance} 안</p>
                </div>
                <div className="space-y-2 text-xs">
                  <label className="block text-slate-400">상환할 금액 (최대 {currentUser?.loan_balance}안)</label>
                  <input 
                    type="number" 
                    placeholder="금액 입력" 
                    value={repayAmt} 
                    onChange={e => setRepayAmt(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold text-white disabled:opacity-50"
                  />
                  <label className="block text-slate-400 pt-1">결제용 2차 비밀번호</label>
                  <input 
                    type="password" 
                    placeholder="••••" 
                    value={repayPw} 
                    onChange={e => setRepayPw(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold text-white disabled:opacity-50"
                  />
                </div>
                <button onClick={handleLoanRepay} disabled={isProcessing} className="w-full bg-rose-600 hover:bg-rose-500 active:scale-95 py-3.5 rounded-xl font-bold text-xs shadow-lg transition disabled:opacity-50">
                  대출금 상환하기
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'payslip' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center"><h2 className="font-bold text-indigo-400 text-sm">주급 및 임대료 명세서</h2><button onClick={() => setActiveTab('wallet')} disabled={isProcessing}><ChevronLeft size={16}/></button></div>
            {myTrans.filter(t => t.type === '주급' || t.type === '임대료 납부').map(t => (
              <div key={t.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between font-bold"><span className={t.type === '주급' ? 'text-emerald-400' : 'text-rose-400'}>{t.type}</span><span>{t.amount}안</span></div>
                <p className="text-[10px] text-slate-400 mt-1">{t.note} ({t.date})</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center"><h2 className="font-bold text-slate-300 text-sm">비밀번호 관리</h2><button onClick={() => setActiveTab('wallet')} disabled={isProcessing}><ChevronLeft size={16}/></button></div>
            <input type="password" placeholder="새 비밀번호" value={newLoginPw} onChange={e => setNewLoginPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <button onClick={async () => { await supabase!.from('users').update({ password: newLoginPw.trim() }).eq('name', currentUser?.name); setActiveTab('wallet'); showAlert('비밀번호 변경 완료!'); }} disabled={isProcessing} className="w-full bg-slate-800 active:scale-95 py-3 rounded-xl font-bold disabled:opacity-50">저장하기</button>
          </div>
        )}

        {/* 📈 학생 펀드 투자 센터 */}
        {activeTab === 'fund' && (() => {
          const fundsArray = Array.isArray(fundData) ? fundData : (fundData ? [fundData] : []);

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-800">
                <h2 className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                  <span>📈</span> 학급 경제 펀드 투자 센터
                </h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white p-1">
                  <ChevronLeft size={18}/>
                </button>
              </div>

              {fundsArray.length === 0 ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-500">
                  현재 운용 중인 펀드 상품이 없습니다.
                </div>
              ) : (
                fundsArray.map((f: any) => {
                  const currIdx = Number(f.current_index || 1000);
                  const baseIdx = Number(f.base_index || 1000);
                  const totalYield = (((currIdx - baseIdx) / baseIdx) * 100).toFixed(1);

                  // 내 가입 내역 확인
                  const myFundTrans = myTrans.filter((t: any) => t.status === `Fund_${f.fund_id}`);
                  let myInvestAmt = 0;
                  let myCurrentVal = 0;

                  myFundTrans.forEach((t: any) => {
                    const amt = Math.abs(Number(t.amount || 0));
                    const parts = (t.note || '').split('|');
                    const entryIdx = parseFloat(parts[1]) || 1000;
                    myInvestAmt += amt;
                    myCurrentVal += Math.floor(amt * (currIdx / entryIdx));
                  });

                  const myYield = myInvestAmt > 0 ? (((myCurrentVal - myInvestAmt) / myInvestAmt) * 100).toFixed(1) : '0.0';
                  const penaltyRate = Number(f.penalty_rate || 10);
                  const refundNet = Math.floor(myCurrentVal * (1 - penaltyRate / 100));

                  return (
                    <div key={f.fund_id} className="bg-slate-950 border border-purple-500/30 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-white">{f.name}</span>
                        <span className={`text-xs font-black ${Number(totalYield) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currIdx}p ({Number(totalYield) >= 0 ? `+${totalYield}` : totalYield}%)
                        </span>
                      </div>

                      {f.news && (
                        <div className="bg-slate-900/90 p-2.5 rounded-lg text-[11px] text-indigo-200 border border-indigo-500/20">
                          📰 <b>[어제의 뉴스]</b> {f.news}
                        </div>
                      )}
                      {f.hint && (
                        <div className="bg-slate-900/90 p-2.5 rounded-lg text-[11px] text-amber-200 border border-amber-500/20">
                          💡 <b>[오늘의 힌트]</b> {f.hint}
                        </div>
                      )}

                      {/* 내 투자 현황 */}
                      {myInvestAmt > 0 && (
                        <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-lg space-y-2">
                          <div className="flex justify-between font-bold">
                            <span className="text-purple-300">내 투자 원금: {myInvestAmt.toLocaleString()}안</span>
                            <span className={Number(myYield) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              평가액: {myCurrentVal.toLocaleString()}안 ({Number(myYield) >= 0 ? `+${myYield}` : myYield}%)
                            </span>
                          </div>

                          <button 
                            onClick={async () => {
                              if (isFrozen) { showAlert('❄️ 방학 중에는 환매할 수 없습니다.'); return; }
                              if (!confirm(`⚠️ 중도 해지 시 수수료(${penaltyRate}%)가 차감된 ${refundNet.toLocaleString()}안이 입금됩니다. 진행하시겠습니까?`)) return;

                              await runStudentTask(`📈 [${f.name}] 중도 환매 처리 중...`, async () => {
                                const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                                await supabase!.from('transactions').insert([
                                  { date: nowStr, name: currentUser?.name, type: '펀드 환매', amount: refundNet, note: `${f.name} 조기 환매`, status: 'Success' },
                                  { date: nowStr, name: '국고(중앙은행)', type: '펀드 환매 지급', amount: -refundNet, note: `${currentUser?.name} 환매`, status: 'Success' }
                                ]);
                                await supabase!.from('transactions').update({ status: `Fund_${f.fund_id}_Closed` }).eq('name', currentUser?.name).eq('status', `Fund_${f.fund_id}`);
                                await loadData();
                              });
                              showAlert(`✅ [${f.name}] 환매 대금 ${refundNet.toLocaleString()}안이 입금되었습니다.`);
                            }}
                            disabled={isProcessing}
                            className="w-full bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 py-1.5 rounded-lg font-bold text-[10px] active:scale-95 transition"
                          >
                            ⚡ 조기 환매 (수수료 {penaltyRate}% 차감 후 {refundNet.toLocaleString()}안 수령)
                          </button>
                        </div>
                      )}

                      {/* 신규 매수 폼 */}
                      <div className="pt-2 border-t border-slate-800 flex gap-2">
                        <input 
                          type="number" 
                          id={`fund-buy-${f.fund_id}`}
                          placeholder="투자할 금액 (최소 10안)" 
                          className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold text-xs outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={async () => {
                            if (isFrozen) { showAlert('❄️ 방학 중에는 펀드에 투자할 수 없습니다.'); return; }
                            const buyInput = document.getElementById(`fund-buy-${f.fund_id}`) as HTMLInputElement;
                            const amt = parseInt(buyInput?.value || '0');
                            if (isNaN(amt) || amt < 10) { showAlert('⚠️ 최소 10안 이상부터 투자 가능합니다.'); return; }
                            if (myBalance < amt) { showAlert('❌ 통장 잔액이 부족합니다.'); return; }

                            await runStudentTask(`📈 [${f.name}] 펀드 매수 중...`, async () => {
                              const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                              await supabase!.from('transactions').insert([
                                { date: nowStr, name: currentUser?.name, type: '펀드 가입', amount: -amt, note: `${f.name}|${currIdx}`, status: `Fund_${f.fund_id}` },
                                { date: nowStr, name: '국고(중앙은행)', type: '펀드 예치금', amount: amt, note: `${currentUser?.name} 가입 예치`, status: 'Success' }
                              ]);
                              buyInput.value = '';
                              await loadData();
                            });
                            showAlert(`🚀 [${f.name}] 펀드 ${amt.toLocaleString()}안 매수 완료!`);
                          }}
                          disabled={isProcessing}
                          className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white px-4 py-2 rounded-lg font-bold text-xs transition"
                        >
                          매수
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}

        {activeTab === 'store' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🛒 우주 매점</h2>
            {shopItems.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center text-xs">
                <div><h3 className="font-bold">{item.name}</h3><p className="text-[10px] text-slate-500">재고 {item.stock}개 | 가격 {item.price}안</p></div>
                <button onClick={() => handleBuyItem(item)} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-4 py-2 rounded-xl font-bold transition disabled:opacity-50">구매</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bag' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🎒 내 쿠폰 가방</h2>
            {bagItems.length === 0 ? <div className="text-center py-6 text-xs text-slate-500">가방이 비어 있습니다.</div> : bagItems.map(b => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center text-xs">
                <div><h3 className="font-bold">{b.item_name}</h3><p className="text-[10px] text-indigo-400">SN: {b.serial}</p></div>
                <button onClick={() => setSelectedQr(b)} disabled={isProcessing} className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 font-bold active:scale-95 transition disabled:opacity-50">QR 보기</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-3">
            <h3 className="font-bold text-sm">{selectedQr.item_name}</h3>
            <div className="bg-white p-4 rounded-2xl inline-block"><QrCode size={90} className="text-black"/><p className="text-[11px] font-mono text-black font-bold mt-1">{selectedQr.serial}</p></div>
            <button onClick={() => setSelectedQr(null)} className="w-full bg-slate-800 py-2 rounded-xl text-xs font-bold">닫기</button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-around p-3 rounded-t-3xl z-40">
        {[
          { id: 'wallet', label: '통장', icon: Wallet },
          { id: 'store', label: '상점', icon: Store },
          { id: 'bag', label: '가방', icon: QrCode }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} disabled={isProcessing} className={`flex flex-col items-center px-4 transition ${activeTab === tab.id || (tab.id === 'wallet' && !['store','bag'].includes(activeTab)) ? 'text-indigo-400 font-bold' : 'text-slate-500'} disabled:opacity-50`}>
            <tab.icon size={20}/>
            <span className="text-[10px] mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
