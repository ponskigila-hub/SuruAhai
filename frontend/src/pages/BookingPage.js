import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Clock, CheckCircle, Users, Crosshair, Loader2
} from 'lucide-react';
import { getService, createOrder, geocodeAddress, reverseGeocode } from '../services/api';
import { toast } from 'sonner';

const BookingPage = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState(null);
  const [locating, setLocating] = useState(false);

  const [bookingData, setBookingData] = useState({
    scheduled_date: '',
    scheduled_time: '',
    address: '',
    description: '',
    notes: ''
  });
  const [coords, setCoords] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const serviceRes = await getService(serviceId);
      setService(serviceRes.data);
    } catch (error) {
      toast.error('Gagal memuat data layanan');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [serviceId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung lokasi GPS');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const res = await reverseGeocode(latitude, longitude);
          if (res.data?.display_name) {
            setBookingData((prev) => ({ ...prev, address: res.data.display_name }));
          }
        } catch {
          //
        }
        toast.success('Lokasi GPS berhasil diambil');
        setLocating(false);
      },
      () => {
        toast.error('Gagal mengambil lokasi. Izinkan akses lokasi atau isi alamat manual.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resolveLocation = async () => {
    if (coords) {
      return { lat: coords.lat, lng: coords.lng, address: bookingData.address };
    }
    try {
      const res = await geocodeAddress(bookingData.address);
      const hit = Array.isArray(res.data) ? res.data[0] : null;
      if (hit) {
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), address: bookingData.address };
      }
    } catch {
      //
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!bookingData.scheduled_date || !bookingData.scheduled_time || !bookingData.address) {
      toast.error('Mohon lengkapi semua data');
      return;
    }

    setSubmitting(true);
    try {
      const location = await resolveLocation();
      const response = await createOrder({
        service_id: serviceId,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        address: bookingData.address,
        description: bookingData.description || null,
        notes: bookingData.notes || null,
        location
      });

      toast.success('Pesanan dibuat. Pilih mitra yang Anda inginkan.');
      navigate(`/orders/${response.data.id}/choose-mitra`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      let msg = 'Gagal membuat pesanan';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length) {
        msg = detail.map((e) => e.msg).filter(Boolean).join(', ');
      } else if (error.response?.status === 403) {
        msg = 'Akun ini tidak bisa membuat pesanan. Login sebagai User.';
      } else if (!error.response) {
        msg = 'Tidak bisa hubungi backend. Pastikan API berjalan di port 8001.';
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading font-semibold text-secondary">Booking</h1>
              <p className="text-sm text-slate-500">{service?.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          {[1, 2].map(s => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                step >= s
                  ? 'bg-gradient-to-br from-primary to-[#FF9E2C] text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 2 && (
                <div className={`flex-1 h-1 rounded-full ${step > s ? 'bg-primary' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Jadwal & Alamat</span>
          <span>Konfirmasi</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* Step 1: Schedule & Address */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading font-semibold text-lg text-secondary">Jadwal & Alamat</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Tanggal
                </label>
                <input
                  type="date"
                  min={getMinDate()}
                  value={bookingData.scheduled_date}
                  onChange={(e) => setBookingData({ ...bookingData, scheduled_date: e.target.value })}
                  className="input"
                  required
                  data-testid="date-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Waktu
                </label>
                <select
                  value={bookingData.scheduled_time}
                  onChange={(e) => setBookingData({ ...bookingData, scheduled_time: e.target.value })}
                  className="input"
                  required
                  data-testid="time-select"
                >
                  <option value="">Pilih waktu</option>
                  <option value="08:00">08:00</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Alamat Lengkap
                  </label>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60"
                    data-testid="use-my-location"
                  >
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                    Gunakan Lokasi Saya
                  </button>
                </div>
                <textarea
                  value={bookingData.address}
                  onChange={(e) => { setBookingData({ ...bookingData, address: e.target.value }); setCoords(null); }}
                  className="input min-h-[100px] resize-none"
                  placeholder="Masukkan alamat lengkap..."
                  required
                  data-testid="address-input"
                />
                {coords && (
                  <p className="mt-1 text-xs text-green-600">
                    Titik lokasi tersimpan ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Deskripsi kebutuhan (opsional)
                </label>
                <textarea
                  value={bookingData.description}
                  onChange={(e) => setBookingData({ ...bookingData, description: e.target.value })}
                  className="input min-h-[80px] resize-none"
                  placeholder="Jelaskan detail pekerjaan yang Anda butuhkan..."
                  data-testid="description-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Catatan (opsional)
                </label>
                <textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                  className="input min-h-[80px] resize-none"
                  placeholder="Catatan tambahan untuk mitra..."
                  data-testid="notes-input"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!bookingData.scheduled_date || !bookingData.scheduled_time || !bookingData.address}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="continue-btn"
            >
              Lanjutkan
            </button>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading font-semibold text-lg text-secondary">Konfirmasi Pesanan</h2>

            <div className="card p-4 space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={service?.image_url || 'https://images.pexels.com/photos/20285350/pexels-photo-20285350.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'}
                  alt={service?.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-medium text-secondary">{service?.name}</h3>
                  <p className="text-sm text-slate-500">{service?.description}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium">{bookingData.scheduled_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu</span>
                  <span className="font-medium">{bookingData.scheduled_time}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-slate-500">Alamat</span>
                  <span className="font-medium text-right max-w-[200px]">{bookingData.address}</span>
                </div>
                {bookingData.description && (
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Kebutuhan</span>
                    <span className="font-medium text-right max-w-[200px]">{bookingData.description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Marketplace note */}
            <div className="card p-4 bg-blue-50 border-blue-100">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Pilih mitra favorit Anda</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Setelah pesanan dibuat, Anda akan melihat daftar mitra beserta harga dasar, rating, dan jaraknya. Pilih satu mitra, lalu negosiasikan harga lewat chat.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="submit-booking-btn"
            >
              {submitting ? 'Memproses...' : 'Buat Pesanan & Pilih Mitra'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPage;
