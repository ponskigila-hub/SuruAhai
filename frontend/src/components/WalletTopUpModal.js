import React, { useState, useEffect } from 'react';
import { walletTopUp } from '../services/api';
import { toast } from 'sonner';

export const MIN_TOPUP_IDR = 10000;
export const MAX_TOPUP_IDR = 50000000;
export const TOPUP_PRESETS = [50000, 100000, 200000];

const parseTopUpAmount = (topupInput) => {
  const raw = String(topupInput || '').trim().replace(/\./g, '').replace(/,/g, '');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {() => void | Promise<void>} onSuccess – dipanggil setelah top-up API sukses (mis. refresh saldo)
 */
const WalletTopUpModal = ({ open, onClose, onSuccess, initialAmount }) => {
  const [topupInput, setTopupInput] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const suggested = Number(initialAmount || 0);
    setTopupInput(suggested > 0 ? String(Math.ceil(suggested)) : '');
  }, [open, initialAmount]);

  const close = () => {
    if (!topupSubmitting) onClose();
  };

  const submitTopUp = async () => {
    const amount = parseTopUpAmount(topupInput);
    if (Number.isNaN(amount)) {
      toast.error('Masukkan nominal yang valid');
      return;
    }
    if (amount < MIN_TOPUP_IDR) {
      toast.error(`Minimal top up Rp ${MIN_TOPUP_IDR.toLocaleString('id-ID')}`);
      return;
    }
    if (amount > MAX_TOPUP_IDR) {
      toast.error(`Maksimal top up Rp ${MAX_TOPUP_IDR.toLocaleString('id-ID')}`);
      return;
    }

    setTopupSubmitting(true);
    try {
      await walletTopUp({ amount });
      toast.success('Top up berhasil');
      await onSuccess?.();
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      let message = 'Top up gagal';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        message = detail[0].msg;
      }
      toast.error(message);
    } finally {
      setTopupSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="wallet-topup-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Tutup"
        disabled={topupSubmitting}
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <h2 id="wallet-topup-title" className="font-heading font-semibold text-lg text-secondary">
          Top up saldo
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Nominal Rp {MIN_TOPUP_IDR.toLocaleString('id-ID')} – Rp {MAX_TOPUP_IDR.toLocaleString('id-ID')} (demo,
          tanpa payment gateway).
        </p>

        {Number(initialAmount || 0) > 0 && (
          <p className="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
            Nominal disarankan: Rp {Math.ceil(initialAmount).toLocaleString('id-ID')}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {TOPUP_PRESETS.map((nom) => (
            <button
              key={nom}
              type="button"
              onClick={() => setTopupInput(String(nom))}
              disabled={topupSubmitting}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                String(topupInput) === String(nom)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 text-slate-700 hover:border-primary/40'
              }`}
            >
              Rp {nom.toLocaleString('id-ID')}
            </button>
          ))}
        </div>

        <label htmlFor="wallet-topup-amount" className="mt-4 block text-sm font-medium text-slate-700">
          Nominal (IDR)
        </label>
        <input
          id="wallet-topup-amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={topupInput}
          onChange={(e) => setTopupInput(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Contoh: 50000"
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          disabled={topupSubmitting}
          data-testid="wallet-topup-input"
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
            onClick={close}
            disabled={topupSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn-primary px-5 py-2.5 disabled:opacity-60"
            onClick={submitTopUp}
            disabled={topupSubmitting}
            data-testid="wallet-topup-submit"
          >
            {topupSubmitting ? 'Memproses…' : 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletTopUpModal;
