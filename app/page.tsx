'use client';
import { useState } from 'react';
import { Wallet, Store, QrCode, TrendingUp, Settings } from 'lucide-react';

export default function Page() {
  const [activeTab, setActiveTab] = useState('wallet');

  return (
    <div className="max-w-md mx-auto bg-slate-800 min-h-screen shadow-xl pb-20">
      {/* 상단 헤더 */}
      <header className="bg-indigo-600 p-6 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-black text-white tracking-tight">🚀 6-1 우주 은행</h1>
            <button className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">KR / RU</button>
          </div>
          <p className="text-indigo-100 text-sm">최정호 학생, 환영합니다!</p>
          <div className="mt-2 text-4xl font-black text-yellow-300">
            14,500 <span className="text-xl">안</span>
          </div>
          <div className="mt-3 inline-block bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-md">
            👑 은하 대부호
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="p-6">
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">내 통장</h2>
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow transition">
              💸 친구에게 송금하기
            </button>
            <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl shadow transition">
              🏦 정기 예금 가입 (15%)
            </button>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">우주 매점</h2>
            <div className="bg-slate-700 p-4 rounded-xl flex justify-between items-center">
              <div>
                <h3 className="font-bold">간식 교환권 (1회용)</h3>
                <p className="text-yellow-400 font-bold">500 안</p>
              </div>
              <button className="bg-indigo-500 px-4 py-2 rounded-lg font-bold">구매</button>
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-bold mb-4">내 쿠폰 가방</h2>
            <div className="bg-white p-6 rounded-2xl inline-block">
              <QrCode size={120} className="text-slate-900" />
            </div>
            <p className="text-slate-400 mt-2">선님께 QR을 보여주세요!</p>
          </div>
        )}
      </main>

      {/* 하단 네비게이션 탭 */}
      <nav className="fixed bottom-0 w-full max-w-md bg-slate-900 border-t border-slate-700 flex justify-around p-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center ${activeTab === 'wallet' ? 'text-indigo-400' : 'text-slate-500'}`}>
          <Wallet size={24} />
          <span className="text-xs mt-1 font-bold">통장</span>
        </button>
        <button onClick={() => setActiveTab('store')} className={`flex flex-col items-center ${activeTab === 'store' ? 'text-indigo-400' : 'text-slate-500'}`}>
          <Store size={24} />
          <span className="text-xs mt-1 font-bold">상점</span>
        </button>
        <button onClick={() => setActiveTab('qr')} className={`flex flex-col items-center ${activeTab === 'qr' ? 'text-indigo-400' : 'text-slate-500'}`}>
          <QrCode size={24} />
          <span className="text-xs mt-1 font-bold">가방</span>
        </button>
      </nav>
    </div>
  );
}
