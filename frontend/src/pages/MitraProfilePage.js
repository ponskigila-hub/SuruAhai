import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Star, Shield, MapPin, Clock, Wrench, CheckCircle2, Loader2
} from 'lucide-react';
import { getMitra, getMitraRatings, getCategories } from '../services/api';

const MitraProfilePage = () => {
  const { mitraId } = useParams();
  const navigate = useNavigate();
  const [mitra, setMitra] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mitraRes, ratingsRes, catRes] = await Promise.all([
          getMitra(mitraId),
          getMitraRatings(mitraId).catch(() => ({ data: [] })),
          getCategories().catch(() => ({ data: [] })),
        ]);
        setMitra(mitraRes.data);
        setRatings(Array.isArray(ratingsRes.data) ? ratingsRes.data : []);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      } catch {
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [mitraId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mitra) return null;

  const profile = mitra.mitra_profile || {};
  const offerings = profile.service_offerings?.length
    ? profile.service_offerings
    : (profile.services || []).map((cat) => ({
        category: typeof cat === 'string' ? cat : cat.category,
        base_price: profile.base_price,
        tools: profile.tools || [],
        description: profile.description || '',
      }));

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-semibold text-secondary">Profil Mitra</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <img
              src={profile.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mitra.name}`}
              alt={mitra.name}
              className="w-20 h-20 rounded-2xl object-cover bg-slate-100"
            />
            <div className="flex-1">
              <h2 className="font-heading text-xl font-bold text-secondary flex items-center gap-2">
                {mitra.name}
                {profile.is_verified && <Shield className="w-5 h-5 text-green-500" />}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-medium">{Number(profile.rating || 0).toFixed(1)}</span>
                  <span className="text-slate-400">({profile.review_count || 0} review)</span>
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {profile.completed_orders || profile.total_orders || 0} order selesai
                </span>
              </div>
              {profile.avg_response_time_minutes != null && (
                <p className="flex items-center gap-1 text-sm text-primary mt-2">
                  <Clock className="w-4 h-4" />
                  Biasanya membalas dalam {profile.avg_response_time_minutes} menit
                </p>
              )}
              {profile.service_area && (
                <p className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  {profile.service_area}
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="text-slate-600 mt-4">{profile.bio}</p>
          )}

          {mitra.created_at && (
            <p className="text-xs text-slate-400 mt-4">
              Bergabung sejak {new Date(mitra.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {offerings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-secondary">Layanan per Kategori</h3>
            {offerings.map((offering) => (
              <div key={offering.category} className="card p-4">
                <h4 className="font-medium text-secondary uppercase text-sm tracking-wide">
                  {categoryName(offering.category)}
                </h4>
                {offering.base_price != null && (
                  <p className="mt-2 font-heading text-lg font-bold text-primary">
                    Rp {Number(offering.base_price).toLocaleString('id-ID')}
                  </p>
                )}
                {offering.description && (
                  <p className="text-sm text-slate-600 mt-2">{offering.description}</p>
                )}
                {offering.tools?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {offering.tools.map((tool) => (
                      <span key={tool} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        <Wrench className="w-3 h-3" />
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {ratings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-secondary">Ulasan Pelanggan</h3>
            {ratings.slice(0, 10).map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    {Number(r.overall || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : ''}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-slate-600 mt-2">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MitraProfilePage;
