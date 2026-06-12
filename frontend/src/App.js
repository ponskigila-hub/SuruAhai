import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserDashboard from './pages/UserDashboard';
import MitraDashboard from './pages/MitraDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookingPage from './pages/BookingPage';
import OrderDetailPage from './pages/OrderDetailPage';
import NotificationsPage from './pages/NotificationsPage';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    if (user.role === 'USER') return <Navigate to="/dashboard" replace />;
    if (user.role === 'MITRA') return <Navigate to="/mitra" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  }
  
  return children;
};

// Dashboard Router - redirects based on role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'MITRA':
      return <Navigate to="/mitra" replace />;
    default:
      return <UserDashboard />;
  }
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
      />
      
      {/* Protected Routes */}
      <Route 
        path="/dashboard/*" 
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        } 
      />
      
      {/* User Routes */}
      <Route 
        path="/booking/:serviceId" 
        element={
          <ProtectedRoute allowedRoles={['USER']}>
            <BookingPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/orders/:orderId" 
        element={
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute allowedRoles={['USER']}>
            <NotificationsPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Mitra Routes */}
      <Route 
        path="/mitra/*" 
        element={
          <ProtectedRoute allowedRoles={['MITRA']}>
            <MitraDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin Routes */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
