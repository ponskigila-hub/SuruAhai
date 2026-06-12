import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Sparkles, Loader2 } from 'lucide-react';
import { getNotifications } from '../services/api';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await getNotifications();
      const data = res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Gagal memuat notifikasi. Coba lagi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatWhen = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTitle = (n) => {
    if (typeof n.title === 'string' && n.title.trim()) return n.title.trim();
    if (typeof n.type === 'string' && n.type.trim()) return n.type.replace(/_/g, ' ');
    return 'Pemberitahuan';
  };

  const getBody = (n) => {
    if (typeof n.message === 'string' && n.message.trim()) return n.message.trim();
    if (typeof n.body === 'string' && n.body.trim()) return n.body.trim();
    return '';
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <nav className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Kembali ke beranda"
            data-testid="notifications-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-heading font-semibold text-secondary">Notifikasi</span>
          <div className="w-9" aria-hidden />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm">Memuat notifikasi…</p>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={load}
                className="text-sm text-primary font-medium hover:underline"
                disabled={loading}
              >
                Muat ulang
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            {!error && items.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Bell className="w-7 h-7 text-slate-400" />
                </div>
                <p className="font-heading font-semibold text-secondary mb-2">Belum ada notifikasi</p>
                <p className="text-sm text-slate-500 mb-6">
                  Saat ada update pesanan atau info penting, akan muncul di sini. Anda bisa kembali kapan saja.
                </p>
                <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary">
                  Ke beranda
                </button>
              </div>
            ) : !error ? (
              <ul className="space-y-3">
                {items.map((n) => {
                  const hasOrder = Boolean(n.order_id);
                  const inner = (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary">{getTitle(n)}</p>
                        {getBody(n) ? (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-4">{getBody(n)}</p>
                        ) : (
                          !hasOrder && (
                            <p className="text-sm text-slate-400 mt-1">Tidak ada detail tambahan.</p>
                          )
                        )}
                        <p className="text-xs text-slate-400 mt-2">{formatWhen(n.created_at)}</p>
                        {hasOrder && (
                          <p className="text-xs text-primary mt-2 font-medium">Lihat pesanan →</p>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <li key={n.id}>
                      {hasOrder ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${n.order_id}`)}
                          className="card w-full text-left p-4 transition-shadow hover:shadow-md"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="card p-4">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
