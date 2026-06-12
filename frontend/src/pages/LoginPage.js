import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const user = await login(formData.email, formData.password);
      toast.success('Login berhasil!');
      
      // Redirect based on role
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'MITRA') {
        navigate('/mitra');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.detail?.message || error?.response?.data?.detail || 'Login gagal. Periksa email dan password Anda.';
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

          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">Selamat Datang</h1>
          <p className="text-slate-500 mb-8">Masuk ke akun Anda untuk melanjutkan</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="nama@email.com"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input pr-10"
                  placeholder="Masukkan password"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                <span className="text-sm text-slate-600">Ingat saya</span>
              </label>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => toast.info('Fitur lupa password segera hadir')}
              >
                Lupa password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center mt-6 text-slate-500">
            Belum punya akun?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline" data-testid="register-link">
              Daftar sekarang
            </Link>
          </p>

        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img 
          src="https://images.pexels.com/photos/9462233/pexels-photo-9462233.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Cleaning service"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-secondary/80" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h2 className="font-heading text-3xl font-bold mb-4">Temukan Mitra Terbaik</h2>
            <p className="text-white/80 max-w-md">
              Ribuan mitra profesional siap membantu kebutuhan rumah tangga Anda dengan layanan berkualitas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
