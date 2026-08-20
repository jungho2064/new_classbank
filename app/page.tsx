'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wallet, Store, QrCode, TrendingUp, Settings, ShieldCheck, 
  ArrowRightLeft, Landmark, FileText, Sparkles, AlertTriangle, 
  Calendar, CheckCircle, XCircle, RefreshCw, LogOut, Lock, User, PlusCircle, Trash2
} from 'lucide-react';

export default function App() {
  // 언어 설정 (ko: 한국어, ru: 러시아어)
  const [lang, setLang] = useState<'ko' | 'ru'>('ko');
  const t = (ko: string, ru: string) => (lang === 'ru' ? ru : ko);

  // 모드 상태
  const [loginMode, setLoginMode] = useState<'None' | 'Student' | 'Admin'>('None');

  // 학생 유저 상태
  const [user, setUser] = useState({
    name: '최정호',
    role: '우주 시민',
    balance: 1450,
    depositBalance: 300,
    loanBalance: 0,
    creditTier: '👑 은하 대부호 (수수료 면제)',
    transferPw: '1234'
  });

  // 학생 메인 탭 선택
  const [activeTab, setActiveTab] = useState<'wallet' | 'transfer' | 'deposit' | 'store' | 'bag' | 'fund'>('wallet');

  // 관리자 탭 선택
  const [adminTab, setAdminTab] = useState<'students' | 'salary' | 'estate' | 'funds' | 'freeze'>('students');

  // 거래 내역
  const [transactions, setTransactions] = useState([
    { id: 1, title: '2026-W33 주급 지급', amt: '+119', type: 'in', date: '08-14 14:00' },
    { id: 2, title: '우주 매점 간식 구매', amt: '-50', type: 'out', date: '08-13 11:20' },
    { id: 3, title: '김우주 대원 송금', amt: '-30', type: 'out', date: '08-12 09:15' }
  ]);

  // 송금 입력 폼
  const [transferTarget, setTransferTarget] = useState('김우주 (우유 배달)');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPwInput, setTransferPwInput] = useState('');

  // 예금 입력 폼
  const [depositAmount, setDepositAmount] = useState('');
  const [depositType, setDepositType] = useState<'short' | 'long'>('long');

  // 상점 아이템
  const [shopItems, setShopItems] = useState([
    { id: '1', name: '간식 1회 교환권', name_ru: 'Талон на перекус', price: 50, stock: 5, promo: '특가', desc: '맛있는 우주 간식으로 교환합니다.' },
    { id: '2', name: '자리 우선 선택권', name_ru: 'Выбор места', price: 200, stock: 2, promo: '', desc: '다음 좌석 배치 시 우선권을 얻습니다.' },
    { id: '3', name: '숙제 1회 면제권', name_ru: 'Освобождение от ДЗ', price: 500, stock: 1, promo: '인기', desc: '하루 숙제를 면제받는 황금 티켓!' }
  ]);

  // 가방 보유 쿠폰
  const [bagItems, setBagItems] = useState([
    { id: 'c1', name: '보드게임 3회 이용권', serial: 'BG-9920', uses: 3, maxUses: 3, expiry: '2026-09-15' }
  ]);

  // 펀드 시뮬레이터
  const [fundIndex, setFundIndex] = useState(1050);
  const [fundInvested, setFundInvested] = useState(200);
  const [fundBuyInput, setFundBuyInput] = useState('');

  // 관리자 학생 데이터
  const [adminStudents, setAdminStudents] = useState([
    { id: 1, name: '최정호', role: '우주 시민', balance: 1450, isPending: false },
    { id: 2, name: '김우주', role: '우유 배달', balance: 820, isPending: true, reqAmt: 100, reqType: '출금' },
    { id: 3, name: '이화성', role: '창틀 쓸기', balance: 410, isPending: true, reqAmt: 50, reqType: '가입' }
  ]);

  // 좌석 부동산 (1~25번)
  const [seats, setSeats] = useState(
    Array.from({ length: 25 }, (_, i) => ({
      seat: i + 1,
      owner: i === 6 ? '최정호' : i === 12 ? '김우주' : '',
      rent: i === 24 ? 100 : i % 5 === 0 ? 50 : 30
    }))
  );

  // 방학 모드
  const [isFrozen, setIsFrozen] = useState(false);

  // 모달 제어
  const [selectedQr, setSelectedQr] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // 알림 팝업 함수
  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // -------------------------------------------------------------
  // [기능 1] 송금 실행
  // -------------------------------------------------------------
  const handleTransfer = () => {
    if (isFrozen) {
      showAlert('❄️ 현재 방학(경제 동결) 모드이므로 송금이 불가합니다.');
      return;
    }
    const amt = parseInt(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('⚠️ 보낼 금액을 정확히 입력해주세요.');
      return;
    }
    if (user.balance < amt) {
      showAlert('⚠️ 보유 잔액이 부족합니다!');
      return;
    }
    if (transferPwInput !== user.transferPw) {
      showAlert('❌ 2차 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 잔액 차감 & 내역 추가
    setUser(prev => ({ ...prev, balance: prev.balance - amt }));
    setTransactions(prev => [
      { id: Date.now(), title: `${transferTarget} 송금`, amt: `-${amt}`, type: 'out', date: '방금 전' },
      ...prev
    ]);
    setTransferAmount('');
    setTransferPwInput('');
    setActiveTab('wallet');
    showAlert(`💸 ${transferTarget} 대원에게 ${amt}안을 성공적으로 보냈습니다!`);
  };

  // -------------------------------------------------------------
  // [기능 2] 예금 가입
  // -------------------------------------------------------------
  const handleDeposit = () => {
    if (isFrozen) {
      showAlert('❄️ 방학 중에는 예금 가입이 제한됩니다.');
      return;
    }
    const amt = parseInt(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('⚠️ 예금할 금액을 입력해주세요.');
      return;
    }
    if (user.balance < amt) {
      showAlert('⚠️ 잔액이 부족합니다.');
      return;
    }

    setUser(prev => ({
      ...prev,
      balance: prev.balance - amt,
      depositBalance: prev.depositBalance + amt
    }));
    setTransactions(prev => [
      { id: Date.now(), title: `정기 예금 가입 (${depositType === 'long' ? '15%' : '3%'})`, amt: `-${amt}`, type: 'out', date: '방금 전' },
      ...prev
    ]);
    setDepositAmount('');
    setActiveTab('wallet');
    showAlert(`🏦 ${amt}안이 정기 예금에 안전하게 입금되었습니다.`);
  };

  // -------------------------------------------------------------
  // [기능 3] 상점 아이템 구매
  // -------------------------------------------------------------
  const handleBuyItem = (item: any) => {
    if (isFrozen) {
      showAlert('❄️ 방학 중에는 상점을 이용할 수 없습니다.');
      return;
    }
    if (user.balance < item.price) {
      showAlert('⚠️ 잔액이 부족하여 구매할 수 없습니다.');
      return;
    }
    if (item.stock <= 0) {
      showAlert('⚠️ 재고가 모두 소진되었습니다.');
      return;
    }

    // 재고 차감 & 잔액 차감
    setShopItems(prev => prev.map(s => s.id === item.id ? { ...s, stock: s.stock - 1 } : s));
    setUser(prev => ({ ...prev, balance: prev.balance - item.price }));
    
    // 가방에 추가
    const newCoupon = {
      id: `c_${Date.now()}`,
      name: item.name,
      serial: `SN-${Math.floor(1000 + Math.random() * 9000)}`,
      uses: 1,
      maxUses: 1,
      expiry: '2026-08-31'
    };
    setBagItems(prev => [newCoupon, ...prev]);

    setTransactions(prev => [
      { id: Date.now(), title: `[상점] ${item.name} 구매`, amt: `-${item.price}`, type: 'out', date: '방금 전' },
      ...prev
    ]);
    showAlert(`🎉 '${item.name}' 구매 완료! [가방] 탭에서 QR을 확인하세요.`);
  };

  // -------------------------------------------------------------
  // [기능 4] 쿠폰 1회 사용 차감
  // -------------------------------------------------------------
  const handleUseCoupon = (couponId: string) => {
    setBagItems(prev => prev.map(c => {
      if (c.id === couponId) {
        return { ...c, uses: c.uses - 1 };
      }
      return c;
    }).filter(c => c.uses > 0));

    setSelectedQr(null);
    showAlert('✅ 쿠폰 1회가 사용 처리되었습니다!');
  };

  // -------------------------------------------------------------
  // [기능 5] 펀드 매수 / 조기환매
  // -------------------------------------------------------------
  const handleBuyFund = () => {
    const amt = parseInt(fundBuyInput);
    if (isNaN(amt) || amt <= 0 || user.balance < amt) {
      showAlert('⚠️ 올바른 투자 금액을 입력하세요.');
      return;
    }
    setUser(prev => ({ ...prev, balance: prev.balance - amt }));
    setFundInvested(prev => prev + amt);
    setFundBuyInput('');
    showAlert(`📈 ${amt}안을 펀드에 성공적으로 추가 매수했습니다.`);
  };

  const handleSellFund = () => {
    if (fundInvested <= 0) {
      showAlert('⚠️ 투자된 원금이 없습니다.');
      return;
    }
    // 수익률 및 위약금 10% 계산
    const evaluated = Math.floor(fundInvested * (fundIndex / 1000));
    const penalty = Math.floor(evaluated * 0.1);
    const returnAmt = evaluated - penalty;

    setUser(prev => ({ ...prev, balance: prev.balance + returnAmt }));
    setFundInvested(0);
    showAlert(`💸 펀드 환매 완료! 위약금(${penalty}안) 차감 후 ${returnAmt}안이 입금되었습니다.`);
  };

  // -------------------------------------------------------------
  // [기능 6] 관리자: 일괄 주급 지급
  // -------------------------------------------------------------
  const handleAdminSalary = () => {
    showAlert('💸 전원 주급 입금 및 세금(10%) 징수가 완료되었습니다!');
  };

  // -------------------------------------------------------------
  // [기능 7] 관리자: 학생 승인 / 반려
  // -------------------------------------------------------------
  const handleApprove = (id: number, accept: boolean) => {
    setAdminStudents(prev => prev.map(s => s.id === id ? { ...s, isPending: false } : s));
    showAlert(accept ? '✅ 승인 처리가 완료되었습니다.' : '❌ 반려 처리되었습니다.');
  };

  // =============================================================
  // 로그인 화면
  // =============================================================
  if (loginMode === 'None') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        {alertMsg && (
          <div className="fixed top-6 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 text-xs font-bold animate-bounce">
            {alertMsg}
          </div>
        )}
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-indigo-600/20 rounded-2xl border border-indigo-500/30 text-4xl mb-2">🚀</div>
            <h1 className="text-2xl font-black tracking-tight text-indigo-400">
              {t('우주 디지털 학급은행', 'Цифровой Банк Класса')}
            </h1>
            <p className="text-xs text-slate-400">
              {t('화성 테라포밍 자치 정부 경제 시스템', 'Экономическая система класса')}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button 
              onClick={() => setLoginMode('Student')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <User size={18} /> {t('학생으로 접속하기', 'Вход ученика')}
            </button>
            <button 
              onClick={() => setLoginMode('Admin')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-2xl border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> {t('선생님 관리자 센터', 'Вход учителя')}
            </button>
          </div>

          <div className="flex justify-center pt-2">
            <button 
              onClick={() => setLang(lang === 'ko' ? 'ru' : 'ko')}
              className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-full border border-slate-700 flex items-center gap-1.5"
            >
              🌐 {lang === 'ko' ? '한국어 (KR)' : 'Русский (RU)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // 관리자 / 교사 센터
  // =============================================================
  if (loginMode === 'Admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24">
        {alertMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 text-xs font-bold animate-bounce">
            {alertMsg}
          </div>
        )}
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👨‍🏫</span>
            <div>
              <h1 className="font-bold text-base text-indigo-400">학급 경제 중앙 관제 센터</h1>
              <p className="text-xs text-slate-400">국고: 18,450 안 | 학생 수: {adminStudents.length}명</p>
            </div>
          </div>
          <button 
            onClick={() => setLoginMode('None')} 
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-slate-300 flex items-center gap-1 border border-slate-700"
          >
            <LogOut size={14} /> 로그아웃
          </button>
        </header>

        <main className="max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'students', label: '👥 학생/승인' },
              { id: 'salary', label: '💸 주급 일괄 지급' },
              { id: 'estate', label: '🏠 좌석 부동산' },
              { id: 'funds', label: '📈 펀드 지수 제어' },
              { id: 'freeze', label: '❄️ 방학(동결) 모드' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setAdminTab(m.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  adminTab === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {adminTab === 'students' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                <h3 className="font-bold text-sm text-yellow-400">🔔 가입 및 출금 승인 대기열</h3>
                {adminStudents.filter(s => s.isPending).length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">대기 중인 요청이 없습니다.</p>
                ) : (
                  adminStudents.filter(s => s.isPending).map(s => (
                    <div key={s.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800">
                      <div>
                        <p className="font-bold text-sm">{s.name} 학생 ({s.role})</p>
                        <p className="text-xs text-slate-400">{s.reqType} 요청: {s.reqAmt} 안</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(s.id, true)} className="bg-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold">승인</button>
                        <button onClick={() => handleApprove(s.id, false)} className="bg-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold">반려</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {adminTab === 'salary' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">💰 2026-W33 주급 일괄 정산기</h3>
              <p className="text-xs text-slate-400">세율 10%, 유지비 5%를 자동 차감하고 전원에게 일괄 지급합니다.</p>
              <button onClick={handleAdminSalary} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm transition">
                💸 전원 주급 입금 및 세금 징수 즉시 실행
              </button>
            </div>
          )}

          {adminTab === 'estate' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">🗺️ 좌석 부동산 관리 (1~25번)</h3>
              <div className="grid grid-cols-5 gap-2">
                {seats.map(s => (
                  <div key={s.seat} className={`p-2 rounded-xl text-center border ${s.owner ? 'bg-indigo-950/60 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                    <p className="text-xs font-bold">{s.seat}번</p>
                    <p className="text-[10px] text-yellow-400 font-bold">{s.rent}안</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.owner || '공실'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'funds' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">📈 펀드 지수 수동 조정</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-emerald-400">{fundIndex} p</span>
                <button onClick={() => setFundIndex(p => p + 50)} className="bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold">+50p 상승</button>
                <button onClick={() => setFundIndex(p => Math.max(100, p - 50))} className="bg-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold">-50p 하락</button>
              </div>
            </div>
          )}

          {adminTab === 'freeze' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm text-indigo-400">❄️ 방학(경제 동결) 모드</h3>
                  <p className="text-xs text-slate-400 mt-1">켜지면 학생들의 송금, 상점 구매, 예금 가입이 잠깁니다.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsFrozen(!isFrozen);
                    showAlert(isFrozen ? '☀️ 방학 모드가 해제되었습니다.' : '❄️ 방학 모드가 활성화되었습니다.');
                  }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs ${isFrozen ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {isFrozen ? '동결 중 (ON)' : '해제됨 (OFF)'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // =============================================================
  // 학생 모드 화면
  // =============================================================
  return (
    <div className="max-w-md mx-auto bg-slate-950 min-h-screen shadow-2xl pb-28 text-white">
      {alertMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 text-xs font-bold animate-bounce">
          {alertMsg}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-gradient-to-b from-indigo-700 to-indigo-900 p-6 rounded-b-[2rem] shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="font-black text-sm tracking-wider text-indigo-200">SPACE CLASS BANK</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setLang(lang === 'ko' ? 'ru' : 'ko')}
              className="bg-black/30 hover:bg-black/40 px-2.5 py-1 rounded-full text-xs font-bold border border-white/10"
            >
              {lang === 'ko' ? 'KR' : 'RU'}
            </button>
            <button 
              onClick={() => setLoginMode('None')}
              className="bg-black/30 hover:bg-black/40 p-1.5 rounded-full text-xs border border-white/10"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-indigo-200">{user.name} {t('대원', 'Ученик')} ({user.role})</p>
          <div className="text-4xl font-black text-yellow-300 flex items-baseline gap-1.5">
            {user.balance.toLocaleString()} <span className="text-lg text-yellow-400 font-bold">{t('안', 'AN')}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <span className="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
              {user.creditTier}
            </span>
            {user.depositBalance > 0 && (
              <span className="bg-blue-400/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                🏦 {t('예금', 'Вклад')}: {user.depositBalance}안
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 본문 탭 */}
      <main className="p-4 space-y-4">
        {activeTab === 'wallet' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setActiveTab('transfer')}
                className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-bold text-sm shadow-lg flex flex-col items-center gap-2 transition"
              >
                <ArrowRightLeft size={22} className="text-indigo-200" />
                {t('친구에게 송금', 'Перевод')}
              </button>
              <button 
                onClick={() => setActiveTab('deposit')}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition"
              >
                <Landmark size={22} className="text-yellow-400" />
                {t('정기 예금 (15%)', 'Вклад (15%)')}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-xs text-slate-400 flex items-center gap-1.5">
                <FileText size={14} /> {t('최근 거래 내역', 'История операций')}
              </h3>
              <div className="space-y-2">
                {transactions.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-800/60 last:border-none text-xs">
                    <div>
                      <p className="font-bold text-slate-200">{item.title}</p>
                      <p className="text-[10px] text-slate-500">{item.date}</p>
                    </div>
                    <span className={`font-black text-sm ${item.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.amt} {t('안', 'AN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-indigo-400 flex items-center gap-2">
              <ArrowRightLeft size={18} /> {t('대원 간 안전 송금', 'Перевод средств')}
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('받는 대원', 'Получатель')}</label>
                <select 
                  value={transferTarget} 
                  onChange={e => setTransferTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold"
                >
                  <option>김우주 (우유 배달)</option>
                  <option>이화성 (교실 청소)</option>
                  <option>박지구 (봉사위원)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{t('보낼 금액 (안)', 'Сумма (AN)')}</label>
                <input 
                  type="number" 
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  placeholder="예: 50" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold" 
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{t('송금 2차 비밀번호 (초기: 1234)', 'Пароль перевода')}</label>
                <input 
                  type="password" 
                  value={transferPwInput}
                  onChange={e => setTransferPwInput(e.target.value)}
                  placeholder="••••" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold" 
                />
              </div>
            </div>
            <button 
              onClick={handleTransfer}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm transition shadow-lg"
            >
              {t('송금 확인 및 실행', 'Отправить')}
            </button>
          </div>
        )}

        {activeTab === 'deposit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-indigo-400 flex items-center gap-2">
              <Landmark size={18} /> {t('정기 예금 가입', 'Открыть вклад')}
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => setDepositType('short')}
                className={`p-3 rounded-xl border text-center font-bold transition ${depositType === 'short' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                단기 (7일 3%)
              </button>
              <button 
                onClick={() => setDepositType('long')}
                className={`p-3 rounded-xl border text-center font-bold transition ${depositType === 'long' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                장기 (28일 15%)
              </button>
            </div>
            <div className="text-xs space-y-2">
              <label className="block text-slate-400">{t('예금할 금액 (안)', 'Сумма вклада')}</label>
              <input 
                type="number" 
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="예: 100" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold" 
              />
            </div>
            <button 
              onClick={handleDeposit}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm transition shadow-lg"
            >
              {t('예금 통장에 넣기', 'Внести вклад')}
            </button>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-indigo-400 flex items-center gap-2">
              <Store size={18} /> {t('우주 정거장 매점', 'Магазин класса')}
            </h2>
            {shopItems.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-200">{lang === 'ru' ? item.name_ru : item.name}</h3>
                      {item.promo && (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {item.promo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-yellow-400 text-base">{item.price} {t('안', 'AN')}</p>
                    <p className="text-[10px] text-slate-500">{t('재고', 'Остаток')}: {item.stock}개</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleBuyItem(item)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl text-xs font-bold transition shadow"
                >
                  {t('구매하기', 'Купить')}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bag' && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-indigo-400 flex items-center gap-2">
              <QrCode size={18} /> {t('내 쿠폰 가방', 'Моя сумка')}
            </h2>
            {bagItems.length === 0 ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                가방이 비어 있습니다. [상점]에서 쿠폰을 구매해보세요!
              </div>
            ) : (
              bagItems.map(bag => (
                <div key={bag.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">{bag.name}</h3>
                    <p className="text-[11px] text-indigo-400 font-bold mt-0.5">SN: {bag.serial} ({t('남은 횟수', 'Осталось')}: {bag.uses}회)</p>
                    <p className="text-[10px] text-slate-500">유효기간: ~{bag.expiry}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedQr(bag)}
                    className="bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 text-indigo-300"
                  >
                    📱 QR 보기
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'fund' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-indigo-400">📈 바른생활 테마 펀드</h2>
                <p className="text-xs text-slate-400">현재 지수: <strong className="text-emerald-400 text-sm">{fundIndex}p</strong></p>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-md border border-emerald-500/30">
                🟢 운용 중
              </span>
            </div>

            <div className="p-4 bg-indigo-950/40 rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span>내 투자 원금: {fundInvested}안</span>
                <span className="text-emerald-400">평가금: {Math.floor(fundInvested * (fundIndex / 1000))}안</span>
              </div>
              <div className="space-y-2">
                <input 
                  type="number"
                  value={fundBuyInput}
                  onChange={e => setFundBuyInput(e.target.value)}
                  placeholder="매수할 금액 (안)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleBuyFund} className="bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl font-bold text-xs">
                    추가 매수
                  </button>
                  <button onClick={handleSellFund} className="bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 py-2.5 rounded-xl font-bold text-xs">
                    조기 환매 (수수료 10%)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR 코드 모달 */}
      {selectedQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-4">
            <h3 className="font-bold text-base text-white">{selectedQr.name}</h3>
            <div className="bg-white p-5 rounded-2xl inline-block shadow-inner">
              <div className="w-40 h-40 bg-slate-900 flex flex-col items-center justify-center rounded-xl text-white p-2">
                <QrCode size={70} className="text-indigo-400" />
                <p className="text-[10px] font-mono mt-2 text-yellow-300 font-bold">{selectedQr.serial}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">남은 횟수: {selectedQr.uses}회</p>
              </div>
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => handleUseCoupon(selectedQr.id)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-xs text-white"
              >
                ✅ 쿠폰 1회 사용 처리
              </button>
              <button 
                onClick={() => setSelectedQr(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-xs border border-slate-700 text-slate-400"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 고정 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-around p-3 rounded-t-3xl z-40">
        {[
          { id: 'wallet', label: t('통장', 'Счет'), icon: Wallet },
          { id: 'store', label: t('상점', 'Магазин'), icon: Store },
          { id: 'bag', label: t('가방', 'Сумка'), icon: QrCode },
          { id: 'fund', label: t('투자', 'Фонд'), icon: TrendingUp }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition ${
                isActive ? 'text-indigo-400 font-black' : 'text-slate-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] mt-1 font-bold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
