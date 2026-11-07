import React, { useState, useEffect } from 'react';
import { X, User, Mail, Target, AlertTriangle, Award, ShieldCheck, LogOut, Loader2, Bot, Send, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import ProgressBar from '../ui/ProgressBar';
import { authClient } from '../../lib/auth-client';

export type ExpenseLimitPeriod = 'mingguan' | 'bulanan' | 'tahunan';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  monthlyIncomeGoal: number;
  weeklyExpenseLimit?: number;
  monthlyExpenseLimit: number;
  yearlyExpenseLimit?: number;
  expenseLimitPeriod?: ExpenseLimitPeriod;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
  totalIncome: number;
  totalExpense: number;
  monthlyIncome?: number;
  weeklyExpense?: number;
  monthlyExpense?: number;
  yearlyExpense?: number;
}

const AVATAR_OPTIONS = ['👤', '👨‍💻', '👩‍💻', '💼', '🍕', '🎮', '🌟', '🦄', '🦁', '🚀', '🎨', '💸'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
  totalIncome,
  monthlyIncome,
  weeklyExpense = 0,
  monthlyExpense = 0,
  yearlyExpense = 0
}) => {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [incomeGoal, setIncomeGoal] = useState(profile.monthlyIncomeGoal.toString());
  
  // Independent limits for each period
  const [weeklyLimit, setWeeklyLimit] = useState(
    (profile.weeklyExpenseLimit !== undefined && profile.weeklyExpenseLimit > 0
      ? profile.weeklyExpenseLimit
      : (profile.monthlyExpenseLimit ? Math.round(profile.monthlyExpenseLimit / 4) : 1250000)
    ).toString()
  );
  const [monthlyLimit, setMonthlyLimit] = useState(
    (profile.monthlyExpenseLimit !== undefined ? profile.monthlyExpenseLimit : 5000000).toString()
  );
  const [yearlyLimit, setYearlyLimit] = useState(
    (profile.yearlyExpenseLimit !== undefined && profile.yearlyExpenseLimit > 0
      ? profile.yearlyExpenseLimit
      : (profile.monthlyExpenseLimit ? profile.monthlyExpenseLimit * 12 : 60000000)
    ).toString()
  );

  const [expenseLimitPeriod, setExpenseLimitPeriod] = useState<ExpenseLimitPeriod>(profile.expenseLimitPeriod || 'bulanan');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Telegram Integration State
  const [telegramData, setTelegramData] = useState<{
    isLinked: boolean;
    telegramUsername: string | null;
    linkCode: string | null;
    botUsername: string;
    isBotConfigured: boolean;
    webhook?: { url?: string; hasWebhook?: boolean };
  }>({
    isLinked: false,
    telegramUsername: null,
    linkCode: null,
    botUsername: 'uangku_bot',
    isBotConfigured: false,
    webhook: { hasWebhook: false },
  });
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchTelegramStatus = async () => {
    try {
      setLoadingTelegram(true);
      const res = await fetch('/api/telegram/link');
      if (res.ok) {
        const data = await res.json();
        setTelegramData(data);
      }
    } catch (e) {
      console.error('Error fetching Telegram link status:', e);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleSetWebhook = async () => {
    try {
      setLoadingTelegram(true);
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_webhook' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Webhook Telegram berhasil didaftarkan! Bot akan otomatis aktif 24 jam saat di-deploy.');
        await fetchTelegramStatus();
      } else {
        alert('Gagal mengaktifkan webhook: ' + (data.description || data.error));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleDeleteWebhook = async () => {
    try {
      setLoadingTelegram(true);
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_webhook' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Webhook dinonaktifkan. Anda sekarang dapat menggunakan mode polling lokal (npm run telegram).');
        await fetchTelegramStatus();
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan tautan akun Telegram?')) return;
    try {
      setLoadingTelegram(true);
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlink' }),
      });
      if (res.ok) {
        await fetchTelegramStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleRefreshTelegramCode = async () => {
    try {
      setLoadingTelegram(true);
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_code' }),
      });
      if (res.ok) {
        await fetchTelegramStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleCopyCode = () => {
    if (telegramData.linkCode) {
      navigator.clipboard.writeText(telegramData.linkCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Sync state with prop updates
  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setAvatar(profile.avatar);
    setIncomeGoal(profile.monthlyIncomeGoal.toString());
    setWeeklyLimit((profile.weeklyExpenseLimit ?? (profile.monthlyExpenseLimit ? Math.round(profile.monthlyExpenseLimit / 4) : 1250000)).toString());
    setMonthlyLimit((profile.monthlyExpenseLimit ?? 5000000).toString());
    setYearlyLimit((profile.yearlyExpenseLimit ?? (profile.monthlyExpenseLimit ? profile.monthlyExpenseLimit * 12 : 60000000)).toString());
    setExpenseLimitPeriod(profile.expenseLimitPeriod || 'bulanan');
    setErrors({});
    if (isOpen) {
      fetchTelegramStatus();
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = '/';
          }
        }
      });
    } catch (err: any) {
      alert("Gagal keluar dari akun.");
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { name?: string; email?: string; } = {};

    if (!name.trim()) {
      newErrors.name = 'Nama lengkap wajib diisi';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
      avatar,
      monthlyIncomeGoal: parseFloat(incomeGoal) || 0,
      weeklyExpenseLimit: parseFloat(weeklyLimit) || 0,
      monthlyExpenseLimit: parseFloat(monthlyLimit) || 0,
      yearlyExpenseLimit: parseFloat(yearlyLimit) || 0,
      expenseLimitPeriod
    });
    onClose();
  }

  const incomeGoalNum = parseFloat(incomeGoal) || 0;

  // Active limit string and change handler based on current period tab
  const currentExpenseLimitStr = expenseLimitPeriod === 'mingguan'
    ? weeklyLimit
    : expenseLimitPeriod === 'tahunan'
      ? yearlyLimit
      : monthlyLimit;

  const handleExpenseLimitChange = (val: string) => {
    if (expenseLimitPeriod === 'mingguan') {
      setWeeklyLimit(val);
    } else if (expenseLimitPeriod === 'tahunan') {
      setYearlyLimit(val);
    } else {
      setMonthlyLimit(val);
    }
  };

  const expenseLimitNum = parseFloat(currentExpenseLimitStr) || 0;

  // Dynamically evaluate active expense according to the currently selected period tab
  const activeExpense = expenseLimitPeriod === 'mingguan'
    ? weeklyExpense
    : expenseLimitPeriod === 'tahunan'
      ? yearlyExpense
      : monthlyExpense;

  // Active monthly income for monthly goal
  const activeIncome = monthlyIncome !== undefined ? monthlyIncome : totalIncome;

  // Calculating progress
  const incomeProgressPercent = incomeGoalNum > 0 ? Math.round((activeIncome / incomeGoalNum) * 100) : 0;
  const expenseProgressPercent = expenseLimitNum > 0 ? Math.round((activeExpense / expenseLimitNum) * 100) : 0;
  const isExpenseOverLimit = expenseLimitNum > 0 && activeExpense > expenseLimitNum;

  // Net balance calculations
  const remainingBudget = expenseLimitNum - activeExpense;

  const periodLabels: Record<ExpenseLimitPeriod, { title: string; unit: string; current: string }> = {
    mingguan: { title: 'Mingguan', unit: 'Minggu', current: 'minggu ini' },
    bulanan: { title: 'Bulanan', unit: 'Bulan', current: 'bulan ini' },
    tahunan: { title: 'Tahunan', unit: 'Tahun', current: 'tahun ini' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-neutral-900/30 backdrop-blur-md transition-all duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-3xl bg-bg-custom rounded-[28px] shadow-neumorph-out overflow-hidden flex flex-col max-h-[90vh] z-10 border border-white/20 transform transition-all duration-300 scale-100 font-sans"
      >
        {/* Header */}
        <header className="flex justify-between items-center px-8 py-5 border-b border-neutral-300/40 select-none">
          <div>
            <h2 className="text-xl font-extrabold text-dark-custom">Profil Finansial</h2>
            <p className="text-xs font-semibold text-secondary-custom">Atur preferensi & pantau batas anggaran Anda</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-[14px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out active:shadow-neumorph-sm-in text-secondary-custom hover:text-danger-custom transition-all duration-200 outline-none cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Form & Stats Panel */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Personal Data & Avatar */}
            <div className="flex flex-col gap-6">
              <h3 className="text-sm font-bold text-primary-custom select-none uppercase tracking-wider">Data Diri</h3>
              
              {/* Avatar Selector */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-secondary-custom select-none px-1">Pilih Avatar</span>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[20px] bg-bg-custom shadow-neumorph-in flex items-center justify-center text-4xl select-none">
                    {avatar}
                  </div>
                  <div className="flex-1 grid grid-cols-6 gap-2">
                    {AVATAR_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className={`w-9 h-9 rounded-[10px] bg-bg-custom flex items-center justify-center text-xl hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer ${
                          avatar === emoji 
                            ? 'shadow-neumorph-sm-in text-primary-custom border border-primary-custom/20' 
                            : 'shadow-neumorph-sm-out hover:shadow-neumorph-out'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name Input */}
              <Input
                label="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda"
                icon={<User className="w-4 h-4" />}
                error={errors.name}
              />

              {/* Email Input */}
              <Input
                label="Alamat Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: nama@domain.com"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email}
              />
            </div>

            {/* Right Column: Financial Goals & Limits */}
            <div className="flex flex-col gap-6">
              <h3 className="text-sm font-bold text-primary-custom select-none uppercase tracking-wider">Target & Batas Pengeluaran</h3>

              {/* Monthly Income Goal Input */}
              <Input
                label="Target Pemasukan Bulanan (Rp)"
                type="number"
                value={incomeGoal}
                onChange={(e) => setIncomeGoal(e.target.value)}
                placeholder="Contoh: 10000000"
                icon={<Target className="w-4 h-4 text-success-custom" />}
              />

              {/* Expense Limit Period Selector & Input */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-secondary-custom px-1 select-none">
                  Periode Batas Pengeluaran
                </label>
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-[18px] bg-bg-custom shadow-neumorph-sm-in border border-white/30">
                  {(['mingguan', 'bulanan', 'tahunan'] as ExpenseLimitPeriod[]).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setExpenseLimitPeriod(period)}
                      className={`
                        py-2 px-3 rounded-[12px] text-xs font-bold capitalize transition-all duration-200 select-none
                        ${expenseLimitPeriod === period
                          ? 'bg-primary-custom text-white shadow-neumorph-primary-out'
                          : 'text-secondary-custom hover:text-dark-custom'
                        }
                      `}
                    >
                      {periodLabels[period].title}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <Input
                    label={`Batas Pengeluaran ${periodLabels[expenseLimitPeriod].title} (Rp)`}
                    type="number"
                    value={currentExpenseLimitStr}
                    onChange={(e) => handleExpenseLimitChange(e.target.value)}
                    placeholder={`Contoh: ${expenseLimitPeriod === 'mingguan' ? '1250000' : expenseLimitPeriod === 'bulanan' ? '5000000' : '60000000'}`}
                    icon={<AlertTriangle className={`w-4 h-4 ${isExpenseOverLimit ? 'text-danger-custom' : 'text-warning-custom'}`} />}
                  />
                </div>
              </div>

              {/* Realtime Alert Card */}
              {expenseLimitNum > 0 && (
                <div className="mt-1">
                  {isExpenseOverLimit ? (
                    <div className="p-4 rounded-[20px] bg-bg-custom shadow-neumorph-sm-in border border-danger-custom/20 flex gap-3.5 items-start">
                      <div className="p-2 rounded-[12px] bg-danger-custom/10 text-danger-custom shadow-neumorph-sm-out">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex-1 select-none">
                        <h4 className="text-xs font-bold text-danger-custom uppercase tracking-wide">Peringatan Anggaran {periodLabels[expenseLimitPeriod].title}</h4>
                        <p className="text-xs font-semibold text-secondary-custom mt-1 leading-normal">
                          Pengeluaran Anda {periodLabels[expenseLimitPeriod].current} (Rp {activeExpense.toLocaleString('id-ID')}) telah melebihi batas yang ditentukan sebesar 
                          <span className="text-danger-custom font-extrabold ml-1">Rp {Math.abs(remainingBudget).toLocaleString('id-ID')}</span>!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-[20px] bg-bg-custom shadow-neumorph-sm-in border border-success-custom/20 flex gap-3.5 items-start">
                      <div className="p-2 rounded-[12px] bg-success-custom/10 text-success-custom shadow-neumorph-sm-out">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="flex-1 select-none">
                        <h4 className="text-xs font-bold text-success-custom uppercase tracking-wide">Anggaran Aman ({periodLabels[expenseLimitPeriod].title})</h4>
                        <p className="text-xs font-semibold text-secondary-custom mt-1 leading-normal">
                          Pengeluaran Anda terkendali! Sisa anggaran belanja Anda {periodLabels[expenseLimitPeriod].current} adalah 
                          <span className="text-success-custom font-extrabold ml-1">Rp {remainingBudget.toLocaleString('id-ID')}</span>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Telegram Bot Integration Card */}
          <Card className="bg-bg-custom shadow-neumorph-out p-6 rounded-[22px] border border-white/40 flex flex-col gap-4 select-none">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-primary-custom/10 text-primary-custom shadow-neumorph-sm-out flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-custom" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-dark-custom uppercase tracking-wider flex items-center gap-2">
                    Integrasi Telegram Bot (AI)
                    {telegramData.isLinked && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-success-custom/20 text-success-custom flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-custom animate-pulse" /> Terhubung
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] font-semibold text-secondary-custom">
                    Catat transaksi secepat kirim pesan & pantau saldo langsung dari Telegram
                  </p>
                </div>
              </div>
              {telegramData.isLinked && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={handleUnlinkTelegram}
                  disabled={loadingTelegram}
                  className="px-3.5 py-1.5 rounded-[12px] text-xs font-bold cursor-pointer"
                >
                  Putuskan Tautan
                </Button>
              )}
            </div>

            {telegramData.isLinked ? (
              <div className="p-4 rounded-[16px] bg-bg-custom shadow-neumorph-sm-in border border-success-custom/20 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-dark-custom">Akun Terhubung:</span>
                  <span className="font-extrabold text-primary-custom font-mono">
                    {telegramData.telegramUsername ? `@${telegramData.telegramUsername}` : 'ID Terhubung'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-secondary-custom leading-relaxed">
                  Gunakan perintah di bot: <code>/saldo</code> (cek saldo), <code>/laporan</code> (rekap pengeluaran), <code>/budget</code> (budgeting & target tabungan), atau cukup ketik bebas seperti <i>"Beli kopi 25rb"</i> untuk mencatat otomatis via AI.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-[18px] bg-bg-custom shadow-neumorph-sm-in border border-primary-custom/10">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-secondary-custom uppercase tracking-wider">Kode Tautan Anda</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-widest text-primary-custom font-mono">
                        {telegramData.linkCode || '...'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        title="Salin Kode"
                        className="p-1.5 rounded-[8px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-sm-in active:scale-95 transition-all text-secondary-custom hover:text-primary-custom cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success-custom" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleRefreshTelegramCode}
                        title="Buat Kode Baru"
                        disabled={loadingTelegram}
                        className="p-1.5 rounded-[8px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-sm-in active:scale-95 transition-all text-secondary-custom hover:text-primary-custom cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingTelegram ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <a
                    href={`https://t.me/${telegramData.botUsername}?start=${telegramData.linkCode || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[14px] bg-primary-custom text-white font-bold text-xs shadow-neumorph-primary-out hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Buka Telegram (@{telegramData.botUsername})</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>

                <div className="text-[11px] font-semibold text-secondary-custom px-1 flex flex-col gap-1 leading-normal">
                  <span>💡 <b>Cara Menghubungkan:</b></span>
                  <span>1. Klik tombol <b>"Buka Telegram"</b> di atas, lalu tekan <b>Start</b>.</span>
                  <span>2. Atau cari <b>@{telegramData.botUsername}</b> di Telegram dan ketik <code>/link {telegramData.linkCode}</code>.</span>
                  <span>3. Perintah Telegram: <code>/saldo</code>, <code>/laporan</code>, <code>/budget</code> & catat transaksi secepat chatting!</span>
                </div>
              </div>
            )}

            {/* Webhook & Deployment Mode Status Bar */}
            <div className="pt-3 border-t border-neutral-300/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-2 text-secondary-custom">
                <span className={`w-2 h-2 rounded-full ${telegramData.webhook?.hasWebhook ? 'bg-success-custom animate-pulse' : 'bg-warning-custom'}`} />
                <span>
                  Mode Bot: <b>{telegramData.webhook?.hasWebhook ? 'Webhook Aktif (Otomatis 24 Jam saat Deploy/Vercel)' : 'Polling Lokal (npm run telegram)'}</b>
                </span>
              </div>
              {telegramData.webhook?.hasWebhook ? (
                <button
                  type="button"
                  onClick={handleDeleteWebhook}
                  disabled={loadingTelegram}
                  className="text-danger-custom hover:underline font-bold cursor-pointer"
                >
                  Kembalikan ke Mode Polling Lokal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSetWebhook}
                  disabled={loadingTelegram}
                  className="text-primary-custom hover:underline font-bold cursor-pointer"
                  title="Daftarkan URL domain aplikasi ini sebagai Webhook Telegram"
                >
                  ⚡ Aktifkan Webhook Otomatis (Saat Deploy)
                </button>
              )}
            </div>
          </Card>

          {/* Realtime Performance Visualization Card */}
          <Card className="bg-bg-custom shadow-neumorph-out p-6 rounded-[22px] border border-white/40 flex flex-col gap-5 mt-2 select-none">
            <h4 className="text-xs font-bold text-dark-custom uppercase tracking-widest flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-primary-custom" />
              Progress Finansial Realtime
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income Progress */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold px-1">
                  <span className="text-secondary-custom">Pemasukan vs Target (Bulan Ini)</span>
                  <span className="text-success-custom">{incomeProgressPercent}%</span>
                </div>
                <ProgressBar
                  value={activeIncome}
                  max={incomeGoalNum || 1}
                  variant={incomeProgressPercent >= 100 ? 'success' : 'primary'}
                />
                <div className="flex justify-between text-[10px] font-semibold text-secondary-custom px-1">
                  <span>Rp {activeIncome.toLocaleString('id-ID')}</span>
                  <span>Target: Rp {incomeGoalNum.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Expense Progress */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold px-1">
                  <span className="text-secondary-custom">Pengeluaran vs Limit ({periodLabels[expenseLimitPeriod].title})</span>
                  <span className={isExpenseOverLimit ? 'text-danger-custom animate-pulse' : 'text-warning-custom'}>
                    {expenseProgressPercent}%
                  </span>
                </div>
                <ProgressBar
                  value={activeExpense}
                  max={expenseLimitNum || 1}
                  variant={isExpenseOverLimit ? 'danger' : 'warning'}
                />
                <div className="flex justify-between text-[10px] font-semibold text-secondary-custom px-1">
                  <span>Rp {activeExpense.toLocaleString('id-ID')} ({periodLabels[expenseLimitPeriod].current})</span>
                  <span>Limit: Rp {expenseLimitNum.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </Card>
        </form>

        {/* Footer Actions */}
        <footer className="px-8 py-5 border-t border-neutral-300/40 bg-neutral-100/10 flex justify-between items-center select-none">
          <Button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            variant="danger"
            className="px-5 py-2.5 rounded-[14px] font-bold"
            size="sm"
            disabled={loggingOut}
          >
            <LogOut className="w-4 h-4" />
            <span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-[14px]"
              size="sm"
            >
              Batal
            </Button>
            <Button
              type="submit"
              onClick={handleSave}
              variant="primary"
              className="px-6 py-2.5 rounded-[14px] shadow-neumorph-primary-out font-bold"
              size="sm"
            >
              Simpan
            </Button>
          </div>
        </footer>
      </div>

      {/* Premium Neumorphic Logout Confirmation Modal Overlay */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-all duration-300"
            onClick={() => setShowLogoutConfirm(false)}
          />

          {/* Modal Container */}
          <div 
            className="relative w-full max-w-sm bg-bg-custom rounded-[28px] shadow-neumorph-out p-6 z-10 border border-white/20 flex flex-col gap-6 text-center font-sans animate-fade-in"
          >
            {/* Warning Icon Container */}
            <div className="w-16 h-16 rounded-full bg-bg-custom shadow-neumorph-sm-in flex items-center justify-center text-danger-custom mx-auto border border-white/20">
              <LogOut className="w-8 h-8" />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-extrabold text-dark-custom leading-tight">Keluar dari Akun</h3>
              <p className="text-xs font-semibold text-secondary-custom leading-relaxed">
                Apakah Anda yakin ingin keluar dari akun Anda? Sesi Anda akan dihentikan secara aman.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 select-none">
              <Button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 text-xs font-bold rounded-[14px]"
                disabled={loggingOut}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-3 text-xs font-bold rounded-[14px] shadow-neumorph-danger-out bg-danger-custom text-white hover:brightness-105 active:scale-95 transition-all duration-200"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  <span>Keluar</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileModal;
