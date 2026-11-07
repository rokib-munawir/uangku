import React, { useState, useEffect } from 'react';
import BalanceCard from './BalanceCard';
import FinancialChart from '../charts/FinancialChart';
import RecentTransactions, { type Transaction } from '../transaction/RecentTransactions';
import AddTransactionModal from '../transaction/AddTransactionModal';
import ExportModal from './ExportModal';
import SavingsGoalCard from '../savings/SavingsGoalCard';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, AlertCircle, Download, Loader2 } from 'lucide-react';
import ProfileModal, { type UserProfile } from './ProfileModal';

// Default mock data to populate first-time view

export const DashboardContainer: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Rokib',
    email: 'rokib@uangku.com',
    avatar: '👨‍💻',
    monthlyIncomeGoal: 10000000,
    monthlyExpenseLimit: 5000000,
    expenseLimitPeriod: 'bulanan'
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New Savings Goal form state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalError, setGoalError] = useState('');

  // Fetch all data from MySQL DB via API on mount
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        setError('');
        
        const [profileRes, txRes, savingsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/transactions'),
          fetch('/api/savings')
        ]);

        if (!profileRes.ok || !txRes.ok || !savingsRes.ok) {
          throw new Error('Gagal menyinkronkan data dengan server database.');
        }

        const profileData = await profileRes.json();
        const txData = await txRes.json();
        const savingsData = await savingsRes.json();

        setProfile(profileData);
        setTransactions(txData);
        setSavings(savingsData);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Koneksi database gagal. Silakan coba memuat ulang.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Calculate totals
  const totalIncome = transactions
    .filter(t => t.tipe === 'pemasukan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalExpense = transactions
    .filter(t => t.tipe === 'pengeluaran')
    .reduce((sum, t) => sum + t.nominal, 0);

  // Format local Date object to YYYY-MM-DD using local calendar year, month, date
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Precise date calculations based on user's current local date
  const now = new Date();
  const currentYearStr = `${now.getFullYear()}`;
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Calculate start of current week (Monday) and end of current week (Sunday)
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const startOfWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday);
  const endOfWeekDate = new Date(startOfWeekDate.getFullYear(), startOfWeekDate.getMonth(), startOfWeekDate.getDate() + 6);

  const startOfWeekStr = formatLocalDate(startOfWeekDate);
  const endOfWeekStr = formatLocalDate(endOfWeekDate);

  // Income breakdowns
  const monthlyIncome = transactions
    .filter(t => t.tipe === 'pemasukan' && t.tanggal.startsWith(currentMonthStr))
    .reduce((sum, t) => sum + t.nominal, 0);

  // Expense breakdowns for all 3 periods
  const weeklyExpense = transactions
    .filter(t => t.tipe === 'pengeluaran' && t.tanggal >= startOfWeekStr && t.tanggal <= endOfWeekStr)
    .reduce((sum, t) => sum + t.nominal, 0);

  const monthlyExpense = transactions
    .filter(t => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentMonthStr))
    .reduce((sum, t) => sum + t.nominal, 0);

  const yearlyExpense = transactions
    .filter(t => t.tipe === 'pengeluaran' && t.tanggal.startsWith(currentYearStr))
    .reduce((sum, t) => sum + t.nominal, 0);

  // Determine active period based on profile
  const currentPeriod = profile.expenseLimitPeriod || 'bulanan';
  const periodExpense = currentPeriod === 'mingguan' 
    ? weeklyExpense 
    : currentPeriod === 'tahunan' 
      ? yearlyExpense 
      : monthlyExpense;

  const activeExpenseLimit = currentPeriod === 'mingguan'
    ? (profile.weeklyExpenseLimit || 0)
    : currentPeriod === 'tahunan'
      ? (profile.yearlyExpenseLimit || 0)
      : (profile.monthlyExpenseLimit || 0);

  const periodLabelsMap: Record<string, { title: string; current: string }> = {
    mingguan: { title: 'Mingguan', current: 'minggu ini' },
    bulanan: { title: 'Bulanan', current: 'bulan ini' },
    tahunan: { title: 'Tahunan', current: 'tahun ini' }
  };
  const activePeriodMeta = periodLabelsMap[currentPeriod] || periodLabelsMap.bulanan;

  const totalAllocatedSavings = savings.reduce((sum, s) => sum + s.currentAmount, 0);
  
  // Total balance = Total income - Total expense
  const totalBalance = totalIncome - totalExpense;

  // Add Transaction handler
  const handleAddTransaction = async (newTxData: Omit<Transaction, 'id'>) => {
    try {
      setLoading(true);
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTxData)
      });
      if (!res.ok) throw new Error('Gagal menyimpan transaksi ke database');
      const result = await res.json();
      
      // Update local React state
      setTransactions([result.transaction, ...transactions]);
    } catch (err: any) {
      alert(err.message || 'Error saat menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  // Delete Transaction handler
  const handleDeleteTransaction = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Gagal menghapus transaksi dari database');
      
      // Update local React state
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Error saat menghapus transaksi');
    } finally {
      setLoading(false);
    }
  };

  // Add Savings deposit handler (atomic on server!)
  const handleAddSavings = async (goalId: string, amount: number) => {
    try {
      setLoading(true);
      const res = await fetch('/api/savings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, amount })
      });
      if (!res.ok) throw new Error('Gagal melakukan alokasi tabungan');
      
      // Re-fetch transactions and savings to reflect automations
      const [txRes, savingsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/savings')
      ]);
      
      if (txRes.ok && savingsRes.ok) {
        setTransactions(await txRes.json());
        setSavings(await savingsRes.json());
      }
    } catch (err: any) {
      alert(err.message || 'Error saat menabung');
    } finally {
      setLoading(false);
    }
  };

  // Create new Savings Goal handler
  const handleCreateSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError('');

    const targetNum = parseFloat(goalTarget);
    if (!goalTitle.trim() || !goalDeadline || isNaN(targetNum) || targetNum <= 0) {
      setGoalError('Semua field harus diisi dengan benar');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalTitle.trim(),
          targetAmount: targetNum,
          deadline: goalDeadline
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan target tabungan baru');
      const result = await res.json();

      setSavings([...savings, result.goal]);
      
      // Reset Form
      setGoalTitle('');
      setGoalTarget('');
      setGoalDeadline('');
      setShowAddGoal(false);
    } catch (err: any) {
      setGoalError(err.message || 'Error saat membuat target tabungan');
    } finally {
      setLoading(false);
    }
  };

  // Delete Savings Goal handler
  const handleDeleteSavingsGoal = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/savings?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Gagal menghapus target tabungan dari database');
      
      // Update local React state
      setSavings(savings.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Error saat menghapus target tabungan');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (updated: UserProfile) => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan profil ke database');
      
      setProfile(updated);
    } catch (err: any) {
      alert(err.message || 'Error saat menyimpan profil');
    } finally {
      setLoading(false);
    }
  };

  // Map transactions dynamically to the past 6 months based on database values
  const getDynamicChartData = () => {
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const result = [];

    // Calculate dynamic values for the past 6 months including the current active month
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const monthIdx = targetDate.getMonth();
      const monthName = monthsShort[monthIdx];
      
      // Search format prefix: "YYYY-MM"
      const monthStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      
      const monthTxs = transactions.filter(t => t.tanggal.startsWith(monthStr));
      
      const incomeForMonth = monthTxs
        .filter(t => t.tipe === 'pemasukan')
        .reduce((sum, t) => sum + t.nominal, 0);
        
      const expenseForMonth = monthTxs
        .filter(t => t.tipe === 'pengeluaran')
        .reduce((sum, t) => sum + t.nominal, 0);

      result.push({
        month: monthName,
        pemasukan: incomeForMonth,
        pengeluaran: expenseForMonth
      });
    }

    return result;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-bg-custom flex flex-col items-center justify-center font-sans select-none p-4">
        <div className="w-20 h-20 rounded-full bg-bg-custom shadow-neumorph-in flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 text-primary-custom animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-dark-custom animate-pulse">Menghubungkan Database Uangku...</h2>
        <p className="text-xs font-semibold text-secondary-custom mt-2 text-center max-w-xs">
          Mendapatkan data finansial terenkripsi Anda secara aman langsung dari database MySQL.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Premium Top Navigation Bar */}
      <header className="flex items-center justify-between py-6 select-none mt-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[16px] bg-bg-custom shadow-neumorph-sm-out flex items-center justify-center text-2xl font-bold">
            💸
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-dark-custom tracking-tight leading-none">Uangku</h1>
            <p className="text-[10px] font-bold text-primary-custom tracking-widest uppercase mt-1">Personal Finance</p>
          </div>
        </div>

        {/* Date, Export, and Profile Indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-bg-custom shadow-neumorph-sm-in text-xs font-bold text-secondary-custom select-none">
            <span>Halo, <span className="text-primary-custom font-extrabold">{profile.name}</span>! 👋</span>
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out active:shadow-neumorph-sm-in text-xs font-bold text-secondary-custom hover:text-primary-custom transition-all duration-200 cursor-pointer outline-none select-none"
            title="Ekspor Laporan Keuangan"
          >
            <Download className="w-4 h-4 text-primary-custom" />
            <span className="hidden sm:inline">Ekspor Laporan</span>
          </button>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-10 h-10 rounded-full bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out active:shadow-neumorph-sm-in text-xl flex items-center justify-center transition-all duration-200 cursor-pointer outline-none select-none border border-white/20"
            title="Profil Finansial Anda"
          >
            {profile.avatar}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns (Dashboard Overview) */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-8">
          {/* 1. Balances */}
          <BalanceCard
            balance={totalBalance}
            income={totalIncome}
            expense={totalExpense}
            monthlyIncome={monthlyIncome}
            monthlyExpense={monthlyExpense}
          />

          {/* Budget Limit Warning Alert */}
          {activeExpenseLimit > 0 && periodExpense > activeExpenseLimit && (
            <div className="p-5 rounded-[24px] bg-bg-custom shadow-neumorph-out border border-danger-custom/30 flex gap-4 items-center animate-pulse">
              <div className="w-12 h-12 rounded-[16px] bg-danger-custom/10 text-danger-custom flex items-center justify-center shadow-neumorph-sm-out">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 select-none">
                <h4 className="text-sm font-extrabold text-danger-custom uppercase tracking-wide">
                  Pengeluaran Melebihi Batas {activePeriodMeta.title}!
                </h4>
                <p className="text-xs font-semibold text-secondary-custom mt-1 leading-normal">
                  Total pengeluaran Anda {activePeriodMeta.current} (Rp {periodExpense.toLocaleString('id-ID')}) telah melebihi batas anggaran {activePeriodMeta.title.toLowerCase()} yang ditentukan di profil (Rp {activeExpenseLimit.toLocaleString('id-ID')}).
                </p>
              </div>
            </div>
          )}

          {/* 2. Chart */}
          <FinancialChart data={getDynamicChartData()} />

          {/* 3. Transaction Log */}
          <RecentTransactions
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsModalOpen(true)}
          />
        </div>

        {/* Right Column (Savings & Quick Actions) */}
        <div className="col-span-1 flex flex-col gap-8">
          
          {/* Savings Goals Panel */}
          <Card className="bg-bg-custom shadow-neumorph-out p-6 rounded-[24px] flex flex-col gap-6 h-full min-h-[400px]">
            <div className="flex items-center justify-between gap-4 select-none">
              <div>
                <h3 className="text-lg font-bold text-dark-custom">Target Tabungan</h3>
                <p className="text-xs font-semibold text-secondary-custom">Wujudkan impian finansial Anda</p>
              </div>
              <button
                onClick={() => setShowAddGoal(!showAddGoal)}
                className={`p-2.5 rounded-[12px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out active:shadow-neumorph-sm-in text-primary-custom transition-all duration-200`}
                title="Target Baru"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Savings Goal Creator Form */}
            {showAddGoal && (
              <form onSubmit={handleCreateSavingsGoal} className="p-4 rounded-[20px] bg-bg-custom shadow-neumorph-sm-in flex flex-col gap-4">
                <h4 className="text-xs font-bold text-primary-custom select-none uppercase tracking-wider">Target Baru</h4>
                <Input
                  placeholder="Nama target (misal: Beli Mobil)"
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  className="py-2 px-3 text-xs"
                />
                <Input
                  type="number"
                  placeholder="Nominal Target (Rupiah)"
                  value={goalTarget}
                  onChange={e => setGoalTarget(e.target.value)}
                  className="py-2 px-3 text-xs"
                />
                <Input
                  type="date"
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                  className="py-2 px-3 text-xs"
                />
                
                {goalError && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-danger-custom">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{goalError}</span>
                  </div>
                )}

                <div className="flex gap-2 select-none">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddGoal(false);
                      setGoalError('');
                    }}
                    size="sm"
                    className="flex-1 text-xs py-2 rounded-[12px]"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs py-2 rounded-[12px] shadow-neumorph-primary-out"
                  >
                    Simpan
                  </Button>
                </div>
              </form>
            )}

            {/* Savings Cards Grid */}
            <div className="flex flex-col gap-5 overflow-y-auto max-h-[480px] pr-1">
              {savings.length > 0 ? (
                savings.map((s) => (
                  <SavingsGoalCard
                    key={s.id}
                    id={s.id}
                    title={s.title}
                    targetAmount={s.targetAmount}
                    currentAmount={s.currentAmount}
                    deadline={s.deadline}
                    onAddSavings={handleAddSavings}
                    onDeleteSavingsGoal={handleDeleteSavingsGoal}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4 select-none">
                  <div className="w-16 h-16 rounded-full bg-bg-custom shadow-neumorph-in flex items-center justify-center text-2xl mb-4">
                    🎯
                  </div>
                  <h4 className="font-bold text-dark-custom text-sm">Tidak ada target</h4>
                  <p className="text-xs font-semibold text-secondary-custom mt-1 max-w-[200px]">
                    Yuk buat target impian tabungan pertamamu hari ini!
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>

      {/* Floating Action Button (FAB) for Mobile Users */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 sm:hidden w-14 h-14 rounded-full bg-primary-custom text-white shadow-[0_4px_16px_rgba(108,99,255,0.4)] flex items-center justify-center hover:brightness-105 active:scale-95 transition-all duration-200"
        aria-label="Tambah Transaksi"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Add Transaction Dialog Modal Overlay */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTransaction={handleAddTransaction}
      />

      {/* Export Report Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transactions={transactions}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSave={saveProfile}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        monthlyIncome={monthlyIncome}
        weeklyExpense={weeklyExpense}
        monthlyExpense={monthlyExpense}
        yearlyExpense={yearlyExpense}
      />
    </div>
  );
};

export default DashboardContainer;
