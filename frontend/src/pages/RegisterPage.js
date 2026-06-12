import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, ArrowLeft, User, Briefcase, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const parseApiMessage = (error, fallback) => {
  const data = error?.response?.data;
  return data?.message || data?.detail?.message || data?.detail || fallback;
};

const TermsModal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="font-heading text-xl font-semibold text-secondary">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-6 py-5 text-sm text-slate-600 space-y-3">
        {children}
      </div>
      <div className="border-t border-slate-100 px-6 py-4">
        <button type="button" onClick={onClose} className="btn-primary w-full">
          Saya Mengerti
        </button>
      </div>
    </div>
  </div>
);

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: searchParams.get('role') === 'mitra' ? 'MITRA' : 'USER'
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Nama wajib diisi.';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = 'Format email tidak valid.';
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = 'Nomor telepon wajib diisi.';
    } else if (!/^\d+$/.test(formData.phone) || formData.phone.length < 10) {
      nextErrors.phone = 'Nomor telepon harus angka dan minimal 10 digit.';
    }

    if (!formData.password) {
      nextErrors.password = 'Password wajib diisi.';
    } else if (formData.password.length < 6) {
      nextErrors.password = 'Password minimal 6 karakter.';
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Konfirmasi password wajib diisi.';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Konfirmasi password tidak cocok.';
    }

    if (!acceptedTerms) {
      nextErrors.terms = 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi.';
    }

    return nextErrors;
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Mohon cek kembali form registrasi Anda.');
      return;
    }

    setLoading(true);
    
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role
      };

      console.debug('Register payload:', {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
      });

      const user = await register(payload);
      
      toast.success('Registrasi berhasil!');
      
      if (user.role === 'MITRA') {
        navigate('/mitra');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const message = parseApiMessage(error, 'Registrasi gagal. Silakan coba lagi.');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>

          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-secondary">SuruAhai</span>
          </div>

          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">Buat Akun</h1>
          <p className="text-slate-500 mb-8">Daftar untuk mulai menggunakan SuruAhai</p>

          {/* Role Selection */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => updateField('role', 'USER')}
              data-testid="role-user-btn"
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                formData.role === 'USER' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <User className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'USER' ? 'text-primary' : 'text-slate-400'}`} />
              <p className={`font-medium text-sm ${formData.role === 'USER' ? 'text-primary' : 'text-slate-600'}`}>
                Pengguna
              </p>
              <p className="text-xs text-slate-400 mt-1">Cari jasa rumah tangga</p>
            </button>
            <button
              type="button"
              onClick={() => updateField('role', 'MITRA')}
              data-testid="role-mitra-btn"
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                formData.role === 'MITRA' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Briefcase className={`w-6 h-6 mx-auto mb-2 ${formData.role === 'MITRA' ? 'text-primary' : 'text-slate-400'}`} />
              <p className={`font-medium text-sm ${formData.role === 'MITRA' ? 'text-primary' : 'text-slate-600'}`}>
                Mitra
              </p>
              <p className="text-xs text-slate-400 mt-1">Tawarkan jasa Anda</p>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="input"
                placeholder="Masukkan nama lengkap"
                required
                data-testid="register-name-input"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="input"
                placeholder="nama@email.com"
                required
                data-testid="register-email-input"
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nomor Telepon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, ''))}
                className="input"
                placeholder="08xxxxxxxxxx"
                required
                data-testid="register-phone-input"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="input pr-10"
                  placeholder="Minimal 6 karakter"
                  required
                  data-testid="register-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Konfirmasi Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className="input"
                placeholder="Ulangi password"
                required
                data-testid="register-confirm-password-input"
              />
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
            </div>

            <div className="flex items-start gap-2">
              <input 
                type="checkbox" 
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  setErrors((prev) => ({ ...prev, terms: undefined }));
                }}
                required
                className="w-4 h-4 mt-1 rounded border-slate-300 text-primary focus:ring-primary" 
                data-testid="terms-checkbox"
              />
              <span className="text-sm text-slate-600">
                Saya setuju dengan{' '}
                <button type="button" onClick={() => setShowTermsModal(true)} className="text-primary hover:underline">
                  Syarat & Ketentuan
                </button>
                {' '}dan{' '}
                <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-primary hover:underline">
                  Kebijakan Privasi
                </button>
              </span>
            </div>
            {errors.terms && <p className="-mt-2 text-sm text-red-500">{errors.terms}</p>}

            <button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Daftar'}
            </button>
          </form>

          <p className="text-center mt-6 text-slate-500">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline" data-testid="login-link">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img 
          src="https://images.pexels.com/photos/5463581/pexels-photo-5463581.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="AC repair service"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/80 to-primary/80" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h2 className="font-heading text-3xl font-bold mb-4">
              {formData.role === 'MITRA' ? 'Bergabung sebagai Mitra' : 'Bergabung dengan Kami'}
            </h2>
            <p className="text-white/80 max-w-md">
              {formData.role === 'MITRA' 
                ? 'Dapatkan penghasilan tambahan dengan menawarkan keahlian Anda. Jadwal fleksibel, bayaran kompetitif.'
                : 'Nikmati kemudahan mencari mitra profesional untuk berbagai kebutuhan rumah tangga Anda.'}
            </p>
          </div>
        </div>
      </div>

      {showTermsModal && (
        <TermsModal title="Syarat & Ketentuan" onClose={() => setShowTermsModal(false)}>
          <p>Dengan mendaftar di SuruAhai, Anda menyetujui penggunaan platform untuk transaksi layanan rumah tangga yang legal dan aman.</p>
          <p>Anda bertanggung jawab atas keakuratan data akun, jadwal pesanan, serta komunikasi dengan mitra.</p>
          <p>Pembayaran yang diproses melalui sistem escrow akan ditahan sementara hingga layanan dinyatakan selesai.</p>
          <p>SuruAhai berhak menangguhkan akun yang terindikasi menyalahgunakan platform, termasuk tindakan penipuan dan spam.</p>
        </TermsModal>
      )}

      {showPrivacyModal && (
        <TermsModal title="Kebijakan Privasi" onClose={() => setShowPrivacyModal(false)}>
          <p>Kami mengumpulkan data akun seperti nama, email, nomor telepon, serta aktivitas pesanan untuk menjalankan layanan.</p>
          <p>Data Anda digunakan untuk autentikasi, pemrosesan pesanan, dan peningkatan kualitas produk.</p>
          <p>Kami tidak menjual data pribadi Anda kepada pihak ketiga.</p>
          <p>Anda dapat menghubungi admin untuk pembaruan atau penghapusan data sesuai kebijakan yang berlaku.</p>
        </TermsModal>
      )}
    </div>
  );
};

export default RegisterPage;
