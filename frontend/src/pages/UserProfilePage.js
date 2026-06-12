import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, CheckCircle2, Loader2 } from 'lucide-react';
import { getUserRating } from '../services/api';

const UserProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getUserRating(userId);
        setProfile(res.data);
      } catch {
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-semibold text-secondary">Profil Pelanggan</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name || userId}`}
              alt={profile.name}
              className="w-16 h-16 rounded-2xl bg-slate-100"
            />
            <div>
              <h2 className="font-heading text-xl font-bold text-secondary">{profile.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-medium">{Number(profile.rating || 0).toFixed(1)}</span>
                  <span className="text-slate-400">({profile.rating_count || 0} penilaian)</span>
                </span>
                {profile.completed_orders != null && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {profile.completed_orders} transaksi selesai
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Reputasi pelanggan hanya terlihat oleh mitra SuruAhai.
          </p>
        </div>

        {profile.ratings?.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-secondary">Penilaian dari Mitra</h3>
            {profile.ratings.slice(0, 10).map((r) => (
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

export default UserProfilePage;
