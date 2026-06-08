import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Users, Briefcase, DollarSign, AlertTriangle, LogOut,
  Menu, X, TrendingUp, ShoppingBag, Wallet, CheckCircle,
  Search, Shield, Ban
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getAdminDashboard, getAllUsers, updateUserStatus, verifyMitra, 
  getEscrowList, getOrders 
} from '../services/api';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [users, setUsers] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardRes, usersRes, escrowRes, ordersRes] = await Promise.all([
        getAdminDashboard(),
        getAllUsers(),
        getEscrowList(),
        getOrders()
      ]);
      setDashboard(dashboardRes.data);
      setUsers(usersRes.data);
      setEscrows(escrowRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await updateUserStatus(userId, !currentStatus);
      toast.success(currentStatus ? 'User disuspend' : 'User diaktifkan');
      loadData();
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const handleVerifyMitra = async (mitraId) => {
    try {
      await verifyMitra(mitraId);
      toast.success('Mitra berhasil diverifikasi');
      loadData();
    } catch (error) {
      toast.error('Gagal memverifikasi mitra');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout berhasil');
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const mitras = users.filter(u => u.role === 'MITRA');
  const unverifiedMitras = mitras.filter(m => !m.mitra_profile?.is_verified);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'mitras', label: 'Mitra', icon: Briefcase, badge: unverifiedMitras.length },
    { id: 'financial', label: 'Keuangan', icon: DollarSign },
    { id: 'orders', label: 'Pesanan', icon: ShoppingBag }
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
          <span className="font-heading font-bold text-secondary">Admin Panel</span>
          <div className="w-10"></div>
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
      <aside className={`fixed top-0 left-0 h-full w-64 bg-secondary z-50 transform transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#FF9E2C] flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <div>
                <span className="font-heading font-bold text-white">SuruAhai</span>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="mb-6 p-4 rounded-xl bg-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">{user?.name}</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            </div>
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  activeTab === item.id 
                    ? 'bg-primary text-white' 
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Dashboard Overview</h1>

              {/* Stats Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-primary/10">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    Rp {(dashboard.total_gmv || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-sm text-slate-500">Total GMV</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-green-100">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-green-600">
                    Rp {(dashboard.commission_revenue || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-sm text-slate-500">Revenue (15%)</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-blue-100">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.total_users || 0}
                  </p>
                  <p className="text-sm text-slate-500">Total Users</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-purple-100">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.total_mitras || 0}
                    <span className="text-sm font-normal text-green-500 ml-2">
                      ({dashboard.active_mitras || 0} online)
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">Total Mitra</p>
                </div>
              </div>

              {/* Second Row Stats */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-yellow-100">
                      <ShoppingBag className="w-5 h-5 text-yellow-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {dashboard.total_orders || 0}
                  </p>
                  <p className="text-sm text-slate-500">Total Pesanan</p>
                  <div className="mt-2 flex gap-2">
                    <span className="badge badge-success">{dashboard.completed_orders || 0} selesai</span>
                    <span className="badge badge-warning">{dashboard.pending_orders || 0} pending</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-orange-100">
                      <Wallet className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-orange-600">
                    Rp {(dashboard.escrow_balance || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-sm text-slate-500">Escrow Balance</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="stat-icon bg-red-100">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {unverifiedMitras.length}
                  </p>
                  <p className="text-sm text-slate-500">Mitra Pending Verifikasi</p>
                </div>
              </div>

              {/* Quick Actions */}
              {unverifiedMitras.length > 0 && (
                <div className="card p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <div className="flex-1">
                      <p className="font-medium text-yellow-800">
                        {unverifiedMitras.length} mitra menunggu verifikasi
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('mitras')}
                      className="btn-primary py-2 px-4 text-sm"
                    >
                      Verifikasi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="font-heading text-2xl font-bold text-secondary">User Management</h1>
                
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari user..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input pl-10 w-full sm:w-64"
                      data-testid="search-users"
                    />
                  </div>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="input w-32"
                    data-testid="filter-role"
                  >
                    <option value="all">Semua</option>
                    <option value="USER">User</option>
                    <option value="MITRA">Mitra</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} data-testid={`user-row-${u.id}`}>
                          <td>
                            <div className="flex items-center gap-3">
                              <img 
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                                alt={u.name}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="font-medium">{u.name}</span>
                            </div>
                          </td>
                          <td className="text-slate-500">{u.email}</td>
                          <td>
                            <span className={`badge ${
                              u.role === 'ADMIN' ? 'badge-error' :
                              u.role === 'MITRA' ? 'badge-info' :
                              'badge-success'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                              {u.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {u.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    u.is_active 
                                      ? 'hover:bg-red-50 text-red-500' 
                                      : 'hover:bg-green-50 text-green-500'
                                  }`}
                                  title={u.is_active ? 'Suspend' : 'Activate'}
                                  data-testid={`toggle-status-${u.id}`}
                                >
                                  {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Mitras Tab */}
          {activeTab === 'mitras' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Mitra Management</h1>

              {/* Pending Verification */}
              {unverifiedMitras.length > 0 && (
                <div>
                  <h2 className="font-heading font-semibold text-lg text-secondary mb-4">
                    Pending Verifikasi ({unverifiedMitras.length})
                  </h2>
                  <div className="grid gap-4">
                    {unverifiedMitras.map(mitra => (
                      <div key={mitra.id} className="card p-4" data-testid={`mitra-pending-${mitra.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <img 
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mitra.name}`}
                              alt={mitra.name}
                              className="w-12 h-12 rounded-xl"
                            />
                            <div>
                              <p className="font-medium text-secondary">{mitra.name}</p>
                              <p className="text-sm text-slate-500">{mitra.email}</p>
                              <p className="text-sm text-slate-500">{mitra.phone}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleVerifyMitra(mitra.id)}
                            className="btn-primary py-2 px-4 text-sm"
                            data-testid={`verify-mitra-${mitra.id}`}
                          >
                            <Shield className="w-4 h-4 mr-2 inline" />
                            Verifikasi
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Mitras */}
              <div>
                <h2 className="font-heading font-semibold text-lg text-secondary mb-4">
                  Mitra Terverifikasi
                </h2>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Mitra</th>
                          <th>Rating</th>
                          <th>Orders</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mitras.filter(m => m.mitra_profile?.is_verified).map(mitra => (
                          <tr key={mitra.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <img 
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mitra.name}`}
                                  alt={mitra.name}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div>
                                  <span className="font-medium">{mitra.name}</span>
                                  <p className="text-xs text-slate-500">{mitra.email}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="flex items-center gap-1">
                                ⭐ {mitra.mitra_profile?.rating?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                            <td>{mitra.mitra_profile?.total_orders || 0}</td>
                            <td>
                              <span className={`badge ${mitra.mitra_profile?.is_online ? 'badge-success' : 'badge-warning'}`}>
                                {mitra.mitra_profile?.is_online ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleToggleUserStatus(mitra.id, mitra.is_active)}
                                className={`p-2 rounded-lg transition-colors ${
                                  mitra.is_active 
                                    ? 'hover:bg-red-50 text-red-500' 
                                    : 'hover:bg-green-50 text-green-500'
                                }`}
                                title={mitra.is_active ? 'Suspend' : 'Activate'}
                              >
                                {mitra.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financial Tab */}
          {activeTab === 'financial' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Keuangan</h1>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/20 p-6 shadow-card bg-gradient-to-br from-primary to-[#FF9E2C] text-white">
                  <p className="text-white/80 mb-2">Total GMV</p>
                  <p className="font-heading text-3xl font-bold">
                    Rp {(dashboard.total_gmv || 0).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/20 p-6 shadow-card bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <p className="text-white/80 mb-2">Revenue (15%)</p>
                  <p className="font-heading text-3xl font-bold">
                    Rp {(dashboard.commission_revenue || 0).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 p-6 shadow-card bg-gradient-to-br from-secondary to-secondary-800 text-white">
                  <p className="text-white/80 mb-2">Escrow Balance</p>
                  <p className="font-heading text-3xl font-bold">
                    Rp {(dashboard.escrow_balance || 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* Escrow Transactions */}
              <div>
                <h2 className="font-heading font-semibold text-lg text-secondary mb-4">
                  Escrow Transactions
                </h2>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escrows.length > 0 ? escrows.map(escrow => (
                          <tr key={escrow.id}>
                            <td className="font-mono text-sm">{escrow.order_id?.slice(-8)}</td>
                            <td className="font-medium">
                              Rp {escrow.amount?.toLocaleString('id-ID')}
                            </td>
                            <td>
                              <span className={`badge ${
                                escrow.status === 'HOLD' ? 'badge-warning' :
                                escrow.status === 'RELEASED' ? 'badge-success' :
                                'badge-error'
                              }`}>
                                {escrow.status}
                              </span>
                            </td>
                            <td className="text-slate-500 text-sm">
                              {new Date(escrow.created_at).toLocaleDateString('id-ID')}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="4" className="text-center text-slate-500 py-8">
                              Belum ada transaksi escrow
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-secondary">Semua Pesanan</h1>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Service</th>
                        <th>User</th>
                        <th>Mitra</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length > 0 ? orders.map(order => (
                        <tr key={order.id}>
                          <td className="font-mono text-sm">{order.id?.slice(-8)}</td>
                          <td>{order.service_name}</td>
                          <td>{order.user_name}</td>
                          <td>{order.mitra_name}</td>
                          <td className="font-medium">
                            Rp {order.total_amount?.toLocaleString('id-ID')}
                          </td>
                          <td>
                            <span className={`badge ${
                              order.status === 'COMPLETED' ? 'badge-success' :
                              order.status === 'CANCELLED' ? 'badge-error' :
                              order.status === 'PENDING' || order.status === 'AWAITING_USER_CONFIRMATION' ? 'badge-warning' :
                              'badge-info'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="text-slate-500 text-sm">
                            {order.scheduled_date}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="text-center text-slate-500 py-8">
                            Belum ada pesanan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
