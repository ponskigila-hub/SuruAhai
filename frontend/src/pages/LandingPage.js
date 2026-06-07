import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, Wind, Droplets, Zap, Truck, Hammer, 
  ChevronRight, Star, Shield, Clock, CheckCircle,
  Menu, X, ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCategories } from '../services/api';
import { toast } from 'sonner';

const categoryIcons = {
  cleaning: Sparkles,
  ac: Wind,
  plumbing: Droplets,
  electrical: Zap,
  moving: Truck,
  renovation: Hammer
};

const LandingPage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'MITRA') navigate('/mitra');
      else navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  const handleComingSoon = (label) => {
    toast.info(`${label} segera hadir`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-secondary">SuruAhai</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#services" className="text-slate-600 hover:text-primary transition-colors font-medium">Layanan</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-primary transition-colors font-medium">Cara Kerja</a>
              <a href="#about" className="text-slate-600 hover:text-primary transition-colors font-medium">Tentang</a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <button 
                  onClick={handleGetStarted}
                  data-testid="go-to-dashboard-btn"
                  className="btn-primary"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <Link to="/login" data-testid="login-btn" className="btn-secondary">Masuk</Link>
                  <Link to="/register" data-testid="register-btn" className="btn-primary">Daftar</Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white animate-fade-in">
            <div className="px-4 py-4 space-y-3">
              <a href="#services" className="block py-2 text-slate-600 font-medium">Layanan</a>
              <a href="#how-it-works" className="block py-2 text-slate-600 font-medium">Cara Kerja</a>
              <a href="#about" className="block py-2 text-slate-600 font-medium">Tentang</a>
              <div className="pt-4 space-y-2">
                {isAuthenticated ? (
                  <button onClick={handleGetStarted} className="btn-primary w-full">Dashboard</button>
                ) : (
                  <>
                    <Link to="/login" className="btn-secondary block text-center w-full">Masuk</Link>
                    <Link to="/register" className="btn-primary block text-center w-full">Daftar</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero-gradient py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                Platform Jasa Rumah Tangga #1
              </div>
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-secondary leading-tight mb-6">
                Temukan Mitra 
                <span className="gradient-text"> Terpercaya</span> untuk Rumah Anda
              </h1>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                SuruAhai menghubungkan Anda dengan mitra profesional untuk berbagai kebutuhan rumah tangga. Aman, cepat, dan terjamin.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleGetStarted}
                  data-testid="hero-cta-btn"
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  Mulai Sekarang
                  <ArrowRight className="w-5 h-5" />
                </button>
                <a href="#how-it-works" className="btn-secondary flex items-center justify-center gap-2">
                  Pelajari Lebih Lanjut
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-8 pt-8 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <img 
                        key={i}
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=User${i}`}
                        alt="User"
                        className="w-8 h-8 rounded-full border-2 border-white"
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-600">10,000+ Pengguna</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">4.9</span>
                  <span className="text-sm text-slate-500">(2,500+ ulasan)</span>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.pexels.com/photos/20285350/pexels-photo-20285350.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                  alt="Modern clean home"
                  className="w-full h-[400px] md:h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              
              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 card p-4 shadow-xl animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pesanan Selesai</p>
                    <p className="font-heading font-bold text-xl">50,000+</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-secondary mb-4">
              Layanan Kami
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Berbagai layanan profesional untuk memenuhi kebutuhan rumah tangga Anda
            </p>
            <div className="flex justify-center mt-6">
              <img
                src="/ac-service.jpg"
                alt="AC service technician working"
                className="w-[500px] h-100 object-cover rounded-lg border border-gray-300 shadow"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => {
              const IconComponent = categoryIcons[category.id] || Sparkles;
              return (
                <div 
                  key={category.id}
                  className="card card-interactive p-6 cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`category-card-${category.id}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <IconComponent className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-secondary mb-2">
                    {category.name}
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {category.description}
                  </p>
                  <button 
                    onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                    className="text-primary font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Lihat Mitra
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-secondary mb-4">
              Cara Kerja
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Pesan layanan dalam 3 langkah mudah
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: 'Pilih Layanan', desc: 'Browse berbagai kategori layanan dan pilih yang Anda butuhkan', icon: Sparkles },
              { step: 2, title: 'Pilih Mitra', desc: 'Lihat profil, rating, dan ulasan mitra lalu pilih yang terbaik', icon: Star },
              { step: 3, title: 'Booking & Bayar', desc: 'Tentukan jadwal, bayar dengan aman, dan tunggu mitra datang', icon: CheckCircle }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center mx-auto">
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-heading font-bold text-sm">
                    {item.step}
                  </div>
                </div>
                <h3 className="font-heading font-semibold text-xl text-secondary mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="about" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img 
                src="https://images.pexels.com/photos/36088277/pexels-photo-36088277.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="Happy family"
                className="rounded-3xl shadow-xl"
              />
            </div>
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-secondary mb-6">
                Mengapa Memilih <span className="gradient-text">SuruAhai</span>?
              </h2>
              <div className="space-y-6">
                {[
                  { icon: Shield, title: 'Mitra Terverifikasi', desc: 'Semua mitra telah melewati proses verifikasi ketat' },
                  { icon: Clock, title: 'Escrow Payment', desc: 'Pembayaran aman dengan sistem escrow - dana dirilis setelah pekerjaan selesai' },
                  { icon: Star, title: 'Rating & Review', desc: 'Lihat ulasan asli dari pelanggan sebelumnya' },
                  { icon: CheckCircle, title: 'Garansi Kepuasan', desc: 'Jika tidak puas, dana dikembalikan ke wallet Anda' }
                ].map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-secondary mb-1">{item.title}</h3>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-secondary to-secondary-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
            Siap Memulai?
          </h2>
          <p className="text-slate-300 mb-8 text-lg">
            Bergabung dengan ribuan pengguna yang telah merasakan kemudahan SuruAhai
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/register')}
              data-testid="cta-user-btn"
              className="btn-primary"
            >
              Daftar sebagai User
            </button>
            <button 
              onClick={() => navigate('/register?role=mitra')}
              data-testid="cta-mitra-btn"
              className="btn-secondary"
            >
              Daftar sebagai Mitra
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-heading font-bold text-xl text-secondary">SuruAhai</span>
              </div>
              <p className="text-slate-500 text-sm">
                Marketplace jasa rumah tangga terpercaya di Indonesia.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-secondary mb-4">Layanan</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button type="button" onClick={() => handleComingSoon('Kebersihan')} className="hover:text-primary transition-colors">Kebersihan</button></li>
                <li><button type="button" onClick={() => handleComingSoon('AC & Elektronik')} className="hover:text-primary transition-colors">AC & Elektronik</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Pipa & Sanitasi')} className="hover:text-primary transition-colors">Pipa & Sanitasi</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Listrik')} className="hover:text-primary transition-colors">Listrik</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-secondary mb-4">Perusahaan</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button type="button" onClick={() => handleComingSoon('Tentang Kami')} className="hover:text-primary transition-colors">Tentang Kami</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Karir')} className="hover:text-primary transition-colors">Karir</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Blog')} className="hover:text-primary transition-colors">Blog</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Kontak')} className="hover:text-primary transition-colors">Kontak</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-secondary mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button type="button" onClick={() => handleComingSoon('Syarat & Ketentuan')} className="hover:text-primary transition-colors">Syarat & Ketentuan</button></li>
                <li><button type="button" onClick={() => handleComingSoon('Kebijakan Privasi')} className="hover:text-primary transition-colors">Kebijakan Privasi</button></li>
                <li><button type="button" onClick={() => handleComingSoon('FAQ')} className="hover:text-primary transition-colors">FAQ</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100 text-center text-sm text-slate-500">
            &copy; 2024 SuruAhai. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
