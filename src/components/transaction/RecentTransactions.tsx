import React, { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Search, Trash2, Calendar, FileText, Plus } from 'lucide-react';

export interface Transaction {
  id: string;
  nominal: number;
  kategori: string;
  tanggal: string;
  catatan: string;
  tipe: 'pemasukan' | 'pengeluaran';
  buktiPembayaran?: string | null;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  onDeleteTransaction?: (id: string) => void;
  onOpenAddModal?: () => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Makanan': '🍔',
  'Transportasi': '🚗',
  'Belanja': '🛍️',
  'Pendidikan': '📚',
  'Hiburan': '🎮',
  'Lainnya': '📦'
};

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  onDeleteTransaction,
  onOpenAddModal,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'semua' | 'pemasukan' | 'pengeluaran'>('semua');

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
  };

  // Filter & Search Logic
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.catatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.kategori.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      activeFilter === 'semua' || 
      t.tipe === activeFilter;

    return matchesSearch && matchesFilter;
  });

  return (
    <Card className={`flex flex-col gap-6 bg-bg-custom h-full ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-dark-custom select-none">Riwayat Transaksi</h3>
          <p className="text-xs font-semibold text-secondary-custom select-none">
            Pantau arus dana masuk dan keluar
          </p>
        </div>
        
        {/* Quick Add Button on Desktop */}
        {onOpenAddModal && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddModal}
            className="self-start sm:self-auto hidden sm:flex"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Cari transaksi atau kategori..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          icon={<Search className="w-5 h-5 text-secondary-custom" />}
          className="w-full"
          wrapperClassName="flex-1"
        />

        {/* Tab Filters */}
        <div className="flex gap-2 p-1 bg-bg-custom shadow-neumorph-sm-in rounded-[14px] self-start md:self-auto shrink-0 select-none">
          {(['semua', 'pemasukan', 'pengeluaran'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 text-xs font-bold rounded-[10px] capitalize transition-all duration-200 ${
                activeFilter === filter
                  ? 'bg-bg-custom text-primary-custom shadow-neumorph-sm-out'
                  : 'text-secondary-custom hover:text-dark-custom'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 flex flex-col gap-4">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-4 rounded-[18px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out hover:-translate-y-[1px] transition-all duration-300 group"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Category Icon */}
                <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-[14px] bg-bg-custom shadow-neumorph-sm-in shrink-0 select-none">
                  {CATEGORY_ICONS[t.kategori] || '📦'}
                </div>
                
                {/* Info */}
                <div className="min-w-0">
                  <h4 className="font-bold text-dark-custom truncate text-sm sm:text-base">
                    {t.catatan || t.kategori}
                  </h4>
                  <div className="flex items-center gap-3 text-xs font-medium text-secondary-custom mt-1">
                    <span className="flex items-center gap-1 select-none">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(t.tanggal)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-bg-custom shadow-neumorph-sm-in text-[10px] font-bold">
                      {t.kategori}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price & Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-bold text-sm sm:text-base ${
                  t.tipe === 'pemasukan' ? 'text-success-custom' : 'text-danger-custom'
                }`}>
                  {t.tipe === 'pemasukan' ? '+' : '-'} {formatIDR(t.nominal)}
                </span>
                
                {onDeleteTransaction && (
                  <button
                    onClick={() => onDeleteTransaction(t.id)}
                    className="p-2 rounded-[10px] bg-bg-custom shadow-neumorph-sm-out text-secondary-custom hover:text-danger-custom active:shadow-neumorph-sm-in transition-all duration-200 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Hapus Transaksi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <div className="w-20 h-20 rounded-full bg-bg-custom shadow-neumorph-in flex items-center justify-center text-3xl mb-4 select-none">
              ✨
            </div>
            <h4 className="font-bold text-dark-custom text-base select-none">
              Belum ada transaksi
            </h4>
            <p className="text-xs font-semibold text-secondary-custom mt-1 max-w-[240px] select-none">
              {searchTerm || activeFilter !== 'semua'
                ? 'Tidak ada transaksi yang cocok dengan pencarian Anda.'
                : 'Mulai catat keuangan pertamamu hari ini ✨'}
            </p>
            {!searchTerm && activeFilter === 'semua' && onOpenAddModal && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenAddModal}
                className="mt-5 shadow-neumorph-primary-out"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Transaksi</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default RecentTransactions;
