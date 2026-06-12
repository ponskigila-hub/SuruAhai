import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, ShoppingBag, Wallet, Bell, User, LogOut, Search,
  Sparkles, Wind, Droplets, Zap, Truck, Hammer, Star, ChevronRight,
  Clock, Calendar, AlertCircle, PlusCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getServices, getCategories, getOrders, getWallet, getMitraList, getNotifications } from '../services/api';
import { toast } from 'sonner';
import WalletTopUpModal from '../components/WalletTopUpModal';

const categoryIcons = {
  cleaning: Sparkles,
  ac: Wind,
  plumbing: Droplets,
  electrical: Zap,
  moving: Truck,
  renovation: Hammer
};

const statusColors = {
  NEGOTIATING: 'badge-info',
  AWAITING_PAYMENT: 'badge-warning',
  PENDING: 'badge-warning',
  CONFIRMED: 'badge-info',
  IN_PROGRESS: 'badge-info',
  AWAITING_USER_CONFIRMATION: 'badge-warning',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-error'
};

const statusLabels = {
  NEGOTIATING: 'Negosiasi',
  AWAITING_PAYMENT: 'Menunggu pembayaran',
  PENDING: 'Menunggu',
  CONFIRMED: 'Dikonfirmasi',
  IN_PROGRESS: 'Sedang Dikerjakan',
  AWAITING_USER_CONFIRMATION: 'Perlu konfirmasi Anda',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan'
};

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [mitras, setMitras] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [topupModalOpen, setTopupModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, categoriesRes, ordersRes, mitrasRes, notifRes] = await Promise.all([
        getServices(),
        getCategories(),
        getOrders(),
        getMitraList(),
        getNotifications().catch(() => ({ data: [] }))
      ]);
      setServices(servicesRes.data);
      setCategories(categoriesRes.data);
      setOrders(ordersRes.data);
      setMitras(mitrasRes.data);
      setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'wallet') {
      loadWalletData();
    }
  }, [activeTab]);

  const loadWalletData = async () => {
    setWalletLoading(true);
    setWalletError('');
    try {
      const walletRes = await getWallet();
      const payload = walletRes.data || {};
      setWallet({
        balance: payload.balance || 0,
        transactions: Array.isArray(payload.transactions) ? payload.transactions : []
      });
    } catch (error) {
      setWalletError('Gagal memuat data wallet');
    } finally {
      setWalletLoading(false);
    }
  };

  const openTopUpModal = () => setTopupModalOpen(true);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount || 0);

  const formatDateTime = (dateValue) => {
    if (!dateValue) return '-';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout berhasil');
  };

  const filteredServices = services.filter(s => 
    (!selectedCategory || s.category === selectedCategory) &&
    (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const notificationBadgeCount = notifications.filter((n) => n.read !== true).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 glass border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="font-heading font-bold text-secondary">SuruAhai</p>
                <p className="text-xs text-slate-500">Halo, {user?.name}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {['home', 'orders', 'wallet'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:text-primary'
                  }`}
                  data-testid={`nav-${tab}`}
                >
                  {tab === 'home' && 'Beranda'}
                  {tab === 'orders' && 'Pesanan'}
                  {tab === 'wallet' && 'Wallet'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Notifikasi"
                data-testid="notifications-btn"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notificationBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                    {notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}
                  </span>
                )}
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-500 transition-colors"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-in">
            {/* Search */}
            <div>
              <label htmlFor="service-search" className="sr-only">Cari layanan</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
                <input
                  id="service-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari layanan..."
                  className="w-full border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  data-testid="search-input"
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="font-heading font-semibold text-lg text-secondary mb-4">Kategori Layanan</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {categories.map(cat => {
                  const IconComponent = categoryIcons[cat.id] || Sparkles;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selectedCategory === cat.id
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-100 bg-white hover:border-primary/30'
                      }`}
                      data-testid={`filter-${cat.id}`}
                    >
                      <IconComponent className={`w-6 h-6 mx-auto mb-2 ${
                        selectedCategory === cat.id ? 'text-primary' : 'text-slate-500'
                      }`} />
                      <p className={`text-xs font-medium ${
                        selectedCategory === cat.id ? 'text-primary' : 'text-slate-600'
                      }`}>{cat.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Services */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-lg text-secondary">Layanan Tersedia</h2>
                {selectedCategory && (
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-primary hover:underline"
                  >
                    Lihat Semua
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map(service => (
                  <div key={service.id} className="card overflow-hidden" data-testid={`service-card-${service.id}`}>
                    <div className="h-40 relative">
                      <img 
                        src={service.image_url || 'https://images.pexels.com/photos/20285350/pexels-photo-20285350.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'}
                        alt={service.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="badge badge-info">{categories.find(c => c.id === service.category)?.name || service.category}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading font-semibold text-secondary mb-1">{service.name}</h3>
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{service.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Mulai dari</p>
                          <p className="font-heading font-bold text-primary">
                            Rp {service.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <button 
                          onClick={() => navigate(`/booking/${service.id}`)}
                          className="btn-primary py-2 px-4 text-sm"
                          data-testid={`book-service-${service.id}`}
                        >
                          Pesan
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredServices.length === 0 && (
                <div className="empty-state">
                  <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Tidak ada layanan ditemukan</p>
                </div>
              )}
            </div>

            {/* Available Mitra */}
            {mitras.length > 0 && (
              <div>
                <h2 className="font-heading font-semibold text-lg text-secondary mb-4">Mitra Tersedia</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mitras.filter(m => m.mitra_profile?.is_online).slice(0, 4).map(mitra => (
                    <div key={mitra.id} className="card p-4" data-testid={`mitra-card-${mitra.id}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mitra.name}`}
                          alt={mitra.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-secondary">{mitra.name}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm text-slate-600">
                              {mitra.mitra_profile?.rating?.toFixed(1) || '0.0'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-green-600">Online</span>
                        {mitra.mitra_profile?.is_verified && (
                          <span className="badge badge-success ml-auto">Verified</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading font-semibold text-xl text-secondary">Pesanan Saya</h2>
            
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map(order => (
                  <div 
                    key={order.id} 
                    className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    data-testid={`order-card-${order.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-secondary">{order.service_name}</p>
                        <p className="text-sm text-slate-500">{order.mitra_name}</p>
                      </div>
                      <span className={`badge ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {order.scheduled_date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {order.scheduled_time}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <p className="font-heading font-bold text-primary">
                        Rp {order.total_amount?.toLocaleString('id-ID')}
                      </p>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state card">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Belum ada pesanan</p>
                <button 
                  onClick={() => setActiveTab('home')}
                  className="btn-primary mt-4"
                >
                  Pesan Sekarang
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-2xl border border-white/20 p-6 shadow-card bg-gradient-to-br from-primary to-[#FF9E2C] text-white flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-white/80">Saldo Wallet</p>
                <p className="font-heading text-4xl font-bold">{formatCurrency(wallet.balance)}</p>
                <p className="mt-2 text-sm text-white/70">Ringkasan saldo aktif Anda</p>
              </div>
              <button
                type="button"
                onClick={openTopUpModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/80 bg-white/15 px-5 py-3 font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
                data-testid="wallet-topup-open"
              >
                <PlusCircle className="h-5 w-5" />
                Top up
              </button>
            </div>

            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading font-semibold text-secondary">Riwayat Transaksi</h3>
                <button type="button" onClick={loadWalletData} className="text-sm text-primary hover:underline">
                  Muat Ulang
                </button>
              </div>

              {walletLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {!walletLoading && walletError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5" />
                    <p>{walletError}</p>
                  </div>
                </div>
              )}

              {!walletLoading && !walletError && wallet.transactions.length === 0 && (
                <div className="empty-state">
                  <Wallet className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-slate-500">Belum ada transaksi</p>
                </div>
              )}

              {!walletLoading && !walletError && wallet.transactions.length > 0 && (
                <div className="space-y-3">
                  {wallet.transactions.map((tx, index) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <div key={`${tx.created_at || 'tx'}-${index}`} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-secondary">{tx.description || 'Transaksi wallet'}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatDateTime(tx.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <span className={`badge ${isCredit ? 'badge-success' : 'badge-error'}`}>
                              {isCredit ? 'Kredit' : 'Debit'}
                            </span>
                            <p className={`mt-2 font-heading font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                              {isCredit ? '+' : '-'} {formatCurrency(Math.abs(tx.amount || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <WalletTopUpModal
        open={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        onSuccess={loadWalletData}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 md:hidden pb-safe z-50">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'home', icon: Home, label: 'Beranda' },
            { id: 'orders', icon: ShoppingBag, label: 'Pesanan' },
            { id: 'wallet', icon: Wallet, label: 'Wallet' },
            { id: 'profile', icon: User, label: 'Profil' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => item.id === 'profile' ? null : setActiveTab(item.id)}
              className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
              data-testid={`mobile-nav-${item.id}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default UserDashboard;
