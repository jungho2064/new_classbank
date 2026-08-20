'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Wallet, Store, QrCode, TrendingUp, Settings, ShieldCheck, 
  ArrowRightLeft, Landmark, FileText, Sparkles, AlertTriangle, 
  CheckCircle, XCircle, RefreshCw, LogOut, Lock, User, 
  Camera, Receipt, Send
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [lang, setLang] = useState<'ko' | 'ru'>('ko');
  const t = (ko: string, ru: string) => (lang === 'ru' ? ru : ko);

  const [loginMode, setLoginMode] = useState<'None' | 'Student' | 'Admin'>('None');
  const [loginName, setLoginName] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // 실시간 유저 정보
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [bagItems, setBagItems] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [fundData, setFundData] = useState<any>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [notice, setNotice] = useState('');

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'wallet' | 'transfer' | 'withdraw' | 'deposit' | 'loan' | 'payslip' | 'store' | 'bag' | 'fund'>('wallet');
  const [adminTab, setAdminTab] = useState<'students' | 'salary' | 'estate' | 'funds' | 'freeze'>('students');

  // 폼 입력 상태
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferPw, setTransferPw] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [repayAmt, setRepayAmt] = useState('');
  const [selectedQr, setSelectedQr] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // -------------------------------------------------------------
  // DB 데이터 불러오기
  // -------------------------------------------------------------
  const loadData = async () => {
    if (!supabase) return;

    // 1. 유저 목록
    const { data: users } = await supabase.from('users').select('*');
    if (users) {
      setUserList(users);
      if (currentUser) {
        const updated = users.find(u => u.name === currentUser.name);
        if (updated) setCurrentUser(updated);
      }
    }

    // 2. 거래 내역
    const { data: trans } = await supabase.from('transactions').select('*').order('id', { ascending: false });
    if (trans) setTransactions(trans);

    // 3. 상점 아이템
    const { data: shop } = await supabase.from('shop_items').select('*').eq('status', 'Active');
    if (shop) setShopItems(shop);

    // 4. 좌석 부동산
    const { data: estate } = await supabase.from('real_estate').select('*').order('seat', { ascending: true });
    if (estate) setSeats(estate);

    // 5. 펀드
    const { data: funds } = await supabase.from('funds').select('*').limit(1).single();
    if (funds) setFundData(funds);

    // 6. 시스템 설정
    const { data: configs } = await supabase.from('system_config').select('*');
    if (configs) {
      const vMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
      setIsFrozen(vMap.is_vacation === 'TRUE');
      setNotice(vMap.maintenance_notice || '');
    }
  };

  // 내 가방 불러오기
  const loadBag = async (userName: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('inventory').select('*').eq('name', userName).order('id', { ascending: false });
    if (data) setBagItems(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // 로그인 처리
  // -------------------------------------------------------------
  const handleStudentLogin = async () => {
    if (!supabase) {
      showAlert('⚠️ Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }
    const { data, error } = await supabase.from('users').select('*').eq('name', loginName.trim()).eq('password', loginPw.trim()).single();
    if (error || !data) {
      showAlert('❌ 이름 또는 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (data.status !== 'Approved') {
      showAlert('⏳ 선생님의 가입 승인을 기다리고 있습니다.');
      return;
    }
    setCurrentUser(data);
    setLoginMode('Student');
    loadBag(data.name);
    showAlert(`🚀 ${data.name} 대원, 접속을 환영합니다!`);
  };

  // -------------------------------------------------------------
  // [학생] 송금 실행 (Supabase에 실시간 기록)
  // -------------------------------------------------------------
  const handleTransfer = async () => {
    if (isFrozen) { showAlert('❄️ 방학(경제 동결) 중에는 송금이 불가합니다.'); return; }
    const amt = parseInt(transferAmt);
    if (isNaN(amt) || amt <= 0 || !transferTarget) { showAlert('⚠️ 수신인과 금액을 확인하세요.'); return; }
    
    // 내 잔액 계산
    const myTrans = transactions.filter(t => t.name === currentUser.name && t.status !== 'Rejected');
    const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);
    const fee = myBalance >= 1000 ? 0 : 1; // 은하 대부호 면제

    if (myBalance < amt + fee) { showAlert('⚠️ 잔액이 부족합니다.'); return; }
    if (transferPw !== currentUser.transfer_password) { showAlert('❌ 송금 비밀번호가 일치하지 않습니다.'); return; }

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    const newRows = [
      { date: nowStr, name: currentUser.name, type: '송금(출금)', amount: -amt, note: `${transferTarget} 송금`, status: 'Success' },
      { date: nowStr, name: transferTarget, type: '송금(입금)', amount: amt, note: `${currentUser.name} 입금`, status: 'Success' }
    ];

    if (fee > 0) {
      newRows.push(
        { date: nowStr, name: currentUser.name, type: '송금 수수료', amount: -fee, note: '타행 송금 수수료', status: 'Success' },
        { date: nowStr, name: '국고(중앙은행)', type: '수수료 수입', amount: fee, note: `${currentUser.name} 송금 수수료`, status: 'Success' }
      );
    }

    const { error } = await supabase!.from('transactions').insert(newRows);
    if (!error) {
      setTransferAmt(''); setTransferPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(`💸 ${transferTarget} 대원에게 ${amt}안을 성공적으로 보냈습니다!`);
    }
  };

  // -------------------------------------------------------------
  // [학생] 상점 아이템 구매
  // -------------------------------------------------------------
  const handleBuyItem = async (item: any) => {
    if (isFrozen) { showAlert('❄️ 방학 중에는 상점 이용이 불가합니다.'); return; }
    if (item.stock <= 0) { showAlert('⚠️ 재고가 모두 소진되었습니다.'); return; }

    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const serialCode = 'SN-' + Math.floor(100000 + Math.random() * 900000);

    // 1. 거래 장부 기록
    await supabase!.from('transactions').insert([
      { date: nowStr, name: currentUser.name, type: '상점 결제', amount: -item.price, note: `상품 구매: ${item.name}`, status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: '상점 수입', amount: item.price, note: `${currentUser.name} 상품 구매`, status: 'Success' }
    ]);

    // 2. 가방에 쿠폰 지급
    await supabase!.from('inventory').insert([
      { date: nowStr, name: currentUser.name, item_id: item.item_id, item_name: item.name, serial: serialCode, status: 'Unused', expiry: '2026-08-31' }
    ]);

    // 3. 재고 1 차감
    await supabase!.from('shop_items').update({ stock: item.stock - 1 }).eq('item_id', item.item_id);

    await loadData();
    await loadBag(currentUser.name);
    showAlert(`🎉 '${item.name}' 구매 완료! [가방] 탭에 보관되었습니다.`);
  };

  // -------------------------------------------------------------
  // [학생] 대출 자진 상환
  // -------------------------------------------------------------
  const handleLoanRepay = async () => {
    const amt = parseInt(repayAmt);
    if (isNaN(amt) || amt <= 0) { showAlert('⚠️ 올바른 금액을 입력하세요.'); return; }
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    await supabase!.from('transactions').insert([
      { date: nowStr, name: currentUser.name, type: '자진 대출 상환', amount: -amt, note: '학생 직접 상환', status: 'Success' },
      { date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: amt, note: `${currentUser.name} 상환`, status: 'Success' }
    ]);

    const newLoan = Math.max(0, currentUser.loan_balance - amt);
    await supabase!.from('users').update({ loan_balance: newLoan, dunning: newLoan === 0 ? '' : currentUser.dunning }).eq('name', currentUser.name);

    setRepayAmt(''); setActiveTab('wallet');
    await loadData();
    showAlert(`💸 ${amt}안 대출 상환이 완료되었습니다!`);
  };

  // =============================================================
  // 1. 로그인 전 화면
  // =============================================================
  if (loginMode === 'None') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        {alertMsg && <div className="fixed top-6 bg-indigo-600 px-5 py-3 rounded-2xl z-50 text-xs font-bold animate-bounce">{alertMsg}</div>}
        
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-indigo-600/20 rounded-2xl border border-indigo-500/30 text-4xl mb-2">🚀</div>
            <h1 className="text-2xl font-black text-indigo-400">우주 디지털 학급은행</h1>
            <p className="text-xs text-slate-400">화성 테라포밍 자치 정부 경제 포털</p>
          </div>

          {notice && (
            <div className="bg-indigo-950/50 border border-indigo-500/20 p-4 rounded-2xl text-xs text-indigo-200">
              ✨ <strong>공지:</strong> {notice}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <input 
              type="text" 
              placeholder="대원 이름 (예: 최정호)" 
              value={loginName} 
              onChange={e => setLoginName(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold"
            />
            <input 
              type="password" 
              placeholder="비밀번호" 
              value={loginPw} 
              onChange={e => setLoginPw(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold"
            />
            <button 
              onClick={handleStudentLogin} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold text-sm shadow-lg transition"
            >
              학생 로그인
            </button>
            <button 
              onClick={() => setLoginMode('Admin')} 
              className="w-full bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-bold text-sm text-slate-300 border border-slate-700 transition"
            >
              교사 / 관리자 모드
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
            <div><h1 className="font-bold text-indigo-400">학급 중앙은행 관제 데스크</h1><p className="text-xs text-slate-400">Supabase 클라우드 실시간 연동 중</p></div>
          </div>
          <button onClick={() => setLoginMode('None')} className="text-xs bg-slate-800 px-3 py-2 rounded-xl text-slate-300"><LogOut size={14}/> 로그아웃</button>
        </header>

        <main className="max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'students', label: '👥 학생 승인/관리' },
              { id: 'salary', label: '💸 주급 일괄 정산' },
              { id: 'estate', label: '🏠 좌석 부동산' },
              { id: 'funds', label: '📈 펀드 지표 제어' },
              { id: 'freeze', label: '❄️ 방학 동결 모드' }
            ].map(m => (
              <button key={m.id} onClick={() => setAdminTab(m.id as any)} className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${adminTab === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {adminTab === 'students' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="font-bold text-sm text-yellow-400">👥 등록된 대원 목록 ({userList.length}명)</h3>
              <div className="space-y-2">
                {userList.map(u => (
                  <div key={u.id} className="bg-slate-950 p-3 rounded-xl flex justify-between items-center border border-slate-800 text-xs">
                    <div>
                      <p className="font-bold text-white">{u.name} ({u.job})</p>
                      <p className="text-slate-400">대출 잔액: {u.loan_balance}안 | 상태: {u.status}</p>
                    </div>
                    {u.status === 'Pending' && (
                      <button onClick={async () => { await supabase!.from('users').update({ status: 'Approved' }).eq('id', u.id); loadData(); showAlert('승인 완료!'); }} className="bg-emerald-600 px-3 py-1.5 rounded-lg font-bold text-white">가입 승인</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'salary' && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm text-indigo-400">💰 주급 일괄 지급 (세율 10% 자동 차감)</h3>
              <button onClick={async () => {
                const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                const rows = userList.filter(u => u.status === 'Approved').map(u => ({
                  date: nowStr, name: u.name, type: '주급', amount: 126, note: '기본:140|세금:14', status: 'Success'
                }));
                await supabase!.from('transactions').insert(rows);
                loadData();
                showAlert('💸 전원 주급 입금이 완료되었습니다!');
              }} className="w-full bg-indigo-600 py-3.5 rounded-xl font-bold text-sm">전원 주급 126안 입금 실행</button>
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
  const myBalance = myTrans.reduce((acc, cur) => acc + Number(cur.amount), 0);

  return (
    <div className="max-w-md mx-auto bg-slate-950 min-h-screen shadow-2xl pb-28 text-white">
      {alertMsg && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 px-5 py-3 rounded-2xl z-50 text-xs font-bold animate-bounce shadow-xl">{alertMsg}</div>}

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
          {currentUser.loan_balance > 0 && (
            <span className="bg-rose-400/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-400/30">
              🚨 대출 잔액: {currentUser.loan_balance}안
            </span>
          )}
        </div>
      </header>

      <main className="p-4 space-y-4">
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setActiveTab('transfer')} className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 shadow transition">
                <ArrowRightLeft size={20} /> 대원 송금
              </button>
              <button onClick={() => setActiveTab('loan')} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 transition">
                <AlertTriangle size={20} className="text-rose-400" /> 대출 자진 상환
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-xs text-slate-400">내 실시간 입출금 내역</h3>
              <div className="space-y-2">
                {myTrans.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/60 last:border-none">
                    <div><p className="font-bold text-slate-200">{t.note || t.type}</p><p className="text-[10px] text-slate-500">{t.date}</p></div>
                    <span className={`font-black ${t.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.amount > 0 ? `+${t.amount}` : t.amount} 안</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-indigo-400 text-sm flex items-center gap-2"><ArrowRightLeft size={16}/> 안전 송금</h2>
            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs">
              <option value="">받는 대원 선택</option>
              {userList.filter(u => u.name !== currentUser.name && u.status === 'Approved').map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.job})</option>
              ))}
            </select>
            <input type="number" placeholder="보낼 금액 (안)" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs" />
            <input type="password" placeholder="송금 비밀번호" value={transferPw} onChange={e => setTransferPw(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs" />
            <button onClick={handleTransfer} className="w-full bg-indigo-600 py-3.5 rounded-xl font-bold text-xs">송금 실행</button>
          </div>
        )}

        {activeTab === 'loan' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-rose-400 text-sm flex items-center gap-2"><AlertTriangle size={16}/> 대출금 상환</h2>
            <div className="p-4 bg-rose-950/40 rounded-xl text-center border border-rose-500/20">
              <p className="text-xs text-rose-300">남은 대출 잔액</p>
              <p className="text-2xl font-black text-rose-400">{currentUser.loan_balance} 안</p>
            </div>
            <input type="number" placeholder="상환할 금액" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs" />
            <button onClick={handleLoanRepay} className="w-full bg-rose-600 py-3.5 rounded-xl font-bold text-xs">상환하기</button>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🛒 우주 매점</h2>
            {shopItems.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                <div><h3 className="font-bold text-xs">{item.name}</h3><p className="text-[10px] text-slate-500">재고: {item.stock}개 | 가격: {item.price}안</p></div>
                <button onClick={() => handleBuyItem(item)} className="bg-indigo-600 px-4 py-2 rounded-xl text-xs font-bold">구매</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bag' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🎒 내 쿠폰 가방</h2>
            {bagItems.map(b => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                <div><h3 className="font-bold text-xs">{b.item_name}</h3><p className="text-[10px] text-indigo-400">SN: {b.serial} ({b.status})</p></div>
                <button onClick={() => setSelectedQr(b)} className="bg-slate-800 px-3 py-1.5 rounded-xl text-xs border border-slate-700">QR 보기</button>
              </div>
            ))}
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
            <button onClick={() => setSelectedQr(null)} className="w-full bg-slate-800 py-2.5 rounded-xl text-xs border border-slate-700">닫기</button>
          </div>
        </div>
      )}

      {/* 하단 고정 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-around p-3 rounded-t-3xl z-40">
        {[
          { id: 'wallet', label: '통장', icon: Wallet },
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
