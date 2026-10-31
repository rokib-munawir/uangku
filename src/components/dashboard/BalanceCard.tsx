import React from 'react';
import Card from '../ui/Card';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  income: number;
  expense: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  className?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  income,
  expense,
  monthlyIncome,
  monthlyExpense,
  className = ''
}) => {
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const displayIncome = monthlyIncome !== undefined ? monthlyIncome : income;
  const displayExpense = monthlyExpense !== undefined ? monthlyExpense : expense;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {/* Total Saldo Card - Span full on mobile, neumorphic elevated */}
      <Card className="col-span-1 md:col-span-3 flex flex-col md:flex-row md:items-center justify-between gap-4 p-7 bg-bg-custom relative overflow-hidden">
        {/* Background glow for premium aesthetic */}
        <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-primary-custom/10 rounded-full blur-[40px] pointer-events-none" />
        
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-[18px] bg-bg-custom shadow-neumorph-in text-primary-custom">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary-custom select-none">Total Saldo Akumulasi</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-dark-custom tracking-tight mt-1">
              {formatIDR(balance)}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-custom shadow-neumorph-sm-in text-xs font-bold text-success-custom self-start md:self-center select-none">
          <ArrowUpRight className="w-4 h-4" />
          <span>Bulan ini aktif</span>
        </div>
      </Card>

      {/* Pemasukan Card */}
      <Card className="p-6 flex items-center gap-4 bg-bg-custom hoverable">
        <div className="p-3.5 rounded-[16px] bg-bg-custom shadow-neumorph-in text-success-custom">
          <ArrowUpRight className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-secondary-custom select-none">Pemasukan (Bulan Ini)</p>
          <h3 className="text-xl font-bold text-success-custom truncate mt-0.5">
            {formatIDR(displayIncome)}
          </h3>
        </div>
      </Card>

      {/* Pengeluaran Card */}
      <Card className="p-6 flex items-center gap-4 bg-bg-custom hoverable">
        <div className="p-3.5 rounded-[16px] bg-bg-custom shadow-neumorph-in text-danger-custom">
          <ArrowDownRight className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-secondary-custom select-none">Pengeluaran (Bulan Ini)</p>
          <h3 className="text-xl font-bold text-danger-custom truncate mt-0.5">
            {formatIDR(displayExpense)}
          </h3>
        </div>
      </Card>

      {/* Rasio Pengeluaran Card */}
      <Card className="p-6 flex items-center gap-4 bg-bg-custom hoverable">
        <div className="p-3.5 rounded-[16px] bg-bg-custom shadow-neumorph-in text-warning-custom">
          <div className="font-bold text-lg leading-none select-none">%</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-secondary-custom select-none">Rasio Belanja</p>
          <h3 className="text-xl font-bold text-dark-custom truncate mt-0.5">
            {income > 0 ? Math.round((expense / income) * 100) : 0}%
          </h3>
        </div>
      </Card>
    </div>
  );
};

export default BalanceCard;
