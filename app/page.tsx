'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Wallet, Store, QrCode, TrendingUp, Settings, ShieldCheck, 
  ArrowRightLeft, Landmark, FileText, Sparkles, AlertTriangle, 
  CheckCircle, XCircle, RefreshCw, LogOut, Lock, User, 
  UserPlus, Camera, Receipt, Clock, Info
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [lang, setLang] = useState<'ko' | 'ru'>('ko');
  const t = (ko: string, ru: string) => (lang === 'ru' ? ru : ko);

  // 모드 상태: 'None' | 'Student' | 'Admin'
  const [loginMode, setLoginMode] = useState<'None' | 'Student' | 'Admin'>('None');

  // 로그인 & 회원가입 폼 상태
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'admin'>('login');
  const [loginName, setLoginName] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [adminPwInput, setAdminPwInput] = useState('');

  // 회원가입 전용 폼 상태
  const [regName, setRegName] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regTransferPw, setRegTransferPw] = useState('');

  // 실시간 유저 정보
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

  // 학생 탭 상태
  const [activeTab, setActiveTab] = useState<'wallet' | 'transfer' | 'withdraw' | 'deposit' | 'loan' | 'payslip' | 'store' | 'bag' | 'fund'>('wallet');
  const [adminTab, setAdminTab] = useState<'students' | 'salary' | 'loans' | 'estate' | 'funds' | 'freeze'>('students');

  // 폼 입력 상태
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferPw, setTransferPw] = useState('');

  // 예금 폼 상태
  const [depositType, setDepositType] = useState<'short' | 'long'>('long');
  const [depositAmt, setDepositAmt] = useState('');
  const [depositPw, setDepositPw] = useState('');

  // 대출 상환 폼 상태
  const [repayAmt, setRepayAmt] = useState('');
  const [repayPw, setRepayPw] = useState('');

  // 모달 및 알림
  const [selectedQr, setSelectedQr] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // -------------------------------------------------------------
  // DB 데이터 동기화
  // -------------------------------------------------------------
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

      const { data: funds } = await supabase.from('funds').select('*').limit(1).single();
      if (funds) setFundData(funds);

      const { data: configs } = await supabase.from('system_config').select('*');
      if (configs) {
        const vMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
        setIsFrozen(vMap.is_vacation === 'TRUE');
        setDepositOpen(vMap.deposit_open !== 'FALSE');
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

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // [인증 1] 학생 로그인
  // -------------------------------------------------------------
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      showAlert('⚠️ Supabase 연결 설정이 필요합니다.');
      return;
    }
    if (!loginName.trim() || !loginPw.trim()) {
      showAlert('⚠️ 이름과 비밀번호를 모두 입력해주세요.');
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('name', loginName.trim())
      .eq('password', loginPw.trim())
      .single();

    if (error || !data) {
      showAlert('❌ 등록되지 않은 대원이거나 비밀번호가 틀렸습니다.');
      return;
    }

    if (data.status === 'Pending') {
      showAlert('⏳ 선생님의 가입 승인을 기다리고 있습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setCurrentUser(data);
    setLoginMode('Student');
    loadBag(data.name);
    showAlert(`🚀 ${data.name} 대원, 환영합니다!`);
  };

  // -------------------------------------------------------------
  // [인증 2] 학생 회원가입
  // -------------------------------------------------------------
  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!regName.trim() || !regPw.trim()) {
      showAlert('⚠️ 이름과 비밀번호를 입력해주세요.');
      return;
    }

    const tpw = regTransferPw.trim() || regPw.trim();

    // 중복 체크
    const { data: existing } = await supabase.from('users').select('name').eq('name', regName.trim()).single();
    if (existing) {
      showAlert('⚠️ 이미 등록된 대원 이름입니다.');
      return;
    }

    const { error } = await supabase.from('users').insert([
      {
        name: regName.trim(),
        password: regPw.trim(),
        transfer_password: tpw,
        status: 'Pending',
        job: '우주 시민',
        loan_balance: 0,
        weekly_repay: 0
      }
    ]);

    if (!error) {
      showAlert('🎉 회원가입 신청 완료! 선생님의 승인 후 로그인할 수 있습니다.');
      setRegName('');
      setRegPw('');
      setRegTransferPw('');
      setAuthTab('login');
      loadData();
    } else {
      showAlert('❌ 가입 신청 중 오류가 발생했습니다.');
    }
  };

  // -------------------------------------------------------------
  // [인증 3] 교사/관리자 로그인
  // -------------------------------------------------------------
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPwInput.trim() === 'admin1234' || adminPwInput.trim() === '1234') {
      setLoginMode('Admin');
      setAdminPwInput('');
      showAlert('👨‍🏫 관리자 관제 센터에 접속했습니다.');
    } else {
      showAlert('🔒 관리자 비밀번호가 일치하지 않습니다.');
    }
  };

  // -------------------------------------------------------------
  // [기능 1] 송금 실행
  // -------------------------------------------------------------
  const handleTransfer = async () => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 송금이 불가합니다.'); return; }
    const amt = parseInt(transferAmt);
    if (isNaN(amt) || amt <= 0 || !transferTarget) { showAlert('⚠️ 받는 대원과 금액을 확인해주세요.'); return; }

    const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
    const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);
    const fee = myBalance >= 1000 ? 0 : 1;

    if (myBalance < amt + fee) { showAlert('⚠️ 보유 잔액이 부족합니다.'); return; }
    if (transferPw !== currentUser.transfer_password) { showAlert('❌ 송금 2차 비밀번호가 일치하지 않습니다.'); return; }

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const rows = [
      { date: nowStr, name: currentUser.name, type: '송금(출금)', amount: -amt, note: `${transferTarget} 송금`, status: 'Success' },
      { date: nowStr, name: transferTarget, type: '송금(입금)', amount: amt, note: `${currentUser.name} 입금`, status: 'Success' }
    ];

    if (fee > 0) {
      rows.push(
        { date: nowStr, name: currentUser.name, type: '송금 수수료', amount: -fee, note: '타행 송금 수수료', status: 'Success' },
        { date: nowStr, name: '국고(중앙은행)', type: '수수료 수입', amount: fee, note: `${currentUser.name} 송금 수수료`, status: 'Success' }
      );
    }

    await supabase!.from('transactions').insert(rows);
    setTransferAmt(''); setTransferPw(''); setActiveTab('wallet');
    await loadData();
    showAlert(`💸 ${transferTarget} 대원에게 ${amt}안을 보냈습니다!`);
  };

  // -------------------------------------------------------------
  // [기능 2] 정기예금 가입
  // -------------------------------------------------------------
  const handleDeposit = async () => {
    if (isFrozen) { showAlert('❄️ 방학 기간 동안은 예금 가입이 중단됩니다.'); return; }
    if (!depositOpen) { showAlert('🏦 현재 예금 가입 기간이 아닙니다.'); return; }

    const amt = parseInt(depositAmt);
    if (isNaN(amt) || amt < 10) { showAlert('⚠️ 최소 10안 이상부터 예금 가능합니다.'); return; }

    const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
    const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);
    if (myBalance < amt) { showAlert('⚠️ 통장 잔액이 부족합니다.'); return; }

    if (depositPw !== currentUser.transfer_password) { showAlert('❌ 결제용 비밀번호가 일치하지 않습니다.'); return; }

    const days = depositType === 'short' ? 7 : 28;
    const rate = depositType === 'short' ? 3 : 15;
    const now = new Date();
    const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nowStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    await supabase!.from('transactions').insert([
      {
        date: nowStr,
        name: currentUser.name,
        type: '예금 가입',
        amount: -amt,
        note: `만기:${expiryDate}|이율:${rate}|원금:${amt}`,
        status: 'Deposit_Active'
      }
    ]);

    setDepositAmt(''); setDepositPw(''); setActiveTab('wallet');
    await loadData();
    showAlert(`🏦 ${amt}안이 정기예금(${rate}%)에 안전하게 예치되었습니다! (만기일: ${expiryDate})`);
  };

  // -------------------------------------------------------------
  // [기능 3] 상점 아이템 구매
  // -------------------------------------------------------------
  const handleBuyItem = async (item: any) => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 상점 이용이 불가합니다.'); return; }
    if (item.stock <= 0) { showAlert('⚠️ 재고가 모두 소진되었습니다.'); return; }

    const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
    const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);
    if (myBalance < item.price) { showAlert('⚠️ 통장 잔액이 부족합니다.'); return; }

    const now = new Date();
    const nowStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const expiryStr = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const serialCode = 'SN-' + Math.floor(100000 + Math.random() * 900000);

    await supabase!.from('transactions').insert([
      { date: nowStr, name: currentUser.name, type: '상점 결제', amount: -item.price, note: `상품 구매: ${item.name}`, status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: '상점 수입', amount: item.price, note: `${currentUser.name} 구매`, status: 'Success' }
    ]);

    await supabase!.from('inventory').insert([
      { date: nowStr, name: currentUser.name, item_id: item.item_id, item_name: item.name, serial: serialCode, status: 'Unused', expiry: expiryStr }
    ]);

    await supabase!.from('shop_items').update({ stock: item.stock - 1 }).eq('item_id', item.item_id);

    await loadData();
    await loadBag(currentUser.name);
    showAlert(`🎉 '${item.name}' 구매 완료! [가방] 탭에서 QR을 확인하세요.`);
  };

  // -------------------------------------------------------------
  // [기능 4] 대출 자진 상환
  // -------------------------------------------------------------
  const handleLoanRepay = async () => {
    const amt = parseInt(repayAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('⚠️ 올바른 상환 금액을 입력하세요.'); return; }

    const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
    const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);
    if (myBalance < amt) { showAlert('⚠️ 통장 잔액이 부족합니다.'); return; }

    if (repayPw !== currentUser.transfer_password) { showAlert('❌ 결제용 비밀번호가 일치하지 않습니다.'); return; }

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    await supabase!.from('transactions').insert([
      { date: nowStr, name: currentUser.name, type: '자진 대출 상환', amount: -amt, note: '학생 직접 상환', status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: amt, note: `${currentUser.name} 상환`, status: 'Success' }
    ]);

    const newLoan = Math.max(0, currentUser.loan_balance - amt);
    await supabase!.from('users').update({ loan_balance: newLoan, dunning: newLoan === 0 ? '' : currentUser.dunning }).eq('name', currentUser.name);

    setRepayAmt(''); setRepayPw(''); setActiveTab('wallet');
    await loadData();
    showAlert(`💸 ${amt}안 대출 상환이 성공적으로 처리되었습니다!`);
  };

  // =============================================================
  // 1. 로그인 / 회원가입 화면
  // =============================================================
  if (loginMode === 'None') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        {alertMsg && <div className="fixed top-6 bg-indigo-600 px-5 py-3 rounded-2xl z-50 text-xs font-bold animate-bounce shadow-2xl max-w-xs text-center">{alertMsg}</div>}
        
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-indigo-600/20 rounded-2xl border border-indigo-500/30 text-4xl mb-1">🚀</div>
            <h1 className="text-2xl font-black text-indigo-400">우주 디지털 학급은행</h1>
            <p className="text-xs text-slate-400">화성 테라포밍 자치 정부 경제 포털</p>
          </div>

          {notice && (
            <div className="bg-indigo-950/60 border border-indigo-500/30 p-3.5 rounded-2xl text-xs text-indigo-200">
              ✨ <strong>공지:</strong> {notice}
            </div>
          )}

          {/* 인증 탭 선택 (로그인 / 회원가입 / 관리자) */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setAuthTab('login')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${authTab === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              학생 로그인
            </button>
            <button
              onClick={() => setAuthTab('signup')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${authTab === 'signup' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              대원 회원가입
            </button>
            <button
              onClick={() => setAuthTab('admin')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${authTab === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              선생님 센터
            </button>
          </div>

          {/* 학생 로그인 폼 */}
          {authTab === 'login' && (
            <form onSubmit={handleStudentLogin} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">대원 이름</label>
                <input 
                  type="text" 
                  placeholder="예: 최정호" 
                  value={loginName} 
                  onChange={e => setLoginName(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">로그인 비밀번호</label>
                <input 
                  type="password" 
                  placeholder="비밀번호 입력" 
                  value={loginPw} 
                  onChange={e => setLoginPw(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm shadow-lg transition mt-2 flex items-center justify-center gap-2"
              >
                <User size={18} /> 통장 접속하기
              </button>
            </form>
          )}

          {/* 회원가입 폼 */}
          {authTab === 'signup' && (
            <form onSubmit={handleStudentSignup} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">내 이름</label>
                <input 
                  type="text" 
                  placeholder="실명 입력 (예: 김우주)" 
                  value={regName} 
                  onChange={e => setRegName(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">로그인 비밀번호 설정</label>
                <input 
                  type="password" 
                  placeholder="접속용 비밀번호" 
                  value={regPw} 
                  onChange={e => setRegPw(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">송금/결제용 2차 비밀번호 (선택)</label>
                <input 
                  type="password" 
                  placeholder="미입력 시 로그인 비번과 동일" 
                  value={regTransferPw} 
                  onChange={e => setRegTransferPw(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3.5 rounded-xl font-bold text-sm shadow-lg transition mt-2 flex items-center justify-center gap-2"
              >
                <UserPlus size={18} /> 가입 신청 제출하기
              </button>
            </form>
          )}

          {/* 관리자 로그인 폼 */}
          {authTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 ml-1">선생님 마스터 비밀번호</label>
                <input 
                  type="password" 
                  placeholder="관리자 비번 입력" 
                  value={adminPwInput} 
                  onChange={e => setAdminPwInput(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-bold text-sm text-slate-200 border border-slate-700 transition mt-2 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={18} /> 관제 센터 접속
              </button>
            </form>
          )}

          <div className="flex justify-center pt-2">
            <button 
              onClick={() => setLang(lang === 'ko' ? 'ru' : 'ko')}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              🌐 {lang === 'ko' ? 'Русский переключить' : '한국어로 전환'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // 2. 관리자 화면
  // =============================================================
  if (loginMode === 'Admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24">
        {alertMsg && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 px-5 py-3 rounded-2xl z-50 text-xs font-bold">{alertMsg}</div>}
        
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👨‍🏫</span>
            <div><h1 className="font-bold text-indigo-400">학급 중앙은행 관제 데스크</h1><p className="text-xs text-slate-400">Supabase 실시간 클라우드 연동</p></div>
          </div>
          <button onClick={() => setLoginMode('None')} className="text-xs bg-slate-800 px-3 py-2 rounded-xl text-slate-300 flex items-center gap-1"><LogOut size={14}/> 로그아웃</button>
        </header>

        <main className="max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'students', label: '👥 학생 승인/관리' },
              { id: 'salary', label: '💸 주급 일괄 정산' },
              { id: 'loans', label: '🏦 대출/독촉 관리' },
              { id: 'estate', label: '🏠 좌석 부동산' },
              { id: 'freeze', label: '❄️ 방학/점검 모드' }
            ].map(m => (
              <button key={m.id} onClick={() => setAdminTab(m.id as any)} className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${adminTab === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {adminTab === 'students' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-yellow-400">👥 등록된 대원 명단 ({userList.length}명)</h3>
              <div className="space-y-2">
                {userList.map(u => (
                  <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                    <div>
                      <p className="font-bold text-white">{u.name} ({u.job})</p>
                      <p className="text-slate-400">대출 잔액: {u.loan_balance}안 | 상태: <strong className={u.status === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}>{u.status}</strong></p>
                    </div>
                    {u.status === 'Pending' ? (
                      <button 
                        onClick={async () => { 
                          await supabase!.from('users').update({ status: 'Approved' }).eq('id', u.id); 
                          loadData(); 
                          showAlert(`✅ ${u.name} 대원의 가입을 승인했습니다!`); 
                        }} 
                        className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg font-bold text-white"
                      >
                        승인하기
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[11px]">승인됨</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'salary' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">💰 주급 일괄 지급 (세율 10% 자동 차감)</h3>
              <p className="text-xs text-slate-400">승인된 모든 대원에게 기본급 140안에서 세금(14안)을 뺀 126안을 일괄 입금합니다.</p>
              <button 
                onClick={async () => {
                  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                  const rows = userList.filter(u => u.status === 'Approved').map(u => ({
                    date: nowStr, name: u.name, type: '주급', amount: 126, note: '기본:140|세금:14', status: 'Success'
                  }));
                  await supabase!.from('transactions').insert(rows);
                  loadData();
                  showAlert('💸 전원 주급 126안 입금이 완료되었습니다!');
                }} 
                className="w-full bg-indigo-600 py-3.5 rounded-xl font-bold text-sm"
              >
                전원 주급 126안 일괄 지급 실행
              </button>
            </div>
          )}

          {adminTab === 'loans' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-rose-400">🚨 대출 연체자 독촉장 발송</h3>
              <div className="space-y-2">
                {userList.filter(u => u.loan_balance > 0).map(u => (
                  <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                    <div>
                      <p className="font-bold text-white">{u.name}</p>
                      <p className="text-rose-400 font-bold">대출 잔액: {u.loan_balance} 안</p>
                    </div>
                    <button 
                      onClick={async () => {
                        const newDun = u.dunning === 'ON' ? '' : 'ON';
                        await supabase!.from('users').update({ dunning: newDun }).eq('id', u.id);
                        loadData();
                        showAlert(`독촉장 상태를 [${newDun || 'OFF'}]로 변경했습니다.`);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold ${u.dunning === 'ON' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {u.dunning === 'ON' ? '독촉장 켜짐' : '독촉장 발송'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // =============================================================
  // 3. 학생 모드 메인 화면
  // =============================================================
  const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
  
  // 내 현금 잔액 (예금 제외)
  const myCashTrans = myTrans.filter(t => t.status !== 'Deposit_Active');
  const myBalance = myCashTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);

  // 내 정기예금 잔액
  const myDepositTrans = myTrans.filter(t => t.status === 'Deposit_Active');
  const myDepositBalance = myDepositTrans.reduce((acc, cur) => acc + Math.abs(Number(cur.amount)), 0);

  return (
    <div className="max-w-md mx-auto bg-slate-950 min-h-screen shadow-2xl pb-28 text-white">
      {alertMsg && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 px-5 py-3 rounded-2xl z-50 text-xs font-bold animate-bounce shadow-xl w-[90%] text-center">{alertMsg}</div>}

      {/* 헤더 */}
      <header className="bg-gradient-to-b from-indigo-700 to-indigo-900 p-6 rounded-b-[2rem] shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="font-black text-xs tracking-wider text-indigo-200">SPACE CLASS BANK</span>
          <button onClick={() => setLoginMode('None')} className="bg-black/30 p-1.5 rounded-full text-xs border border-white/10"><LogOut size={14} /></button>
        </div>
        <p className="text-xs text-indigo-200">{currentUser.name} 대원 ({currentUser.job})</p>
        <div className="text-4xl font-black text-yellow-300 mt-1">{myBalance.toLocaleString()} <span className="text-lg text-yellow-400">안</span></div>
        <div className="flex gap-2 pt-2">
          <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-yellow-400/30">
            {myBalance >= 1000 ? '👑 은하 대부호' : myBalance >= 500 ? '🚀 행성 개척자' : '👨‍🚀 우주 시민'}
          </span>
          {myDepositBalance > 0 && (
            <span className="bg-blue-400/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-400/30">
              🏦 예금: {myDepositBalance.toLocaleString()}안
            </span>
          )}
        </div>
      </header>

      {/* 독촉장 경고 배너 */}
      {currentUser.dunning === 'ON' && !isFrozen && (
        <div className="bg-rose-900/60 border-l-4 border-rose-500 p-3 mx-4 mt-4 rounded-r-xl text-xs text-rose-200">
          🚨 <strong>중앙은행 독촉장:</strong> 대출이 연체되었습니다. [대출상환]에서 즉시 갚아주세요!
        </div>
      )}

      {/* 본문 탭 */}
      <main className="p-4 space-y-4">
        {/* [홈 탭] */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => setActiveTab('transfer')} className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 shadow transition">
                <ArrowRightLeft size={20} /> 송금
              </button>
              <button onClick={() => setActiveTab('deposit')} className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 transition">
                <Landmark size={20} className="text-yellow-400" /> 정기예금
              </button>
              <button onClick={() => setActiveTab('loan')} className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 transition">
                <AlertTriangle size={20} className={currentUser.loan_balance > 0 ? "text-rose-400" : "text-slate-400"} /> 대출상환
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-xs text-slate-400">최근 내역</h3>
              <div className="space-y-2">
                {myTrans.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 last:border-none">
                    <div><p className="font-bold text-slate-200">{t.note || t.type}</p><p className="text-[10px] text-slate-500">{t.date}</p></div>
                    <span className={`font-black ${Number(t.amount) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(t.amount) > 0 ? `+${t.amount}` : t.amount} 안
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* [정기예금 탭] */}
        {activeTab === 'deposit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-yellow-400 text-sm flex items-center gap-2">
              <Landmark size={16}/> 정기예금 가입 센터
            </h2>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => setDepositType('short')} 
                className={`p-3 rounded-xl border text-center font-bold transition ${depositType === 'short' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                벼락치기 단기<br/><span className="text-[10px] text-slate-400">1주 (7일) / 이율 3%</span>
              </button>
              <button 
                onClick={() => setDepositType('long')} 
                className={`p-3 rounded-xl border text-center font-bold transition ${depositType === 'long' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                거북이 장기<br/><span className="text-[10px] text-slate-400">4주 (28일) / 이율 15%</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-400">예금할 금액 (최소 10안 ~ 최대 300안)</label>
              <input 
                type="number" 
                placeholder="예치 금액 입력" 
                value={depositAmt} 
                onChange={e => setDepositAmt(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-bold" 
              />
              <label className="block text-slate-400 pt-1">결제용 2차 비밀번호</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={depositPw} 
                onChange={e => setDepositPw(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white font-bold" 
              />
            </div>

            <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
              <p>💡 <strong>만기 시 세후 예상 수령액 안내</strong></p>
              <p className="text-[10px] text-slate-400">만기 이자 수령 시 소득세(15%)가 원천 징수되어 국고로 귀속됩니다.</p>
            </div>

            <button onClick={handleDeposit} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-xs shadow-lg transition">
              정기예금 계좌 개설하기
            </button>

            {/* 현재 가입된 내 예금 목록 */}
            {myDepositTrans.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300">내 운용 중인 예금</h4>
                {myDepositTrans.map(d => (
                  <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{d.note}</p>
                      <p className="text-[10px] text-slate-500">가입일: {d.date}</p>
                    </div>
                    <span className="font-black text-yellow-400">{Math.abs(d.amount)} 안</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* [송금 탭] */}
        {activeTab === 'transfer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><ArrowRightLeft size={16}/> 안전 송금</h2>
            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white">
              <option value="">받는 대원 선택</option>
              {userList.filter(u => u.name !== currentUser.name && u.status === 'Approved').map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.job})</option>
              ))}
            </select>
            <input type="number" placeholder="보낼 금액 (안)" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white" />
            <input type="password" placeholder="송금 비밀번호" value={transferPw} onChange={e => setTransferPw(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white" />
            <button onClick={handleTransfer} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-xs shadow-lg transition">송금 실행</button>
          </div>
        )}

        {/* [대출 상환 탭] */}
        {activeTab === 'loan' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-rose-400 text-sm flex items-center gap-2"><AlertTriangle size={16}/> 대출금 상환</h2>
            <div className="p-4 bg-rose-950/40 rounded-xl text-center border border-rose-500/20">
              <p className="text-xs text-rose-300">남은 대출 잔액</p>
              <p className="text-2xl font-black text-rose-400">{currentUser.loan_balance} 안</p>
            </div>
            <input type="number" placeholder="상환할 금액" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white" />
            <input type="password" placeholder="비밀번호" value={repayPw} onChange={e => setRepayPw(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white" />
            <button onClick={handleLoanRepay} className="w-full bg-rose-600 hover:bg-rose-500 py-3.5 rounded-xl font-bold text-xs shadow-lg transition">상환하기</button>
          </div>
        )}

        {/* [상점 탭] */}
        {activeTab === 'store' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🛒 우주 매점</h2>
            {shopItems.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                <div><h3 className="font-bold text-xs">{item.name}</h3><p className="text-[10px] text-slate-500">재고: {item.stock}개 | 가격: {item.price}안</p></div>
                <button onClick={() => handleBuyItem(item)} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-xs font-bold transition">구매</button>
              </div>
            ))}
          </div>
        )}

        {/* [가방 탭] */}
        {activeTab === 'bag' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🎒 내 쿠폰 가방</h2>
            {bagItems.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">보유한 쿠폰이 없습니다.</div>
            ) : (
              bagItems.map(b => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                  <div><h3 className="font-bold text-xs">{b.item_name}</h3><p className="text-[10px] text-indigo-400">SN: {b.serial} (~{b.expiry})</p></div>
                  <button onClick={() => setSelectedQr(b)} className="bg-slate-800 px-3 py-1.5 rounded-xl text-xs border border-slate-700 font-bold">QR 보기</button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* QR 모달 */}
      {selectedQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-4">
            <h3 className="font-bold text-sm text-white">{selectedQr.item_name}</h3>
            <div className="bg-white p-5 rounded-2xl inline-block">
              <QrCode size={90} className="text-black" />
              <p className="text-[11px] font-mono text-black font-bold mt-2">{selectedQr.serial}</p>
            </div>
            <button onClick={() => setSelectedQr(null)} className="w-full bg-slate-800 py-2.5 rounded-xl text-xs border border-slate-700 font-bold">닫기</button>
          </div>
        </div>
      )}

      {/* 하단 고정 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-around p-3 rounded-t-3xl z-40">
        {[
          { id: 'wallet', label: '통장', icon: Wallet },
          { id: 'deposit', label: '예금', icon: Landmark },
          { id: 'store', label: '상점', icon: Store },
          { id: 'bag', label: '가방', icon: QrCode }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center px-4 ${activeTab === tab.id ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
            <tab.icon size={20} />
            <span className="text-[10px] mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
