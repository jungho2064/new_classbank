'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Wallet, Store, QrCode, TrendingUp, Settings, ShieldCheck, 
  ArrowRightLeft, Landmark, FileText, AlertTriangle, 
  UserPlus, Receipt, LogOut, ChevronLeft, Loader2, Bell,
  Eye, EyeOff, Search, Briefcase
} from 'lucide-react';
import AdminPanel from './admin-panel';
import { sendDiscordNotice } from './discord';
import ConfirmModal from './components/confirm-modal';
import { Lang, tr, getCreditTier, parsePartTimeJobs, canViewPartTimeJob } from './lib/bank-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
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
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [systemConfigs, setSystemConfigs] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<Lang>('ko');
  const [depositOpen, setDepositOpen] = useState(true);
  const [notice, setNotice] = useState('');
 
  const [bankerName, setBankerName] = useState('');

  const [activeTab, setActiveTab] = useState<'wallet' | 'transfer' | 'withdraw' | 'deposit' | 'loan' | 'payslip' | 'settings' | 'store' | 'bag' | 'fund'| 'banker' | 'parttime'>('wallet');

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
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');
  const [showAllTrans, setShowAllTrans] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  // 🔔 학생 알림함 상태
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotiModal, setShowNotiModal] = useState(false);

  // 알림 목록 불러오기
  const loadNotifications = useCallback(async (userName: string) => {
    if (!supabase || !userName) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_name', userName)
      .order('id', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }, []);

  // 모든 알림 읽음 처리
  const handleReadAllNoti = async () => {
    if (!supabase || !currentUser?.name) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('target_name', currentUser.name)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // 알림 토스트 팝업 상태
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showAlert = useCallback((msg: string) => {
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

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertMsg(null);
    }, 3000);
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    try {
      const [
        { data: users },
        { data: trans },
        { data: shop },
        { data: estate },
        { data: funds },
        { data: configs },
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('transactions').select('*').order('id', { ascending: false }),
        supabase.from('shop_items').select('*').eq('status', 'Active'),
        supabase.from('real_estate').select('*').order('seat', { ascending: true }),
        supabase.from('funds').select('*').order('id', { ascending: true }),
        supabase.from('system_config').select('*'),
      ]);

      if (users) {
        setUserList(users.map(({ password, transfer_password, ...safeUser }: any) => safeUser));
        setCurrentUser((prev: any) => (prev ? (users.find(u => u.name === prev.name) || prev) : null));
      }
      if (trans) setTransactions(trans);
      if (shop) setShopItems(shop);
      if (estate) setSeats(estate);
      if (funds) setFundData(funds);

      if (configs) {
        const vMap = Object.fromEntries(configs.map(c => [c.key, String(c.value ?? '')]));
        setSystemConfigs(vMap);
        setIsMaintenance(String(vMap.is_maintenance || '').toUpperCase() === 'TRUE');
        setIsFrozen(String(vMap.is_vacation || '').toUpperCase() === 'TRUE');
        setDepositOpen(String(vMap.deposit_open || 'TRUE').toUpperCase() === 'TRUE');
        setNotice(vMap.maintenance_notice || '');
        setBankerName(vMap.banker_name || ''); // 👈 은행원 이름 저장
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadBag = useCallback(async (userName: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('name', userName)
      .order('id', { ascending: false });

    if (data) {
      setBagItems(data);
      // 💡 열려 있는 QR 모달 창의 잔여 횟수도 즉시 동기화
      setSelectedQr((prev: any) => (prev ? (data.find((d: any) => d.id === prev.id) || null) : null));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 메모이제이션을 통한 불필요한 재연산 방지
  const myTrans = useMemo(
    () => transactions.filter(t => t.name === currentUser?.name && t.status !== 'System' && t.status !== 'Rejected'),
    [transactions, currentUser?.name]
  );
  const myBalance = useMemo(
    () => myTrans.reduce((a, c) => a + Number(c.amount || 0), 0),
    [myTrans]
  );
  const myActiveDeposits = useMemo(
    () => myTrans.filter(t => t.status === 'Deposit_Active'),
    [myTrans]
  );
  const myDepositBalance = useMemo(
    () => myActiveDeposits.reduce((a, c) => a + Math.abs(Number(c.amount || 0)), 0),
    [myActiveDeposits]
  );
  const mySeat = useMemo(
    () => seats.find((s: any) => s && s.owner === currentUser?.name),
    [seats, currentUser?.name]
  );
  const pendingWithdrawals = useMemo(
    () => transactions.filter(t => t.status === 'Pending_W'),
    [transactions]
  );
  const hasUnreadNoti = useMemo(
    () => notifications.some(n => !n.is_read),
    [notifications]
  );

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPw.trim()) { showAlert(tr(lang, '⚠️ 이름과 비밀번호를 입력해주세요.', '⚠️ Введите имя и пароль.')); return; }
    
    await runStudentTask(tr(lang, '대원 인증 및 통장 동기화 중...', 'Проверка данных и вход...'), async () => {
      const { data, error } = await supabase!.from('users').select('*').eq('name', loginName.trim()).eq('password', loginPw.trim()).single();
      if (error || !data) { showAlert(tr(lang, '❌ 대원 이름 또는 비밀번호가 틀렸습니다.', '❌ Неверное имя или пароль.')); return; }
      if (data.status === 'Pending') { showAlert(tr(lang, '⏳ 선생님의 승인을 기다리고 있습니다.', '⏳ Ожидается подтверждение учителя.')); return; }
      setCurrentUser(data);
      setLoginMode('Student');
      loadBag(data.name);
      showAlert(tr(lang, `🚀 ${data.name} 대원 환영합니다!`, `🚀 Добро пожаловать, ${data.name}!`));
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
    if (!regName.trim() || !regPw.trim()) { showAlert(tr(lang, '⚠️ 필수 정보를 입력해주세요.', '⚠️ Заполните обязательные поля.')); return; }
    
    await runStudentTask(tr(lang, '대원 가입 신청서 전송 중...', 'Отправка заявки...'), async () => {
      const { error } = await supabase!.from('users').insert([{
        name: regName.trim(), password: regPw.trim(), transfer_password: regTransferPw.trim() || regPw.trim(),
        status: 'Pending', job: '우주 시민', loan_balance: 0, weekly_repay: 0
      }]);
      if (!error) {
        showAlert(tr(lang, '🎉 가입 신청 완료! 선생님의 승인 후 로그인하세요.', '🎉 Заявка отправлена! Войдите после одобрения.'));
        setShowSignupModal(false);
        await loadData();
      } else showAlert(tr(lang, '⚠️ 이미 존재하는 이름입니다.', '⚠️ Это имя уже занято.'));
    });
  };

  const handleTransfer = async () => {
    if (isFrozen) { showAlert(tr(lang, '❄️ 방학 중에는 송금이 불가합니다.', '❄️ Переводы недоступны на каникулах.')); return; }
    const amt = parseInt(transferAmt);
    if (!transferTarget || isNaN(amt) || amt <= 0) { showAlert(tr(lang, '⚠️ 정보를 확인해주세요.', '⚠️ Проверьте данные.')); return; }
    const fee = myBalance >= 1000 ? 0 : 1;
    if (myBalance < amt + fee) { showAlert(tr(lang, '⚠️ 잔액이 부족합니다.', '⚠️ Недостаточно средств.')); return; }
    if (transferPw !== currentUser?.transfer_password) { showAlert(tr(lang, '❌ 2차 비밀번호가 틀렸습니다.', '❌ Неверный платёжный пароль.')); return; }

    await runStudentTask(tr(lang, `💸 [${transferTarget}] 대원에게 ${amt}안 송금 처리 중...`, `💸 Перевод ${amt} ан для ${transferTarget}...`), async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const rows: any[] = [
        { date: nowStr, name: currentUser.name, type: '송금(출금)', amount: -amt, note: `${transferTarget} 송금`, status: 'Success' },
        { date: nowStr, name: transferTarget, type: '송금(입금)', amount: amt, note: `${currentUser.name} 입금`, status: 'Success' }
      ];
      if (fee > 0) rows.push({ date: nowStr, name: currentUser.name, type: '송금 수수료', amount: -fee, note: '타행 송금 수수료', status: 'Success' });
      // 1. 거래 기록 및 받는 친구 앱 내 알림 병렬 전송
      await Promise.all([
        supabase!.from('transactions').insert(rows),
        supabase!.from('notifications').insert([{
          target_name: transferTarget,
          title: '💸 송금 도착!',
          message: `${currentUser.name} 대원이 ${amt}안을 보냈습니다. (메모: ${currentUser.name} 입금)`,
        }]),
      ]);

      // 2. 100안 이상의 고액 송금인 경우 선생님 디스코드 관제로 자동 알림
      if (amt >= 100) {
        sendDiscordNotice({
          title: '🚨 고액 송금 모니터링',
          description: `**${currentUser.name}** 대원이 **${transferTarget}** 대원에게 **${amt}안**을 송금했습니다.`,
          color: 0xef4444, // 빨간색 경고
          fields: [
            { name: '보낸 대원', value: currentUser.name, inline: true },
            { name: '받은 대원', value: transferTarget, inline: true },
            { name: '금액', value: `${amt}안`, inline: true },
          ]
        });
      }
      setTransferAmt(''); setTransferPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(tr(lang, `💸 ${transferTarget} 대원에게 ${amt}안 송금 완료!`, `💸 Перевод ${amt} ан для ${transferTarget} выполнен!`));
    });
  };

  const handleWithdraw = async () => {
    const amt = parseInt(withdrawAmt);
    if (isNaN(amt) || amt <= 0) { showAlert(tr(lang, '⚠️ 금액을 확인하세요.', '⚠️ Проверьте сумму.')); return; }
    if (myBalance < amt) { showAlert(tr(lang, '❌ 출금 신청 금액이 보유 잔액보다 많습니다.', '❌ Сумма превышает баланс.')); return; }
    if (!withdrawPw.trim() || (withdrawPw !== currentUser?.password && withdrawPw !== currentUser?.transfer_password)) {
      showAlert(tr(lang, '❌ 비밀번호가 일치하지 않습니다.', '❌ Неверный пароль.'));
      return;
    }

    await runStudentTask(tr(lang, '🏧 현금 출금 전표 발행 중...', '🏧 Оформление заявки на снятие...'), async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase!.from('transactions').insert([{ date: nowStr, name: currentUser?.name, type: '현금 출금', amount: -amt, note: '사전 신청', status: 'Pending_W' }]);
      // 디스코드 관제 발송
      sendDiscordNotice({
        title: '🏧 현금 출금 사전 신청',
        description: `**${currentUser?.name}** 대원이 현금 출금을 신청했습니다.`,
        color: 0xf59e0b, // 주황색
        fields: [
          { name: '대원 이름', value: currentUser?.name || '미상', inline: true },
          { name: '출금액', value: `${amt}안`, inline: true },
        ]
      });
      setWithdrawAmt(''); setWithdrawPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(tr(lang, '🏧 출금 신청 접수 완료!', '🏧 Заявка на снятие принята!'));
    });
  };

  const handleDeposit = async () => {
    if (isFrozen) { showAlert(tr(lang, '❄️ 방학 중에는 예금 가입이 불가합니다.', '❄️ Вклады недоступны на каникулах.')); return; }
    if (!depositOpen) { showAlert(tr(lang, '🔒 현재 정기예금 가입 창구가 닫혀 있습니다.', '🔒 Окно вкладов закрыто.')); return; }
    const amt = parseInt(depositAmt);
    if (isNaN(amt) || amt < 10) { showAlert(tr(lang, '⚠️ 최소 10안 이상부터 가능합니다.', '⚠️ Минимум 10 ан.')); return; }
    if (myBalance < amt) { showAlert(tr(lang, `❌ 보유 잔액(${myBalance}안)을 초과하여 예금에 가입할 수 없습니다.`, `❌ Недостаточно средств (${myBalance} ан).`)); return; }
    if (!depositPw.trim() || (depositPw !== currentUser?.password && depositPw !== currentUser?.transfer_password)) {
      showAlert(tr(lang, '❌ 비밀번호가 일치하지 않습니다.', '❌ Неверный пароль.'));
      return;
    }

    const days = depositType === 'short' ? 7 : 28;
    const rate = depositType === 'short' ? 3 : 15;
    const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    await runStudentTask(tr(lang, `🏛️ 정기예금(${rate}%) 신규 계좌 개설 중...`, `🏛️ Открытие вклада (${rate}%)...`), async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      await supabase!.from('transactions').insert([
        { date: nowStr, name: currentUser?.name, type: '예금 가입', amount: -amt, note: `만기:${expiry}|이율:${rate}|원금:${amt}`, status: 'Deposit_Active' },
        { date: nowStr, name: '국고(중앙은행)', type: '예금 예치금', amount: amt, note: `${currentUser?.name} 예금 수탁`, status: 'Success' }
      ]);
      setDepositAmt(''); setDepositPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(tr(lang, `🏦 정기예금(${rate}%) 가입 완료!`, `🏦 Вклад (${rate}%) открыт!`));
    });
  };

  const handleLoanRepay = async () => {
    const currentLoan = Number(currentUser?.loan_balance || 0);
    if (currentLoan <= 0) { showAlert(tr(lang, '🎉 현재 갚아야 할 대출금이 없습니다.', '🎉 У вас нет долгов!')); return; }

    const amt = parseInt(repayAmt);
    if (isNaN(amt) || amt <= 0) { showAlert(tr(lang, '⚠️ 상환할 금액을 정확히 입력하세요.', '⚠️ Введите корректную сумму.')); return; }
    if (amt > currentLoan) { showAlert(tr(lang, `⚠️ 남은 대출 잔액(${currentLoan}안) 이하로만 상환할 수 있습니다.`, `⚠️ Нельзя превысить долг (${currentLoan} ан).`)); return; }
    if (myBalance < amt) { showAlert(tr(lang, '❌ 통장 잔액이 부족하여 상환할 수 없습니다.', '❌ Недостаточно средств.')); return; }
    if (repayPw !== currentUser?.transfer_password) { showAlert(tr(lang, '❌ 결제용 비밀번호가 일치하지 않습니다.', '❌ Неверный платёжный пароль.')); return; }

    await runStudentTask(tr(lang, '대출금 상환 및 담보 정리 중...', 'Погашение кредита...'), async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const nextLoan = Math.max(0, currentLoan - amt);
      await Promise.all([
        supabase!.from('transactions').insert([
          { date: nowStr, name: currentUser?.name, type: '자진 대출 상환', amount: -amt, note: '학생 직접 상환', status: 'Success' },
          { date: nowStr, name: '국고(중앙은행)', type: '대출금 회수', amount: amt, note: `${currentUser?.name} 상환`, status: 'Success' }
        ]),
        supabase!.from('users').update({ 
          loan_balance: nextLoan, 
          weekly_repay: nextLoan === 0 ? 0 : currentUser?.weekly_repay,
          dunning: nextLoan === 0 ? '' : currentUser?.dunning 
        }).eq('name', currentUser?.name),
      ]);

      setRepayAmt(''); setRepayPw(''); setActiveTab('wallet');
      await loadData();
      showAlert(tr(lang, `💸 ${amt}안 대출 상환이 완료되었습니다! (남은 대출: ${nextLoan}안)`, `💸 Погашено ${amt} ан! (Остаток: ${nextLoan} ан)`));
    });
  };

  const handleBuyItem = async (item: any) => {
    if (isFrozen) { showAlert(tr(lang, '❄️ 방학 중에는 상점을 이용할 수 없습니다.', '❄️ Магазин закрыт на каникулах.')); return; }
    if (Number(item.stock ?? 0) <= 0) { showAlert(tr(lang, '❌ 품절된 상품입니다.', '❌ Товар распродан.')); return; }
    if (myBalance < item.price) { showAlert(tr(lang, '❌ 잔액이 부족하여 아이템을 구매할 수 없습니다.', '❌ Недостаточно средств.')); return; }

    const maxPerUser = Number(item.max_per_user || 0);
    if (maxPerUser > 0) {
      const today = new Date().toISOString().split('T')[0];
      const activeOwnedCount = bagItems.filter(
        b =>
          b.item_id === item.item_id &&
          b.status !== 'Used' &&
          (b.remaining_uses === undefined || b.remaining_uses > 0) &&
          (!b.expire_at || b.expire_at >= today)
      ).length;
      if (activeOwnedCount >= maxPerUser) {
        showAlert(tr(lang, `⚠️ 이 상품은 1인당 최대 ${maxPerUser}개까지만 보유할 수 있습니다.`, `⚠️ Максимум ${maxPerUser} шт. на ученика.`));
        return;
      }
    }

    await runStudentTask(tr(lang, `🛒 [${item.name}] 구매 및 쿠폰 시리얼 발급 중...`, `🛒 Покупка [${item.name}]...`), async () => {
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      
      // ✅ 기존 6자리 숫자 난수 유지 (충분히 훌륭합니다)
      const serial = 'SN-' + Math.floor(100000 + Math.random() * 900000);

      // ✅ 유효기간 계산 (구매일로부터 30일 뒤, 또는 원하는 날짜)
      const expireAtStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 기본 사용 횟수 (아이템에 지정된 횟수가 있으면 사용, 없으면 1회)
      const uses = Number(item.total_uses || 1);

      // ✅ 거래내역, 인벤토리, 재고 차감 병렬 처리
      await Promise.all([
        supabase!.from('transactions').insert([
          { date: nowStr, name: currentUser?.name, type: '상점 결제', amount: -item.price, note: `상품 구매: ${item.name}`, status: 'Success' }
        ]),
        supabase!.from('inventory').insert([{ 
          date: nowStr, 
          name: currentUser?.name, 
          item_id: item.item_id, 
          item_name: item.name, 
          serial, 
          status: 'Unused', 
          total_uses: uses,
          remaining_uses: uses,
          expire_at: expireAtStr
        }]),
        supabase!.from('shop_items').update({ stock: item.stock - 1 }).eq('item_id', item.item_id),
      ]);

      await Promise.all([loadData(), loadBag(currentUser?.name)]);
      showAlert(tr(lang, `🎉 '${item.name}' 구매 완료! [가방]에서 확인하세요.`, `🎉 '${item.name}' куплен! Проверьте [Рюкзак].`));
    });
  };
  // 학생이 사용 완료된 쿠폰을 가방에서 직접 삭제하는 함수
  const handleDeleteBagItem = (itemId: number) => {
    setConfirmState({
      isOpen: true,
      title: tr(lang, '쿠폰 정리', 'Удалить купон'),
      message: tr(lang, '사용한 쿠폰을 가방에서 정리(삭제)하시겠습니까?', 'Удалить использованный купон из рюкзака?'),
      confirmText: tr(lang, '정리하기', 'Удалить'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        const { error } = await supabase!
          .from('inventory')
          .delete()
          .eq('id', itemId);

        if (!error) {
          await loadBag(currentUser?.name);
          showAlert(tr(lang, '🗑️ 쿠폰이 가방에서 정리되었습니다.', '🗑️ Купон удалён.'));
        } else {
          showAlert(tr(lang, '❌ 삭제 중 오류가 발생했습니다.', '❌ Ошибка удаления.'));
        }
      },
    });
  };
  // 🔄 내 쿠폰 가방 실시간 동기화 (선생님이 차감/삭제 시 새로고침 없이 즉시 반영)
  useEffect(() => {
    if (!currentUser?.name || !supabase) return;

    const channel = supabase
      .channel(`realtime-bag-${currentUser.name}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모두 감지
          schema: 'public',
          table: 'inventory',
        },
        (payload: any) => {
          const targetName = payload.new?.name || payload.old?.name;
          if (!targetName || targetName === currentUser.name) {
            loadBag(currentUser.name);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime 구독 상태:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.name]);
  // 🔔 실시간 알림 감지 (선생님 승인/송금 도착 시 즉시 갱신)
  useEffect(() => {
    if (!currentUser?.name || !supabase) return;
    loadNotifications(currentUser.name);

    const channel = supabase
      .channel(`realtime-noti-${currentUser.name}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_name=eq.${currentUser.name}`,
        },
        () => {
          loadNotifications(currentUser.name);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.name]);

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

  // 🚧 시스템 점검 모드 (관리자 제외 접속 차단)
  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/40 rounded-3xl p-7 shadow-2xl space-y-5 text-center">
          <div className="text-4xl">🚧</div>
          <h1 className="text-xl font-black text-amber-400">{tr(lang, '시스템 정기 점검 안내', 'Техническое обслуживание')}</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            {(notice === '우주 디지털 학급은행 시스템이 정상 가동 중입니다.'
              ? tr(lang, notice, 'Система Космического Банка Класса работает в штатном режиме.')
              : notice) || tr(lang, '현재 학급 은행 시스템 점검 중입니다. 잠시 후 다시 접속해주세요.', 'Система банка временно на обслуживании.')}
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => setLang('ko')} className={`px-3 py-1 rounded-lg text-xs font-bold ${lang === 'ko' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>한국어</button>
            <button type="button" onClick={() => setLang('ru')} className={`px-3 py-1 rounded-lg text-xs font-bold ${lang === 'ru' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Русский</button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch('/api/admin-auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: adminPwInput }),
                });
                if (res.ok) {
                  setLoginMode('Admin');
                  setAdminPwInput('');
                } else {
                  showAlert('❌ 비밀번호 불일치');
                }
              } catch {
                showAlert('❌ 인증 서버 연결 실패');
              }
            }}
            className="pt-3 border-t border-slate-800 space-y-2"
          >
            <input
              type="password"
              placeholder="선생님 관리자 비밀번호"
              value={adminPwInput}
              onChange={(e) => setAdminPwInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs text-center font-bold outline-none focus:border-indigo-500"
            />
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-xs font-bold">
              선생님 관제 센터 접속
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 로그인 전 메인
  if (loginMode === 'None') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* 우주 은하 글로우 배경 장식 */}
        <div className="pointer-events-none absolute -top-32 -left-24 w-80 h-80 bg-indigo-600/25 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-7 shadow-2xl shadow-indigo-950/50 space-y-6 relative z-10">
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setLang('ko')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${lang === 'ko' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400'}`}>한국어</button>
            <button type="button" onClick={() => setLang('ru')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${lang === 'ru' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400'}`}>Русский</button>
          </div>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">🚀</div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent tracking-tight">{tr(lang, '우주 디지털 학급은행', 'Космический Банк Класса')}</h1>
            <p className="text-xs text-slate-400">{tr(lang, '화성 테라포밍 경제 포털', 'Экономический портал')}</p>
          </div>
          {notice && (
            <div className="bg-indigo-950/60 p-3 rounded-2xl text-xs text-indigo-200 border border-indigo-500/30">
              ✨ {notice === '우주 디지털 학급은행 시스템이 정상 가동 중입니다.' ? tr(lang, notice, 'Система Космического Банка Класса работает в штатном режиме.') : notice}
            </div>
          )}
          <form onSubmit={handleStudentLogin} className="space-y-3">
            <input type="text" placeholder={tr(lang, '대원 이름 (실명)', 'Имя ученика')} value={loginName} onChange={e => setLoginName(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-50"/>
            <div className="relative">
              <input type={showLoginPw ? 'text' : 'password'} placeholder={tr(lang, '비밀번호', 'Пароль')} value={loginPw} onChange={e => setLoginPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 border border-slate-800 p-3.5 pr-11 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-50"/>
              <button type="button" onClick={() => setShowLoginPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1" aria-label={showLoginPw ? '비밀번호 숨기기' : '비밀번호 보기'}>
                {showLoginPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 py-3.5 rounded-xl font-bold text-sm shadow-lg transition disabled:opacity-50">{tr(lang, '통장 접속하기', 'Войти в банк')}</button>
          </form>
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button onClick={() => setShowSignupModal(true)} disabled={isProcessing} className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"><UserPlus size={16}/> {tr(lang, '처음 왔나요? 회원가입 신청', 'Регистрация нового ученика')}</button>
            <button onClick={() => setShowAdminModal(true)} disabled={isProcessing} className="w-full bg-slate-800 text-slate-400 py-2.5 rounded-xl font-bold text-xs border border-slate-700/60 flex items-center justify-center gap-1 active:scale-95 transition disabled:opacity-50"><ShieldCheck size={15}/> {tr(lang, '선생님 관제 센터', 'Панель учителя')}</button>
          </div>
        </div>

        {showSignupModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-3">
              <h3 className="font-bold text-emerald-400">{tr(lang, '대원 회원가입', 'Регистрация ученика')}</h3>
              <form onSubmit={handleStudentSignup} className="space-y-2.5 text-xs">
                <input type="text" placeholder={tr(lang, '실명 입력', 'Полное имя')} value={regName} onChange={e => setRegName(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <input type="password" placeholder={tr(lang, '접속 비밀번호', 'Пароль входа')} value={regPw} onChange={e => setRegPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <input type="password" placeholder={tr(lang, '송금 비밀번호(선택)', 'Платёжный пароль (необяз.)')} value={regTransferPw} onChange={e => setRegTransferPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowSignupModal(false)} disabled={isProcessing} className="flex-1 bg-slate-800 py-2.5 rounded-xl font-bold">{tr(lang, '취소', 'Отмена')}</button>
                  <button type="submit" disabled={isProcessing} className="flex-1 bg-emerald-600 py-2.5 rounded-xl font-bold">{tr(lang, '신청 완료', 'Отправить')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full space-y-3 text-center">
              <h3 className="font-bold text-indigo-400">{tr(lang, '선생님 접속', 'Вход для учителя')}</h3>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch('/api/admin-auth', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ password: adminPwInput }),
                    });
                    if (res.ok) {
                      setLoginMode('Admin');
                      setShowAdminModal(false);
                      setAdminPwInput('');
                    } else {
                      showAlert(tr(lang, '❌ 비밀번호 불일치', '❌ Неверный пароль'));
                    }
                  } catch {
                    showAlert(tr(lang, '❌ 인증 서버 연결 실패', '❌ Ошибка сервера'));
                  }
                }} 
                className="space-y-3"
              >
                <input 
                  type="password" 
                  autoFocus
                  placeholder={tr(lang, '마스터 비밀번호', 'Пароль учителя')} 
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
                    {tr(lang, '취소', 'Отмена')}
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl text-xs font-bold"
                  >
                    {tr(lang, '접속', 'Войти')}
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
                <p className="text-[11px] text-slate-400">{tr(lang, '데이터를 안전하게 처리하고 있습니다...', 'Безопасная обработка данных...')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 학생 메인 화면
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
      <header className="bg-gradient-to-br from-indigo-600 via-indigo-800 to-slate-900 p-6 rounded-b-[2.25rem] shadow-2xl shadow-indigo-950/60 border-b border-indigo-400/20 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl" />
        <div className="flex justify-between items-center mb-3 relative z-10">
          <span className="font-black text-[11px] tracking-widest text-indigo-200/90 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SPACE CLASS BANK
          </span>
          
          {/* 우측 아이콘 묶음 (언어 + 종 모양 + 로그아웃) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLang(l => (l === 'ko' ? 'ru' : 'ko'))}
              className="bg-black/30 px-2.5 py-1 rounded-full text-[10px] font-bold hover:bg-black/50 transition text-indigo-100"
              title={tr(lang, '언어 전환 (러시아어)', 'Сменить язык (Корейский)')}
            >
              {lang === 'ko' ? '🇰🇷 한국어' : '🇷🇺 RU'}
            </button>
            <button 
              onClick={() => {
                setShowNotiModal(true);
                handleReadAllNoti();
              }} 
              className="bg-black/30 p-1.5 rounded-full text-xs hover:bg-black/50 transition relative text-white"
              title={tr(lang, '알림함', 'Уведомления')}
            >
              <Bell size={14} />
              {/* 읽지 않은 알림이 있으면 빨간 점 표시 */}
              {hasUnreadNoti && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                </>
              )}
            </button>

            <button onClick={handleLogout} title={tr(lang, '로그아웃', 'Выйти')} aria-label={tr(lang, '로그아웃', 'Выйти')} className="bg-black/30 p-1.5 rounded-full text-xs hover:bg-black/50 transition text-white">
              <LogOut size={14}/>
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-white">{currentUser?.name} {tr(lang, '대원', '')}</span>
          <span className="text-xs text-indigo-200">({currentUser?.job === '우주 시민' ? tr(lang, '우주 시민', 'Гражданин космоса') : (currentUser?.job || tr(lang, '우주 시민', 'Гражданин космоса'))})</span>
          {currentUser?.part_time_job && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
              🛠️ {tr(lang, '알바:', 'Подработка:')} {currentUser.part_time_job} (+{currentUser.bonus_salary || 0}{tr(lang, '안', 'ан')})
            </span>
          )}
        </div>

        <div className="text-4xl font-black text-yellow-300 mt-1">
          {myBalance.toLocaleString()} <span className="text-lg text-yellow-400">{tr(lang, '안', 'ан')}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2">
          <span className="bg-yellow-400/20 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-yellow-400/30">
            {getCreditTier(myBalance, lang)}
          </span>

          {myDepositBalance > 0 && (
            <span className="bg-blue-400/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-400/30">
              🏦 {tr(lang, '예금:', 'Вклад:')} {myDepositBalance.toLocaleString()}{tr(lang, '안', 'ан')}
            </span>
          )}

          {Number(currentUser?.loan_balance || 0) > 0 && (
            <button type="button" onClick={() => setActiveTab('loan')} className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-500/30 hover:bg-rose-500/30 transition">
              💳 {tr(lang, '대출:', 'Долг:')} {Number(currentUser.loan_balance).toLocaleString()}{tr(lang, '안', 'ан')}
            </button>
          )}

          {mySeat ? (
            <span className="bg-indigo-400/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-400/30 flex items-center gap-1">
              🪑 {tr(lang, `좌석: ${mySeat.seat}번 (주 ${mySeat.rent || mySeat.floor_price || 30}안)`, `Место: №${mySeat.seat} (${mySeat.rent || mySeat.floor_price || 30} ан/нед)`)}
            </span>
          ) : (
            <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-700">
              🪑 {tr(lang, '좌석: 미배정 (공실)', 'Место: не назначено')}
            </span>
          )}
        </div>
      </header>

      {currentUser?.dunning === 'ON' && !isFrozen && (
        <div className="bg-rose-900/60 p-3 mx-4 mt-4 rounded-xl text-xs text-rose-200 border-l-4 border-rose-500">
          🚨 <strong>{tr(lang, '중앙은행 독촉장:', 'Предупреждение о долге:')}</strong> {tr(lang, '대출이 연체되었습니다. 즉시 상환해주세요!', 'Погасите кредит как можно скорее!')}
        </div>
      )}

      {currentUser?.name && systemConfigs[`notice_${currentUser.name}`] && (
        <div className="bg-emerald-950/70 border border-emerald-500/40 p-3 mx-4 mt-3 rounded-xl text-xs text-emerald-200">
          <p className="font-bold text-emerald-300 mb-0.5">📩 {tr(lang, '선생님 개인 쪽지', 'Личное сообщение от учителя')}</p>
          <p className="leading-relaxed">{systemConfigs[`notice_${currentUser.name}`]}</p>
        </div>
      )}

      <main className="p-4 space-y-4">
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setActiveTab('transfer')} disabled={isProcessing} className="bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 shadow-lg shadow-indigo-950/50 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-white/15"><ArrowRightLeft size={16}/></span>
                {tr(lang, '송금', 'Перевод')}
              </button>
              <button onClick={() => setActiveTab('deposit')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-yellow-500/15 text-yellow-400"><Landmark size={16}/></span>
                {tr(lang, '예금', 'Вклад')}
              </button>
              <button onClick={() => setActiveTab('loan')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className={`p-1.5 rounded-xl ${currentUser?.loan_balance > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}><AlertTriangle size={16}/></span>
                {tr(lang, '대출상환', 'Кредит')}
              </button>
              <button onClick={() => setActiveTab('withdraw')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-sky-500/15 text-sky-300"><Receipt size={16}/></span>
                {tr(lang, '출금', 'Снятие')}
              </button>
              <button onClick={() => setActiveTab('fund')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-purple-500/15 text-purple-400"><TrendingUp size={16}/></span>
                {tr(lang, '펀드', 'Фонд')}
              </button>
              <button onClick={() => setActiveTab('payslip')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400"><FileText size={16}/></span>
                {tr(lang, '명세서', 'Квитанции')}
              </button>
              <button onClick={() => setActiveTab('settings')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-slate-700/40 text-slate-300"><Settings size={16}/></span>
                {tr(lang, '비번관리', 'Пароль')}
              </button>
              <button onClick={() => setActiveTab('parttime')} disabled={isProcessing} className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 p-3 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400"><Briefcase size={16}/></span>
                {tr(lang, '알바센터', 'Подработка')}
              </button>
            </div>
            {/* 👨‍💼 은행원으로 지정된 학생에게만 나타나는 특수 배너 */}
            {currentUser?.name === bankerName && (
              <button
                onClick={() => setActiveTab('banker')}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-amber-600/30 to-amber-900/40 border border-amber-500/50 p-3 rounded-2xl flex items-center justify-between shadow-lg active:scale-95 transition"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="bg-amber-500 text-slate-950 p-2 rounded-xl font-black text-sm">🏧</div>
                  <div>
                    <p className="font-bold text-xs text-amber-300">{tr(lang, '학급 은행원 관제 데스크', 'Панель банкира')}</p>
                    <p className="text-[10px] text-amber-200/70">
                      {tr(lang, `대기 중인 출금 신청: ${pendingWithdrawals.length}건`, `Заявок на снятие: ${pendingWithdrawals.length}`)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/40">
                  {tr(lang, '열기 ➔', 'Открыть ➔')}
                </span>
              </button>
            )}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-400">{tr(lang, '최근 입출금 내역', 'История операций')}</h3>
                {myTrans.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTrans(v => !v)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    {showAllTrans ? tr(lang, '접기', 'Свернуть') : tr(lang, `더 보기 (${myTrans.length}건)`, `Все (${myTrans.length})`)}
                  </button>
                )}
              </div>
              {myTrans.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">{tr(lang, '아직 입출금 내역이 없습니다.', 'Операций пока нет.')}</p>
              ) : (
                (showAllTrans ? myTrans.slice(0, 30) : myTrans.slice(0, 5)).map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 last:border-none">
                    <div><p className="font-bold">{t.note || t.type}</p><p className="text-[10px] text-slate-500">{t.date}</p></div>
                    <span className={`font-black ${Number(t.amount) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(t.amount) > 0 ? `+${Number(t.amount).toLocaleString()}` : Number(t.amount).toLocaleString()} {tr(lang, '안', 'ан')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (() => {
          const transferCandidates = userList
            .filter(u => u.name !== currentUser?.name && u.status === 'Approved')
            .filter(u => !transferSearch.trim() || u.name.toLowerCase().includes(transferSearch.trim().toLowerCase()));
          const parsedTransferAmt = Number(transferAmt) || 0;
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-indigo-400 text-sm">{tr(lang, '안전 송금', 'Перевод средств')}</h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white flex items-center gap-0.5"><ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}</button>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-slate-400">{tr(lang, '보유 잔액', 'Баланс')}</span>
                <span className="font-black text-yellow-300">{myBalance.toLocaleString()} {tr(lang, '안', 'ан')}</span>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder={tr(lang, '받는 대원 이름 검색...', 'Поиск получателя...')}
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-slate-950 pl-8 pr-3 py-2.5 rounded-xl border border-slate-800 font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              </div>
              <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50">
                <option value="">{tr(lang, `받는 대원 선택 (${transferCandidates.length}명)`, `Выберите получателя (${transferCandidates.length})`)}</option>
                {transferCandidates.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
              <input type="number" placeholder={tr(lang, '보낼 금액', 'Сумма перевода')} value={transferAmt} onChange={e => setTransferAmt(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
              <div className="grid grid-cols-5 gap-1.5">
                {[10, 50, 100].map(v => (
                  <button key={v} type="button" onClick={() => setTransferAmt(String((Number(transferAmt) || 0) + v))} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg font-bold text-[11px] transition">+{v}</button>
                ))}
                <button type="button" onClick={() => setTransferAmt(String(Math.max(0, myBalance)))} disabled={isProcessing} className="bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '전액', 'Всё')}</button>
                <button type="button" onClick={() => setTransferAmt('')} disabled={isProcessing} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '초기화', 'Сброс')}</button>
              </div>
              {parsedTransferAmt > 0 && (
                <div className="flex justify-between items-center text-[11px] bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400">{tr(lang, '송금 후 예상 잔액', 'Остаток после перевода')}</span>
                  <span className={`font-black ${myBalance - parsedTransferAmt < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {(myBalance - parsedTransferAmt).toLocaleString()} {tr(lang, '안', 'ан')}
                  </span>
                </div>
              )}
              <input type="password" placeholder={tr(lang, '송금 비밀번호', 'Платёжный пароль')} value={transferPw} onChange={e => setTransferPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
              <button onClick={handleTransfer} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold active:scale-95 transition disabled:opacity-50">{tr(lang, '송금 실행', 'Отправить')}</button>
            </div>
          );
        })()}

        {activeTab === 'withdraw' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-indigo-400 text-sm">{tr(lang, '현금 출금 사전 신청', 'Заявка на снятие наличных')}</h2>
              <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white flex items-center gap-0.5"><ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}</button>
            </div>
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 flex justify-between items-center">
              <span className="text-slate-400">{tr(lang, '출금 가능 잔액', 'Доступно')}</span>
              <span className="font-black text-yellow-300">{myBalance.toLocaleString()} {tr(lang, '안', 'ан')}</span>
            </div>
            <input type="number" placeholder={tr(lang, '출금액', 'Сумма')} value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 50, 100].map(v => (
                <button key={v} type="button" onClick={() => setWithdrawAmt(String((Number(withdrawAmt) || 0) + v))} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg font-bold text-[11px] transition">+{v}</button>
              ))}
              <button type="button" onClick={() => setWithdrawAmt(String(Math.max(0, myBalance)))} disabled={isProcessing} className="bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '전액', 'Всё')}</button>
              <button type="button" onClick={() => setWithdrawAmt('')} disabled={isProcessing} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '초기화', 'Сброс')}</button>
            </div>
            <input type="password" placeholder={tr(lang, '비밀번호', 'Пароль')} value={withdrawPw} onChange={e => setWithdrawPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <button onClick={handleWithdraw} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold active:scale-95 transition disabled:opacity-50">{tr(lang, '신청하기', 'Подать заявку')}</button>
          </div>
        )}

        {activeTab === 'deposit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-1">
              <h2 className="font-bold text-yellow-400 text-sm flex items-center gap-1.5">
                <span>🏛️</span> {tr(lang, '정기예금 센터', 'Срочные вклады')}
              </h2>
              <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white p-1 flex items-center gap-0.5">
                <ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}
              </button>
            </div>

            {/* 내가 가입한 예금 현황 목록 */}
            <div className="space-y-2">
              <p className="font-bold text-slate-300 flex items-center justify-between text-xs">
                <span>📋 {tr(lang, '내 예금 보유 현황', 'Мои вклады')}</span>
                <span className="text-[11px] text-indigo-400 font-normal">
                  {tr(lang, `총 ${myActiveDeposits.length}건`, `Всего: ${myActiveDeposits.length}`)}
                </span>
              </p>

              {myActiveDeposits.length === 0 ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-slate-500">
                  {tr(lang, '현재 가입 중인 정기예금이 없습니다.', 'У вас нет активных вкладов.')}
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {myActiveDeposits.map((d: any) => {
                      const parts = Object.fromEntries(
                        (d.note || '').split('|').map((p: string) => {
                          const [k, ...v] = p.split(':');
                          return [k ? k.trim() : '', v.join(':').trim()];
                        })
                      );
                      const prin = parseInt(parts['원금'] || String(Math.abs(d.amount || 0)));
                      const rate = parseInt(parts['이율'] || '0');
                      const expiry = parts['만기'] || tr(lang, '미정', 'Не указано');
                      const expNet = prin + Math.floor(prin * (rate / 100) * 0.85);

                      return (
                        <div key={d.id} className="bg-slate-950 border border-indigo-500/30 p-3.5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-indigo-300">{tr(lang, `정기예금 (${rate}%)`, `Вклад (${rate}%)`)}</span>
                            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                              {tr(lang, '만기일:', 'Срок:')} {expiry}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-lg text-center">
                            <div>
                              <p className="text-[10px] text-slate-400">{tr(lang, '예치 원금', 'Сумма вклада')}</p>
                              <p className="font-bold text-white mt-0.5">{prin.toLocaleString()}{tr(lang, '안', 'ан')}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">{tr(lang, '만기 세후 수령액', 'К получению')}</p>
                              <p className="font-bold text-emerald-400 mt-0.5">+{expNet.toLocaleString()}{tr(lang, '안', 'ан')}</p>
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
              <p className="font-bold text-slate-300">➕ {tr(lang, '신규 예금 가입', 'Новый вклад')}</p>
              {!depositOpen ? (
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-1.5">
                  <p className="text-xl">🔒</p>
                  <p className="text-xs font-bold text-slate-300">{tr(lang, '현재 신규 가입 창구가 닫혀 있습니다.', 'Приём вкладов закрыт.')}</p>
                  <p className="text-[11px] text-slate-500">{tr(lang, '선생님이 예금 가입 기간을 오픈할 때까지 기다려주세요.', 'Дождитесь открытия окна вкладов учителем.')}</p>
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
                      {tr(lang, '단기 (7일, 3%)', 'Краткий (7 дн., 3%)')}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDepositType('long')} 
                      disabled={isProcessing}
                      className={`p-3 rounded-xl border font-bold transition disabled:opacity-50 ${depositType === 'long' ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                    >
                      {tr(lang, '장기 (28일, 15%)', 'Долгий (28 дн., 15%)')}
                    </button>
                  </div>
                  <input 
                    type="number" 
                    placeholder={tr(lang, '예금할 금액 (최소 10안)', 'Сумма (мин. 10 ан)')} 
                    value={depositAmt} 
                    onChange={e => setDepositAmt(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <input 
                    type="password" 
                    placeholder={tr(lang, '비밀번호', 'Пароль')} 
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
                    {tr(lang, '예금 개설', 'Открыть вклад')}
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
                <AlertTriangle size={16} /> {tr(lang, '대출금 상환', 'Погашение кредита')}
              </h2>
              <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-xs text-slate-400 hover:text-white flex items-center gap-0.5">
                <ChevronLeft size={14} /> {tr(lang, '뒤로가기', 'Назад')}
              </button>
            </div>

            {Number(currentUser?.loan_balance || 0) <= 0 ? (
              <div className="p-8 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                <p className="text-3xl">🎉</p>
                <p className="text-sm font-bold text-emerald-400">{tr(lang, '현재 갚아야 할 대출이 없습니다!', 'У вас нет текущих кредитов!')}</p>
                <p className="text-xs text-slate-500">{tr(lang, '대출금이 발생하면 이곳에서 자진 상환할 수 있습니다.', 'Если появится долг, его можно погасить здесь.')}</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-rose-950/40 rounded-xl text-center border border-rose-500/20">
                  <p className="text-xs text-rose-300">{tr(lang, '현재 남은 대출 잔액', 'Остаток долга')}</p>
                  <p className="text-2xl font-black text-rose-400">{currentUser?.loan_balance} {tr(lang, '안', 'ан')}</p>
                </div>
                <div className="space-y-2 text-xs">
                  <label className="block text-slate-400">{tr(lang, `상환할 금액 (최대 ${currentUser?.loan_balance}안)`, `Сумма погашения (макс. ${currentUser?.loan_balance} ан)`)}</label>
                  <input 
                    type="number" 
                    placeholder={tr(lang, '금액 입력', 'Введите сумму')} 
                    value={repayAmt} 
                    onChange={e => setRepayAmt(e.target.value)} 
                    disabled={isProcessing}
                    className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold text-white disabled:opacity-50"
                  />
                  <div className="grid grid-cols-5 gap-1.5">
                    {[10, 50].map(v => (
                      <button key={v} type="button" onClick={() => setRepayAmt(String(Math.min(Number(currentUser?.loan_balance || 0), (Number(repayAmt) || 0) + v)))} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg font-bold text-[11px] transition">+{v}</button>
                    ))}
                    <button type="button" onClick={() => setRepayAmt(String(Math.max(1, Math.floor(Math.min(myBalance, Number(currentUser?.loan_balance || 0)) / 2))))} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '절반', '50%')}</button>
                    <button type="button" onClick={() => setRepayAmt(String(Math.max(0, Math.min(myBalance, Number(currentUser?.loan_balance || 0)))))} disabled={isProcessing} className="bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '전액', 'Всё')}</button>
                    <button type="button" onClick={() => setRepayAmt('')} disabled={isProcessing} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 py-1.5 rounded-lg font-bold text-[11px] transition">{tr(lang, '초기화', 'Сброс')}</button>
                  </div>
                  <label className="block text-slate-400 pt-1">{tr(lang, '결제용 2차 비밀번호', 'Платёжный пароль')}</label>
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
                  {tr(lang, '대출금 상환하기', 'Погасить кредит')}
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'payslip' && (() => {
          const payslips = myTrans.filter(t => t.type === '주급' || t.type === '임대료 납부');
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-indigo-400 text-sm">{tr(lang, '주급 및 임대료 명세서', 'Квитанции зарплаты и аренды')}</h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white flex items-center gap-0.5"><ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}</button>
              </div>
              {payslips.length === 0 ? (
                <p className="text-center text-slate-500 py-8">{tr(lang, '아직 지급된 주급이나 납부된 임대료 명세서가 없습니다.', 'Квитанций пока нет.')}</p>
              ) : (
                payslips.map(t => (
                  <div key={t.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex justify-between font-bold"><span className={t.type === '주급' ? 'text-emerald-400' : 'text-rose-400'}>{t.type === '주급' ? tr(lang, '주급', 'Зарплата') : tr(lang, '임대료 납부', 'Аренда')}</span><span>{Number(t.amount).toLocaleString()}{tr(lang, '안', 'ан')}</span></div>
                    <p className="text-[10px] text-slate-400 mt-1">{t.note} ({t.date})</p>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {activeTab === 'settings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center"><h2 className="font-bold text-slate-300 text-sm">{tr(lang, '비밀번호 관리', 'Смена пароля')}</h2><button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white flex items-center gap-0.5"><ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}</button></div>
            <input type="password" placeholder={tr(lang, '새 비밀번호', 'Новый пароль')} value={newLoginPw} onChange={e => setNewLoginPw(e.target.value)} disabled={isProcessing} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 font-bold disabled:opacity-50"/>
            <button
              onClick={async () => {
                if (!newLoginPw.trim()) {
                  showAlert(tr(lang, '⚠️ 새 비밀번호를 입력해주세요.', '⚠️ Введите новый пароль.'));
                  return;
                }
                await runStudentTask(tr(lang, '비밀번호 변경 중...', 'Смена пароля...'), async () => {
                  await supabase!.from('users').update({ password: newLoginPw.trim() }).eq('name', currentUser?.name);
                  setNewLoginPw('');
                  setActiveTab('wallet');
                  await loadData();
                  showAlert(tr(lang, '✅ 비밀번호 변경 완료!', '✅ Пароль изменён!'));
                });
              }}
              disabled={isProcessing}
              className="w-full bg-slate-800 active:scale-95 py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {tr(lang, '저장하기', 'Сохранить')}
            </button>
          </div>
        )}

        {/* 📈 학생 펀드 투자 센터 */}
        {activeTab === 'fund' && (() => {
          const fundsArray = Array.isArray(fundData) ? fundData : (fundData ? [fundData] : []);

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-800">
                <h2 className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                  <span>📈</span> {tr(lang, '학급 경제 펀드 투자 센터', 'Инвестиционный центр (Фонды)')}
                </h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white p-1 flex items-center gap-0.5">
                  <ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}
                </button>
              </div>

              {fundsArray.length === 0 ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-500">
                  {tr(lang, '현재 운용 중인 펀드 상품이 없습니다.', 'Активных фондов пока нет.')}
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
                          📰 <b>{tr(lang, '[어제의 뉴스]', '[Новости]')}</b> {f.news}
                        </div>
                      )}
                      {f.hint && (
                        <div className="bg-slate-900/90 p-2.5 rounded-lg text-[11px] text-amber-200 border border-amber-500/20">
                          💡 <b>{tr(lang, '[오늘의 힌트]', '[Подсказка]')}</b> {f.hint}
                        </div>
                      )}

                      {/* 내 투자 현황 */}
                      {myInvestAmt > 0 && (
                        <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-lg space-y-2">
                          <div className="flex justify-between font-bold">
                            <span className="text-purple-300">{tr(lang, '내 투자 원금:', 'Вложено:')} {myInvestAmt.toLocaleString()}{tr(lang, '안', 'ан')}</span>
                            <span className={Number(myYield) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {tr(lang, '평가액:', 'Оценка:')} {myCurrentVal.toLocaleString()}{tr(lang, '안', 'ан')} ({Number(myYield) >= 0 ? `+${myYield}` : myYield}%)
                            </span>
                          </div>

                          <button 
                            onClick={() => {
                              if (isFrozen) { showAlert(tr(lang, '❄️ 방학 중에는 환매할 수 없습니다.', '❄️ Вывод недоступен на каникулах.')); return; }
                              setConfirmState({
                                isOpen: true,
                                title: tr(lang, '펀드 중도 해지 환매', 'Досрочный вывод из фонда'),
                                message: tr(lang, `중도 해지 시 수수료(${penaltyRate}%)가 차감된 ${refundNet.toLocaleString()}안이 입금됩니다.\n진행하시겠습니까?`, `После комиссии (${penaltyRate}%) будет зачислено ${refundNet.toLocaleString()} ан.\nПродолжить?`),
                                confirmText: tr(lang, '환매하기', 'Вывести'),
                                variant: 'warning',
                                onConfirm: async () => {
                                  setConfirmState((prev) => ({ ...prev, isOpen: false }));
                                  await runStudentTask(tr(lang, `📈 [${f.name}] 중도 환매 처리 중...`, `📈 Вывод из [${f.name}]...`), async () => {
                                    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                                    await supabase!.from('transactions').insert([
                                      { date: nowStr, name: currentUser?.name, type: '펀드 환매', amount: refundNet, note: `${f.name} 조기 환매`, status: 'Success' },
                                      { date: nowStr, name: '국고(중앙은행)', type: '펀드 환매 지급', amount: -refundNet, note: `${currentUser?.name} 환매`, status: 'Success' }
                                    ]);
                                    await supabase!.from('transactions').update({ status: `Fund_${f.fund_id}_Closed` }).eq('name', currentUser?.name).eq('status', `Fund_${f.fund_id}`);
                                    await loadData();
                                  });
                                  showAlert(tr(lang, `✅ [${f.name}] 환매 대금 ${refundNet.toLocaleString()}안이 입금되었습니다.`, `✅ Получено ${refundNet.toLocaleString()} ан!`));
                                },
                              });
                            }}
                            disabled={isProcessing}
                            className="w-full bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 py-1.5 rounded-lg font-bold text-[10px] active:scale-95 transition"
                          >
                            ⚡ {tr(lang, `조기 환매 (수수료 ${penaltyRate}% 차감 후 ${refundNet.toLocaleString()}안 수령)`, `Вывести (комиссия ${penaltyRate}%, к получению ${refundNet.toLocaleString()} ан)`)}
                          </button>
                        </div>
                      )}

                      {/* 신규 매수 폼 */}
                      <div className="pt-2 border-t border-slate-800 flex gap-2">
                        <input 
                          type="number" 
                          id={`fund-buy-${f.fund_id}`}
                          placeholder={tr(lang, '투자할 금액 (최소 10안)', 'Сумма (мин. 10 ан)')} 
                          className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold text-xs outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={async () => {
                            if (isFrozen) { showAlert(tr(lang, '❄️ 방학 중에는 펀드에 투자할 수 없습니다.', '❄️ Инвестиции недоступны на каникулах.')); return; }
                            const buyInput = document.getElementById(`fund-buy-${f.fund_id}`) as HTMLInputElement;
                            const amt = parseInt(buyInput?.value || '0');
                            if (isNaN(amt) || amt < 10) { showAlert(tr(lang, '⚠️ 최소 10안 이상부터 투자 가능합니다.', '⚠️ Минимум 10 ан.')); return; }
                            if (myBalance < amt) { showAlert(tr(lang, '❌ 통장 잔액이 부족합니다.', '❌ Недостаточно средств.')); return; }

                            await runStudentTask(tr(lang, `📈 [${f.name}] 펀드 매수 중...`, `📈 Покупка паёв [${f.name}]...`), async () => {
                              const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                              await supabase!.from('transactions').insert([
                                { date: nowStr, name: currentUser?.name, type: '펀드 가입', amount: -amt, note: `${f.name}|${currIdx}`, status: `Fund_${f.fund_id}` },
                                { date: nowStr, name: '국고(중앙은행)', type: '펀드 예치금', amount: amt, note: `${currentUser?.name} 가입 예치`, status: 'Success' }
                              ]);
                              buyInput.value = '';
                              await loadData();
                            });
                            showAlert(tr(lang, `🚀 [${f.name}] 펀드 ${amt.toLocaleString()}안 매수 완료!`, `🚀 Куплено [${f.name}] на ${amt.toLocaleString()} ан!`));
                          }}
                          disabled={isProcessing}
                          className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white px-4 py-2 rounded-lg font-bold text-xs transition"
                        >
                          {tr(lang, '매수', 'Купить')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}
        {/* 👨‍💼 은행원 전용 출금 요청 처리 데스크 */}
        {activeTab === 'banker' && currentUser?.name === bankerName && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h2 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <span>👨‍💼</span> {tr(lang, '은행원 출금 관리 데스크', 'Панель выдачи наличных')}
                </h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white p-1 flex items-center gap-0.5">
                  <ChevronLeft size={16}/> {tr(lang, '돌아가기', 'Назад')}
                </button>
              </div>

              {pendingWithdrawals.length === 0 ? (
                <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center space-y-2">
                  <p className="text-3xl">☕</p>
                  <p className="text-sm font-bold text-emerald-400">{tr(lang, '대기 중인 출금 요청이 없습니다.', 'Ожидающих заявок нет.')}</p>
                  <p className="text-slate-500 text-[11px]">{tr(lang, '친구들이 현금 출금을 신청하면 여기에 실시간으로 표시됩니다.', 'Новые заявки учеников появятся здесь.')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-bold text-slate-300 flex justify-between items-center">
                    <span>📋 {tr(lang, '출금 대기 명단', 'Список заявок')}</span>
                    <span className="text-amber-400 font-normal">{tr(lang, `${pendingWithdrawals.length}건 대기 중`, `Ожидает: ${pendingWithdrawals.length}`)}</span>
                  </p>

                  {pendingWithdrawals.map(w => {
                    const reqAmt = Math.abs(Number(w.amount || 0));

                    return (
                      <div key={w.id} className="bg-slate-950 border border-amber-500/30 p-3.5 rounded-xl space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-white">{w.name}</span>
                          <span className="text-[10px] text-slate-400">{w.date}</span>
                        </div>

                        <div className="bg-slate-900 p-2.5 rounded-lg flex justify-between items-center">
                          <span className="text-slate-400">{tr(lang, '출금 요청액', 'Сумма снятия')}</span>
                          <span className="text-base font-black text-yellow-300">{reqAmt.toLocaleString()} {tr(lang, '안', 'ан')}</span>
                        </div>

                        <div className="flex gap-2 pt-1">
                          {/* 거절 버튼 */}
                          <button
                            onClick={() => {
                              setConfirmState({
                                isOpen: true,
                                title: tr(lang, '출금 요청 거절', 'Отклонить заявку'),
                                message: tr(lang, `[${w.name}] 대원의 ${reqAmt.toLocaleString()}안 출금 요청을 거절하시겠습니까?\n거절 시 요청 금액이 대원 통장으로 자동 환불됩니다.`, `Отклонить заявку ${w.name} на ${reqAmt.toLocaleString()} ан?\nСредства вернутся на счёт.`),
                                confirmText: tr(lang, '거절 및 환불', 'Отклонить'),
                                variant: 'danger',
                                onConfirm: async () => {
                                  setConfirmState((prev) => ({ ...prev, isOpen: false }));
                                  await runStudentTask(tr(lang, `[${w.name}] 출금 반려 처리 중...`, `Отклонение заявки ${w.name}...`), async () => {
                                    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                                    await Promise.all([
                                      supabase!.from('transactions').update({ status: 'Rejected_W' }).eq('id', w.id),
                                      supabase!.from('transactions').insert([
                                        {
                                          date: nowStr,
                                          name: w.name,
                                          type: '출금 반려 환불',
                                          amount: reqAmt,
                                          note: `현금 출금 요청 반려로 인한 잔액 환불 (은행원: ${currentUser.name})`,
                                          status: 'Success'
                                        }
                                      ]),
                                    ]);
                                    await loadData();
                                  });
                                  showAlert(tr(lang, `❌ [${w.name}] 대원의 출금을 거절(환불 완료)했습니다.`, `❌ Заявка ${w.name} отклонена (возврат).`));
                                },
                              });
                            }}
                            disabled={isProcessing}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg font-bold text-xs active:scale-95 transition"
                          >
                            {tr(lang, '거절', 'Отклонить')}
                          </button>

                          {/* 승인 버튼 */}
                          <button
                            onClick={async () => {
                              await runStudentTask(tr(lang, `[${w.name}] 출금 승인 처리 중...`, `Подтверждение для ${w.name}...`), async () => {
                                await supabase!.from('transactions').update({ status: 'Success' }).eq('id', w.id);
                                await loadData();
                              });
                              showAlert(tr(lang, `✅ [${w.name}] 대원의 ${reqAmt}안 현금 출금을 승인했습니다!`, `✅ Выдача ${reqAmt} ан для ${w.name} подтверждена!`));
                            }}
                            disabled={isProcessing}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-xs active:scale-95 transition shadow"
                          >
                            {tr(lang, '현금 지급 완료 (승인)', 'Выдано (Одобрить)')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}

        {activeTab === 'parttime' && (() => {
          const allJobs = parsePartTimeJobs(systemConfigs.part_time_jobs);
          const myLoan = Number(currentUser?.loan_balance || 0);
          const visibleJobs = allJobs.filter(
            (j) =>
              (j.status === 'Open' || j.applicants?.some((a) => a.name === currentUser?.name)) &&
              canViewPartTimeJob(j, currentUser?.name || '', myBalance, myLoan)
          );

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <Briefcase size={16} /> {tr(lang, '학급 아르바이트 센터', 'Подработка в классе')}
                </h2>
                <button onClick={() => setActiveTab('wallet')} disabled={isProcessing} className="text-slate-400 hover:text-white flex items-center gap-0.5">
                  <ChevronLeft size={16} /> {tr(lang, '돌아가기', 'Назад')}
                </button>
              </div>

              {myLoan > 0 && (
                <div className="bg-indigo-950/50 border border-indigo-500/30 p-3 rounded-xl text-indigo-200">
                  💸 {tr(lang, `현재 대출 잔액이 ${myLoan.toLocaleString()}안 있습니다. 아르바이트 급여로 대출을 갚을 수 있어요!`, `Текущий долг: ${myLoan.toLocaleString()} ан. Можно погасить подработкой!`)}
                </div>
              )}

              {visibleJobs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">{tr(lang, '현재 참여할 수 있는 아르바이트 공고가 없습니다.', 'Нет доступных заданий.')}</p>
              ) : (
                visibleJobs.map((job) => {
                  const activeApps = (job.applicants || []).filter((a) => a.status !== 'Rejected');
                  const myApp = (job.applicants || []).find((a) => a.name === currentUser?.name);
                  return (
                    <div key={job.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-white">💼 {job.title}</span>
                        <span className="font-black text-yellow-300">{job.pay.toLocaleString()} 안</span>
                      </div>
                      {job.desc && <p className="text-slate-400">{job.desc}</p>}
                      <p className="text-[11px] text-slate-500">
                        👥 {activeApps.length}/{job.slots}명 · {job.auto_repay ? tr(lang, '💳 대출 우선 상환', '💳 Погашение долга') : ''} · {job.created_at}
                      </p>
                      {myApp ? (
                        <div className={`p-2.5 rounded-lg font-bold text-center ${
                          myApp.status === 'Paid'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : myApp.status === 'Rejected'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        }`}>
                          {myApp.status === 'Paid'
                            ? tr(lang, '✅ 완료 및 급여 지급 완료!', '✅ Оплачено!')
                            : myApp.status === 'Rejected'
                            ? tr(lang, '❌ 이번 공고에는 선발되지 않았습니다.', '❌ Отклонено.')
                            : tr(lang, '⏳ 지원 완료! 선생님 확인 후 급여가 지급됩니다.', '⏳ Заявка на рассмотрении.')}
                        </div>
                      ) : job.status !== 'Open' ? (
                        <div className="bg-slate-900 p-2 rounded-lg text-center text-slate-400">{tr(lang, '🔒 마감된 공고입니다.', '🔒 Закрыто.')}</div>
                      ) : activeApps.length >= job.slots ? (
                        <div className="bg-slate-900 p-2 rounded-lg text-center text-slate-400">{tr(lang, '👥 모집 정원이 마감되었습니다.', '👥 Мест нет.')}</div>
                      ) : (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={async () => {
                            await runStudentTask('💼 아르바이트 지원 중...', async () => {
                              const { data: cfgRow } = await supabase!
                                .from('system_config')
                                .select('value')
                                .eq('key', 'part_time_jobs')
                                .single();
                              const latestJobs = parsePartTimeJobs(cfgRow?.value || systemConfigs.part_time_jobs);
                              const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                              const updatedJobs = latestJobs.map((lj) => {
                                if (lj.id !== job.id) return lj;
                                if (lj.applicants?.some((a) => a.name === currentUser?.name)) return lj;
                                return {
                                  ...lj,
                                  applicants: [
                                    ...(lj.applicants || []),
                                    { name: currentUser.name, applied_at: nowStr, status: 'Pending' as const },
                                  ],
                                };
                              });
                              await supabase!
                                .from('system_config')
                                .upsert({ key: 'part_time_jobs', value: JSON.stringify(updatedJobs) }, { onConflict: 'key' });
                              await loadData();
                            });
                            showAlert('🙋 아르바이트 지원이 완료되었습니다!');
                          }}
                          className="w-full bg-amber-600 hover:bg-amber-500 py-2.5 rounded-xl font-bold transition active:scale-95"
                        >
                          🙋 {tr(lang, '아르바이트 지원하기', 'Откликнуться')}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}

        {activeTab === 'store' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🛒 {tr(lang, '우주 매점', 'Магазин класса')}</h2>
            {shopItems.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
                {tr(lang, '등록된 상품이 없습니다.', 'Товаров пока нет.')}
              </div>
            )}
            {shopItems.map(item => {
              const isOutOfStock = Number(item.stock ?? 0) <= 0;
              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold">{item.name}</h3>
                      {item.promotion === '특가' && (
                        <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
                          {tr(lang, '특가', 'Акция')}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-[10px] text-slate-400">{item.description}</p>}
                    <p className="text-[10px] text-slate-500">{tr(lang, `재고 ${item.stock}개 | 가격 ${item.price}안`, `Остаток: ${item.stock} | Цена: ${item.price} ан`)}</p>
                  </div>
                  <button
                    onClick={() => handleBuyItem(item)}
                    disabled={isProcessing || isOutOfStock}
                    className={`px-4 py-2 rounded-xl font-bold transition disabled:opacity-50 ${
                      isOutOfStock ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
                    }`}
                  >
                    {isOutOfStock ? tr(lang, '품절', 'Нет') : tr(lang, '구매', 'Купить')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'bag' && (
          <div className="space-y-3">
            <h2 className="font-bold text-indigo-400 text-sm">🎒 {tr(lang, '내 쿠폰 가방', 'Мой рюкзак')}</h2>
            {bagItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">{tr(lang, '가방이 비어 있습니다.', 'Рюкзак пуст.')}</div>
            ) : (
              bagItems.map(b => {
                const isUsed = b.status === 'Used' || (b.remaining_uses !== undefined && b.remaining_uses <= 0);
                const totalUses = b.total_uses || 1;
                const remainingUses = b.remaining_uses !== undefined ? b.remaining_uses : 1;

                const today = new Date().toISOString().split('T')[0];
                const isExpired = b.expire_at && b.expire_at < today;

                return (
                  <div 
                    key={b.id} 
                    className={`bg-slate-900 border rounded-2xl p-4 flex justify-between items-center text-xs transition ${
                      isUsed || isExpired 
                        ? 'border-slate-800/50 opacity-60 bg-slate-950/40' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 횟수 뱃지 */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isUsed 
                            ? 'bg-slate-800 text-slate-500' 
                            : remainingUses === 1 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isUsed ? tr(lang, '소진 완료', 'Использован') : tr(lang, `잔여 ${remainingUses}/${totalUses}회`, `Осталось ${remainingUses}/${totalUses}`)}
                        </span>

                        {/* 만료일 */}
                        {b.expire_at && (
                          <span className={`text-[10px] ${isExpired ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                            {isExpired ? tr(lang, '만료됨', 'Истёк') : `~${b.expire_at}`}
                          </span>
                        )}
                      </div>

                      {/* 아이템 이름: 사용 완료 시 가로줄 */}
                      <h3 className={`font-bold text-sm ${isUsed || isExpired ? 'line-through text-slate-500' : 'text-white'}`}>
                        {b.item_name}
                      </h3>
                      <p className="text-[10px] text-indigo-400 font-mono">SN: {b.serial}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 정상 사용 가능한 상태: QR 보기 버튼 */}
                      {!isUsed && !isExpired ? (
                        <button 
                          onClick={() => setSelectedQr(b)} 
                          disabled={isProcessing} 
                          className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 font-bold active:scale-95 transition disabled:opacity-50 text-white"
                        >
                          {tr(lang, 'QR 보기', 'QR-код')}
                        </button>
                      ) : (
                        /* 사용 완료 또는 만료된 상태: 휴지통 직접 삭제 버튼 */
                        <button
                          onClick={() => handleDeleteBagItem(b.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-400 hover:bg-rose-900/50 transition active:scale-95 flex items-center gap-1 font-bold text-[11px]"
                          title={tr(lang, '사용한 쿠폰 정리', 'Удалить купон')}
                        >
                          🗑️ {tr(lang, '비우기', 'Удалить')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {selectedQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-3">
            <div>
              <h3 className="font-bold text-sm text-white">{selectedQr.item_name}</h3>
              <p className="text-[11px] text-emerald-400 font-bold mt-0.5">
                {tr(lang, `잔여 ${selectedQr.remaining_uses ?? 1} / ${selectedQr.total_uses ?? 1}회`, `Осталось ${selectedQr.remaining_uses ?? 1} / ${selectedQr.total_uses ?? 1}`)}
              </p>
            </div>
            
            <div className="bg-white p-3 rounded-2xl inline-block shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(selectedQr.serial)}`}
                alt="QR Code"
                className="w-36 h-36 mx-auto block"
              />
              <p className="text-xs font-mono text-slate-800 font-bold mt-2 tracking-wider">
                {selectedQr.serial}
              </p>
            </div>

            <p className="text-[10px] text-slate-400">
              {tr(lang, '선생님/은행원에게 QR 또는 시리얼을 보여주세요.', 'Покажите QR-код или код учителю/банкиру.')}
            </p>

            <button 
              onClick={() => setSelectedQr(null)} 
              className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-xs font-bold text-white transition"
            >
              {tr(lang, '닫기', 'Закрыть')}
            </button>
          </div>
        </div>
      )}
      {/* 🔔 알림 목록 모달 */}
      {showNotiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-xs w-full space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-1.5">
                <Bell size={16} /> {tr(lang, '알림 센터', 'Уведомления')}
              </h3>
              <button onClick={() => setShowNotiModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-[11px]">
                  {tr(lang, '새로운 알림이 없습니다.', 'Новых уведомлений нет.')}
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                    <p className="font-bold text-white text-[11px]">{n.title}</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{n.message}</p>
                    <p className="text-[9px] text-slate-600">
                      {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => setShowNotiModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-xs font-bold transition"
            >
              {tr(lang, '닫기', 'Закрыть')}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={tr(lang, '취소', 'Отмена')}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      <nav className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 flex justify-around p-2 rounded-2xl shadow-2xl shadow-black/60 z-40">
        {[
          { id: 'wallet', label: tr(lang, '통장', 'Банк'), icon: Wallet },
          { id: 'store', label: tr(lang, '상점', 'Магазин'), icon: Store },
          { id: 'bag', label: tr(lang, '가방', 'Рюкзак'), icon: QrCode }
        ].map(tab => {
          const isActive = activeTab === tab.id || (tab.id === 'wallet' && !['store','bag'].includes(activeTab));
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} disabled={isProcessing} className={`flex flex-col items-center px-6 py-1.5 rounded-xl transition ${isActive ? 'bg-indigo-600/20 text-indigo-300 font-bold' : 'text-slate-500 hover:text-slate-300'} disabled:opacity-50`}>
              <tab.icon size={19}/>
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
