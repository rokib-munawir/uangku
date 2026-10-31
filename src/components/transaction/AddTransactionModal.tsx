import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { X, DollarSign, Calendar, Tag, FileText, Sparkles, Loader2, Check } from 'lucide-react';
import type { Transaction } from './RecentTransactions';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

const CATEGORIES = [
  { name: 'Makanan', icon: '🍔' },
  { name: 'Transportasi', icon: '🚗' },
  { name: 'Belanja', icon: '🛍️' },
  { name: 'Pendidikan', icon: '📚' },
  { name: 'Hiburan', icon: '🎮' },
  { name: 'Lainnya', icon: '📦' }
];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction
}) => {
  const [tipe, setTipe] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran');
  const [nominal, setNominal] = useState('');
  const [kategori, setKategori] = useState('Makanan');
  const [tanggal, setTanggal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiError, setAiError] = useState('');

  // Set default date to today
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setTanggal(today);
      // Reset form
      setTipe('pengeluaran');
      setNominal('');
      setKategori('Makanan');
      setCatatan('');
      setErrors({});
      setAiInput('');
      setAiLoading(false);
      setAiSuccess(false);
      setAiError('');
    }
  }, [isOpen]);

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess(false);

    try {
      const res = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses dengan AI');
      }

      const tx = data.transaction;
      if (tx) {
        setNominal(tx.amount.toString());
        setTipe(tx.type === 'income' ? 'pemasukan' : 'pengeluaran');

        const matchCategory = CATEGORIES.find(
          c => c.name.toLowerCase() === (tx.category || '').toLowerCase()
        );
        if (matchCategory) {
          setKategori(matchCategory.name);
        } else if (tx.type === 'income') {
          setKategori('Lainnya');
        } else {
          setKategori(tx.category || 'Lainnya');
        }

        setCatatan(tx.description || aiInput.trim());
        if (tx.date) {
          setTanggal(tx.date);
        }
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 3000);
      }
    } catch (err: any) {
      setAiError(err.message || 'Terjadi kesalahan saat memproses AI');
    } finally {
      setAiLoading(false);
    }
  };

  const formatPreviewIDR = (valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const parsedNominal = parseFloat(nominal);
    if (!nominal || isNaN(parsedNominal) || parsedNominal <= 0) {
      newErrors.nominal = 'Nominal harus berupa angka lebih besar dari 0';
    }

    if (!tanggal) {
      newErrors.tanggal = 'Tanggal wajib diisi';
    }

    if (!catatan.trim()) {
      newErrors.catatan = 'Catatan ringkas wajib diisi';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAddTransaction({
      nominal: parsedNominal,
      kategori,
      tanggal,
      catatan: catatan.trim(),
      tipe
    });
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Soft Glassmorphism Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-900/30 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-lg z-10"
          >
            <div className="relative bg-bg-custom shadow-neumorph-out border border-white/20 rounded-[28px] overflow-hidden">
              <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh] overflow-hidden font-sans">
                
                {/* Header */}
                <header className="flex justify-between items-center px-8 py-5 border-b border-neutral-300/40 select-none">
                  <h3 className="text-xl font-extrabold text-dark-custom">Tambah Transaksi</h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-[14px] bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out active:shadow-neumorph-sm-in text-secondary-custom hover:text-danger-custom transition-all duration-200 outline-none cursor-pointer"
                    aria-label="Tutup"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </header>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
                  {/* AI Smart Input */}
                  <div className="p-4 rounded-[20px] bg-bg-custom shadow-neumorph-sm-in border border-primary-custom/20 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary-custom">
                        <Sparkles className="w-4 h-4 text-primary-custom animate-pulse" />
                        <span>Catat Cepat dengan AI</span>
                      </div>
                      {aiSuccess && (
                        <span className="text-[11px] font-bold text-success-custom flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Berhasil diekstrak!
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Contoh: 'Beli sate ayam 30rb' atau 'Gaji 8jt'"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAiParse();
                          }
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-[14px] bg-bg-custom shadow-neumorph-sm-out border border-white/40 text-xs font-semibold text-dark-custom placeholder-secondary-custom/60 outline-none focus:shadow-neumorph-in transition-all"
                      />
                      <Button
                        type="button"
                        onClick={handleAiParse}
                        disabled={aiLoading || !aiInput.trim()}
                        size="sm"
                        variant="primary"
                        className="px-4 py-2.5 rounded-[14px] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {aiLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{aiLoading ? 'Memproses...' : 'Ekstrak'}</span>
                      </Button>
                    </div>
                    {aiError && (
                      <span className="text-[11px] font-semibold text-danger-custom">{aiError}</span>
                    )}
                  </div>

                  {/* Type Selector (Tabs) */}
                  <div className="flex flex-col gap-2 select-none">
                    <label className="text-sm font-semibold text-secondary-custom px-1">
                      Jenis Transaksi
                    </label>
                    <div className="flex p-1 bg-bg-custom shadow-neumorph-in rounded-[16px]">
                      <button
                        type="button"
                        onClick={() => {
                          setTipe('pengeluaran');
                          if (kategori === 'Gaji') setKategori('Makanan');
                        }}
                        className={`flex-1 py-3 text-sm font-bold rounded-[12px] transition-all duration-200 cursor-pointer ${
                          tipe === 'pengeluaran'
                            ? 'bg-danger-custom text-white shadow-[2px_2px_4px_rgba(255,92,92,0.3)] font-bold'
                            : 'text-secondary-custom hover:text-dark-custom'
                        }`}
                      >
                        Pengeluaran 💸
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipe('pemasukan');
                          setKategori('Lainnya');
                        }}
                        className={`flex-1 py-3 text-sm font-bold rounded-[12px] transition-all duration-200 cursor-pointer ${
                          tipe === 'pemasukan'
                            ? 'bg-success-custom text-white shadow-[2px_2px_4px_rgba(76,175,80,0.3)] font-bold'
                            : 'text-secondary-custom hover:text-dark-custom'
                        }`}
                      >
                        Pemasukan 💰
                      </button>
                    </div>
                  </div>

                  {/* Big Currency Display & Input */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1 select-none">
                      <label className="text-sm font-semibold text-secondary-custom">
                        Nominal Uang
                      </label>
                      <span className="text-xs font-bold text-primary-custom">
                        {formatPreviewIDR(nominal)}
                      </span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Contoh: 50000"
                      value={nominal}
                      onChange={e => setNominal(e.target.value)}
                      error={errors.nominal}
                      icon={<DollarSign className="w-5 h-5 text-secondary-custom" />}
                      className="text-lg font-bold"
                    />
                  </div>

                  {/* Categories Grid Selector */}
                  <div className="flex flex-col gap-2 select-none">
                    <label className="text-sm font-semibold text-secondary-custom px-1">
                      Kategori
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => setKategori(cat.name)}
                          className={`flex flex-col items-center justify-center p-3 rounded-[16px] border border-transparent transition-all duration-200 cursor-pointer ${
                            kategori === cat.name
                              ? 'bg-bg-custom shadow-neumorph-in border-primary-custom/20 font-bold text-primary-custom scale-[0.98]'
                              : 'bg-bg-custom shadow-neumorph-sm-out hover:shadow-neumorph-out hover:-translate-y-[1px] text-dark-custom'
                          }`}
                        >
                          <span className="text-2xl mb-1">{cat.icon}</span>
                          <span className="text-[11px] font-semibold">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Picker */}
                  <Input
                    label="Tanggal Transaksi"
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    error={errors.tanggal}
                    icon={<Calendar className="w-5 h-5 text-secondary-custom" />}
                  />

                  {/* Notes/Catatan */}
                  <Input
                    label="Catatan Ringkas"
                    placeholder="Contoh: Beli Kopi Susu Sore"
                    value={catatan}
                    onChange={e => setCatatan(e.target.value)}
                    error={errors.catatan}
                    icon={<X className="hidden" />} // Let's keep it simple or remove custom icon space
                    className="pl-4"
                    maxLength={50}
                  />
                </div>

                {/* Fixed Footer */}
                <footer className="px-8 py-5 border-t border-neutral-300/40 bg-neutral-100/10 flex justify-end gap-3 select-none">
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
                    variant="primary"
                    className="px-6 py-2.5 rounded-[14px] shadow-neumorph-primary-out font-bold"
                    size="sm"
                  >
                    Simpan
                  </Button>
                </footer>

              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddTransactionModal;
