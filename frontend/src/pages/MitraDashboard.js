import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, ShoppingBag, Wallet, LogOut, Menu, X,
  Clock, CheckCircle, Star, DollarSign, 
  Power, Calendar, MapPin, User, Tags
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMitraDashboard, getOrders, updateOrderStatus, toggleMitraOnline, getWallet, getCategories, updateMitraProfile, requestMitraWithdraw } from '../services/api';
import { toast } from 'sonner';

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
  IN_PROGRESS: 'Dikerjakan',
  AWAITING_USER_CONFIRMATION: 'Menunggu konfirmasi pengguna',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan'
};

const MitraDashboard = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [categories, setCategories] = useState([]);
  const [profileServices, setProfileServices] = useState([]);
  const [profileDescription, setProfileDescription] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawBankAccount, setWithdrawBankAccount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCategories();
        setCategories(res.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?.mitra_profile) return;
    const mp = user.mitra_profile;
    setProfileServices(Array.isArray(mp.services) ? [...mp.services] : []);
    setProfileDescription(mp.description || '');
  }, [user]);

  const loadData = async () => {
    try {
      const [dashboardRes, ordersRes, walletRes] = await Promise.all([
        getMitraDashboard(),
        getOrders(),
        getWallet()
      ]);
      setDashboard(dashboardRes.data);
      setOrders(ordersRes.data);
      setWallet(walletRes.data);
      setIsOnline(dashboardRes.data.is_online);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOnline = async () => {
    try {
      const response = await toggleMitraOnline();
      setIsOnline(response.data.is_online);
      toast.success(response.data.is_online ? 'Anda sekarang online' : 'Anda sekarang offline');
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success(`Status diperbarui ke ${statusLabels[status] ?? status}`);
      loadData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Gagal memperbarui status');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout berhasil');
  };

  const toggleProfileService = (categoryId) => {
    setProfileServices((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSaveProfile = async () => {
    if (profileServices.length === 0) {
      toast.error('Pilih minimal satu kategori keahlian');
      return;
    }
    setProfileSaving(true);
    try {
      const mp = user?.mitra_profile || {};
      await updateMitraProfile({
        services: profileServices,
        description: profileDescription.trim() || null,
        bank_name: mp.bank_name ?? null,
        bank_account: mp.bank_account ?? null,
        is_verified: mp.is_verified ?? false,
        is_online: mp.is_online ?? false
      });
      await refreshUser();
      toast.success('Profil keahlian disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan profil');
    } finally {
      setProfileSaving(false);
    }
  };

  const MIN_WITHDRAW = 50000;
  const balanceNum = Number(wallet.balance || 0);

  const openWithdrawModal = () => {
    const mp = user?.mitra_profile || {};
    setWithdrawBankName(mp.bank_name || '');
    setWithdrawBankAccount(mp.bank_account || '');
    setWithdrawAmount(balanceNum >= MIN_WITHDRAW ? String(Math.floor(balanceNum)) : '');
    setWithdrawOpen(true);
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(String(withdrawAmount), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Masukkan jumlah penarikan yang valid');
      return;
    }
    if (!withdrawBankName.trim() || !withdrawBankAccount.trim()) {
      toast.error('Lengkapi nama bank dan nomor rekening');
      return;
    }
    if (amount < MIN_WITHDRAW) {
      toast.error(`Minimal penarikan Rp ${MIN_WITHDRAW.toLocaleString('id-ID')}`);
      return;
    }
    if (amount > balanceNum) {
      toast.error('Jumlah melebihi saldo');
      return;
    }
    setWithdrawSubmitting(true);
    try {
      await requestMitraWithdraw({
        amount,
        bank_name: withdrawBankName.trim(),
        bank_account: withdrawBankAccount.trim()
      });
      toast.success('Penarikan berhasil. Dana akan diproses 1–3 hari kerja.');
      setWithdrawOpen(false);
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      const raw = err.response?.data?.detail;
      const msg = Array.isArray(raw)
        ? raw.map((e) => e.msg || e).join(', ')
        : typeof raw === 'string'
          ? raw
          : raw?.message;
      toast.error(msg || 'Gagal memproses penarikan');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const pendingOrders = orders.filter(o =>
    ['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING'].includes(o.status)
  );
  const activeOrders = orders.filter(o =>
    ['NEGOTIATING', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'AWAITING_USER_CONFIRMATION'].includes(o.status)
  );

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'orders', label: 'Pesanan', icon: ShoppingBag, badge: pendingOrders.length },
    { id: 'earnings', label: 'Pendapatan', icon: DollarSign },
    { id: 'skills', label: 'Keahlian', icon: Tags },
    { id: 'wallet', label: 'Wallet', icon: Wallet }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 glass border-b border-slate-100">
        <div className="flex items-center justify-between px-4 h-16">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100"
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-secondary">Mitra Dashboard</span>
          <button
            onClick={handleToggleOnline}
            className={`p-2 rounded-lg ${isOnline ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}
            data-testid="toggle-online-mobile"
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-50 transform transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-heading font-bold text-secondary">SuruAhai</span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50">
            <div className="flex items-center gap-3">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
                alt={user?.name}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-medium text-secondary text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500">Mitra</p>
              </div>
            </div>
          </div>

          {/* Online Toggle */}
          <div className="mb-6">
            <button
              onClick={handleToggleOnline}
              className={`w-full p-3 rounded-xl flex items-center justify-between transition-colors ${
                isOnline 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}
              data-testid="toggle-online"
            >
              <span className="font-medium text-sm">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <Power className="w-5 h-5" />
            </button>
          </div>

          {/* Menu */}
          <nav className="space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`sidebar-item w-full ${activeTab === item.id ? 'active' : ''}`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-500 hover:bg-red-50"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">
                Selamat datang, {user?.name}!
              </h1>

              {(!user?.mitra_profile?.services || user.mitra_profile.services.length === 0) && (
                <div className="card p-4 bg-amber-50 border-amber-100">
                  <p className="text-sm text-amber-900 font-medium">Lengkapi keahlian Anda</p>
                  <p className="text-sm text-amber-800/90 mt-1">
                    Pilih kategori jasa di tab <span className="font-medium">Keahlian</span> agar Anda muncul saat pelanggan booking.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('skills')}
                    className="mt-3 text-sm font-medium text-amber-900 underline"
                    data-testid="overview-go-skills"
                  >
                    Buka pengaturan keahlian
                  </button>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-blue-100">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xs text-slate-400">Total</span>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.total_orders || 0}
                  </p>
                  <p className="text-sm text-slate-500">Pesanan</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-green-100">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-xs text-slate-400">Selesai</span>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.completed_orders || 0}
                  </p>
                  <p className="text-sm text-slate-500">Pesanan</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-yellow-100">
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <span className="text-xs text-slate-400">Rating</span>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.rating?.toFixed(1) || '0.0'}
                  </p>
                  <p className="text-sm text-slate-500">dari 5.0</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-primary/10">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs text-slate-400">Total</span>
                  </div>
                  <p className="font-heading text-2xl font-bold text-primary">
                    Rp {(dashboard.total_earnings || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-sm text-slate-500">Pendapatan</p>
                </div>
              </div>

              {/* Pending Orders Alert */}
              {pendingOrders.length > 0 && (
                <div className="card p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <div className="flex-1">
                      <p className="font-medium text-yellow-800">
                        {pendingOrders.length} pesanan menunggu konfirmasi
                      </p>
                      <p className="text-sm text-yellow-600">
                        Segera konfirmasi untuk menjaga rating Anda
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="btn-primary py-2 px-4 text-sm"
                    >
                      Lihat
                    </button>
                  </div>
                </div>
              )}

              {/* Active Orders */}
              {activeOrders.length > 0 && (
                <div>
                  <h2 className="font-heading font-semibold text-lg text-secondary mb-4">
                    Pesanan Aktif
                  </h2>
                  <div className="space-y-3">
                    {activeOrders.slice(0, 3).map(order => (
                      <div 
                        key={order.id}
                        className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        data-testid={`active-order-${order.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-secondary">{order.service_name}</p>
                            <p className="text-sm text-slate-500">{order.user_name}</p>
                          </div>
                          <span className={`badge ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {order.scheduled_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {order.scheduled_time}
                          </span>
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
              <h1 className="font-heading text-2xl font-bold text-secondary">Pesanan</h1>

              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div 
                      key={order.id}
                      className="card p-4"
                      data-testid={`order-${order.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-secondary">{order.service_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">{order.user_name}</span>
                          </div>
                        </div>
                        <span className={`badge ${statusColors[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-2 text-sm mb-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="w-4 h-4" />
                          {order.scheduled_date}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="w-4 h-4" />
                          {order.scheduled_time}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{order.address}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <p className="font-heading font-bold text-primary">
                          Rp {order.total_amount?.toLocaleString('id-ID')}
                        </p>
                        
                        <div className="flex gap-2">
                          {order.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(order.id, 'CONFIRMED')}
                                className="btn-primary py-2 px-4 text-sm"
                                data-testid={`confirm-${order.id}`}
                              >
                                Terima
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                                className="btn-secondary py-2 px-4 text-sm text-red-500"
                                data-testid={`reject-${order.id}`}
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {order.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, 'IN_PROGRESS')}
                              className="btn-primary py-2 px-4 text-sm"
                              data-testid={`start-${order.id}`}
                            >
                              Mulai Kerja
                            </button>
                          )}
                          {order.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() =>
                                handleStatusUpdate(order.id, 'AWAITING_USER_CONFIRMATION')
                              }
                              className="btn-primary py-2 px-4 text-sm"
                              data-testid={`complete-${order.id}`}
                            >
                              Tandai selesai
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="btn-secondary py-2 px-4 text-sm"
                          >
                            Detail
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state card">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Belum ada pesanan</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Pastikan status Anda online untuk menerima pesanan
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Keahlian / profil jasa */}
          {activeTab === 'skills' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h1 className="font-heading text-2xl font-bold text-secondary">Keahlian & profil</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Tentukan jenis jasa yang Anda layani. Pelanggan hanya dapat memilih Anda untuk booking pada kategori yang dicentang.
                </p>
              </div>

              <div className="card p-6 space-y-3">
                <h2 className="font-heading font-semibold text-secondary text-sm">Kategori jasa</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        profileServices.includes(cat.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={profileServices.includes(cat.id)}
                        onChange={() => toggleProfileService(cat.id)}
                        data-testid={`skill-cat-${cat.id}`}
                      />
                      <div>
                        <p className="font-medium text-secondary text-sm">{cat.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card p-6 space-y-4">
                <h2 className="font-heading font-semibold text-secondary text-sm">Deskripsi singkat</h2>
                <textarea
                  value={profileDescription}
                  onChange={(e) => setProfileDescription(e.target.value)}
                  className="input min-h-[100px] resize-none"
                  placeholder="Ceritakan pengalaman atau spesialisasi Anda..."
                  data-testid="mitra-profile-description"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="btn-primary w-full sm:w-auto disabled:opacity-50"
                data-testid="save-mitra-profile"
              >
                {profileSaving ? 'Menyimpan…' : 'Simpan perubahan'}
              </button>
            </div>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Pendapatan</h1>

              <div className="rounded-2xl border border-white/20 p-6 shadow-card bg-gradient-to-br from-primary to-[#FF9E2C] text-white">
                <p className="text-white/80 mb-2">Total Pendapatan</p>
                <p className="font-heading text-4xl font-bold">
                  Rp {(dashboard.total_earnings || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-white/60 text-sm mt-2">
                  Dari {dashboard.completed_orders || 0} pesanan selesai
                </p>
              </div>

              <div className="card p-6">
                <h3 className="font-heading font-semibold text-secondary mb-4">
                  Rincian Komisi
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pendapatan kotor</span>
                    <span className="font-medium">100%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Komisi platform</span>
                    <span className="font-medium text-red-500">-15%</span>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-medium">Pendapatan bersih</span>
                    <span className="font-bold text-primary">85%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Tab */}
          {activeTab === 'wallet' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Wallet</h1>

              <div className="rounded-2xl border border-white/15 p-6 shadow-card bg-gradient-to-br from-secondary to-secondary-800 text-white">
                <p className="text-white/80 mb-2">Saldo Tersedia</p>
                <p className="font-heading text-4xl font-bold">
                  Rp {(wallet.balance || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-white/60 text-sm mt-2">
                  Siap untuk dicairkan
                </p>
              </div>

              <button 
                type="button"
                className="btn-primary w-full"
                disabled={balanceNum < MIN_WITHDRAW}
                onClick={openWithdrawModal}
                data-testid="withdraw-btn"
              >
                Tarik Dana
              </button>

              <div className="card p-6">
                <h3 className="font-heading font-semibold text-secondary mb-4">
                  Informasi Penarikan
                </h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Minimal penarikan Rp 50.000</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Proses 1-3 hari kerja</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Data rekening tujuan diisi saat Anda mengajukan penarikan</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {withdrawOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 sm:p-6"
          onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
          >
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="withdraw-title" className="font-heading text-lg font-bold text-secondary">
                    Tarik dana
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Saldo tersedia: Rp {balanceNum.toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  min={MIN_WITHDRAW}
                  max={balanceNum}
                  step="1000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="input"
                  required
                  data-testid="withdraw-amount"
                />
                <p className="text-xs text-slate-400 mt-1">Minimal Rp {MIN_WITHDRAW.toLocaleString('id-ID')}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nama bank</label>
                <input
                  type="text"
                  value={withdrawBankName}
                  onChange={(e) => setWithdrawBankName(e.target.value)}
                  className="input"
                  placeholder="Contoh: BCA"
                  required
                  data-testid="withdraw-bank-name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nomor rekening</label>
                <input
                  type="text"
                  value={withdrawBankAccount}
                  onChange={(e) => setWithdrawBankAccount(e.target.value)}
                  className="input"
                  placeholder="Nomor rekening penerima"
                  required
                  data-testid="withdraw-bank-account"
                />
              </div>

              <p className="text-xs text-slate-500">
                Data rekening akan disimpan di profil Anda untuk pengajuan berikutnya dan dapat diubah setiap kali tarik dana.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  disabled={withdrawSubmitting}
                  onClick={() => setWithdrawOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 disabled:opacity-50"
                  disabled={withdrawSubmitting}
                  data-testid="withdraw-submit"
                >
                  {withdrawSubmitting ? 'Memproses…' : 'Ajukan penarikan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 lg:hidden pb-safe z-40">
        <div className="flex items-center justify-around py-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
              data-testid={`mobile-nav-${item.id}`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default MitraDashboard;
