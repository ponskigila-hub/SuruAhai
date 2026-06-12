import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Star, Shield, MapPin, Clock, CheckCircle2, Wrench, AlertCircle, Map as MapIcon
} from 'lucide-react';
import { getOrder, getOrderMitras, selectMitra } from '../services/api';
import OrderMap from '../components/OrderMap';
import { toast } from 'sonner';

const SORT_OPTIONS = [
  { id: 'price_asc', label: 'Harga Termurah' },
  { id: 'price_desc', label: 'Harga Tertinggi' },
  { id: 'rating', label: 'Rating Tertinggi' },
  { id: 'rating_count', label: 'Review Terbanyak' },
  { id: 'distance', label: 'Jarak Terdekat' },
  { id: 'response_time', label: 'Respon Tercepat' },
  { id: 'completed_orders', label: 'Order Selesai Terbanyak' },
];

const formatResponseTime = (minutes) =>
  minutes == null ? null : `⚡ Respon rata-rata ${minutes} menit`;

const formatPrice = (value) =>
  value == null ? 'Harga via chat' : `Rp ${Number(value).toLocaleString('id-ID')}`;

const ChooseMitraPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [mitras, setMitras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rating');
  const [selecting, setSelecting] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const loadMitras = useCallback(async (sortValue) => {
    try {
      const res = await getOrderMitras(orderId, { sort: sortValue });
      setMitras(res.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal memuat daftar mitra');
    }
  }, [orderId]);

  useEffect(() => {
    (async () => {
      try {
        const orderRes = await getOrder(orderId);
        setOrder(orderRes.data);
        if (orderRes.data.status !== 'OPEN') {
          // Mitra already chosen — go straight to the order detail.
          navigate(`/orders/${orderId}`, { replace: true });
          return;
        }
        await loadMitras(sort);
      } catch (error) {
        toast.error('Gagal memuat pesanan');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleSortChange = (value) => {
    setSort(value);
    loadMitras(value);
  };

  const handleSelect = async (mitra) => {
    setSelecting(mitra.id);
    try {
      await selectMitra(orderId, mitra.id);
      toast.success(`Anda memilih ${mitra.name}. Mulai negosiasi sekarang.`);
      navigate(`/orders/${orderId}`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal memilih mitra');
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }

  const hasMap = order?.location?.lat != null && mitras.some((m) => m.location?.lat != null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading font-semibold text-secondary">Pilih Mitra</h1>
              <p className="text-sm text-slate-500">{order?.service_name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Filter / sort */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="sr-only" htmlFor="sort-select">Urutkan</label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="input"
              data-testid="mitra-sort"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {hasMap && (
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
              data-testid="toggle-map"
            >
              <MapIcon className="w-4 h-4" />
              {showMap ? 'Sembunyikan Peta' : 'Lihat Peta'}
            </button>
          )}
        </div>

        {showMap && hasMap && (
          <OrderMap userLocation={order.location} mitras={mitras} />
        )}

        {/* Mitra list */}
        {mitras.length > 0 ? (
          <div className="grid gap-4">
            {mitras.map((mitra) => (
              <div key={mitra.id} className="card p-4" data-testid={`mitra-card-${mitra.id}`}>
                <div className="flex items-start gap-4">
                  <img
                    src={mitra.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mitra.name}`}
                    alt={mitra.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-secondary flex items-center gap-2">
                        {mitra.name}
                        {mitra.is_verified && <Shield className="w-4 h-4 text-green-500" />}
                      </h3>
                      <p className="font-heading text-lg font-bold text-primary whitespace-nowrap">
                        {formatPrice(mitra.base_price)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-medium">{Number(mitra.rating || 0).toFixed(1)}</span>
                        <span className="text-slate-400">({mitra.review_count || 0} review)</span>
                      </span>
                      {mitra.distance_km != null && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-4 h-4" />
                          {mitra.distance_km} km
                        </span>
                      )}
                      {mitra.avg_response_time_minutes != null && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-4 h-4" />
                          ~{mitra.avg_response_time_minutes} mnt
                        </span>
                      )}
                    </div>

                    {(mitra.service_description || mitra.description) && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                        {mitra.service_description || mitra.description}
                      </p>
                    )}

                    {mitra.avg_response_time_minutes != null && (
                      <p className="text-xs text-primary mt-1">
                        {formatResponseTime(mitra.avg_response_time_minutes)}
                      </p>
                    )}

                    {!mitra.service_description && !mitra.description && mitra.bio && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{mitra.bio}</p>
                    )}

                    {mitra.tools?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {mitra.tools.slice(0, 4).map((tool) => (
                          <span
                            key={tool}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            <Wrench className="w-3 h-3" />
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 gap-2">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        {mitra.completed_orders || 0} order selesai
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/mitras/${mitra.id}`)}
                          className="btn-secondary py-2 px-3 text-sm"
                        >
                          Lihat Profil
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelect(mitra)}
                          disabled={selecting === mitra.id}
                          className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
                          data-testid={`select-mitra-${mitra.id}`}
                        >
                          {selecting === mitra.id ? 'Memilih...' : 'Pilih Mitra'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Belum ada mitra tersedia untuk kategori ini</p>
            <p className="text-sm text-slate-400 mt-1">
              Mitra perlu online dan terverifikasi pada kategori yang sesuai. Coba lagi nanti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChooseMitraPage;
