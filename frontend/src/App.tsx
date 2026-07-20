// ============================================================
// 应用主入口 — 路由配置
// ============================================================

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './hooks/useAuth';
import { RequireAuth } from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/Home';
import BookingFormPage from './pages/BookingForm';
import RoomDetailPage from './pages/RoomDetail';
import MyBookingsPage from './pages/MyBookings';
import AdminRoomsPage from './pages/AdminRoomsPage';
import './App.css';

function AppRoutes() {
  const initialize = useAuthStore(s => s.initialize);
  const isLoading = useAuthStore(s => s.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 16, color: '#9ca3af',
      }}>
        ⏳ 正在初始化...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/booking" element={<RequireAuth><BookingFormPage /></RequireAuth>} />
      <Route path="/rooms/:id" element={<RequireAuth><RoomDetailPage /></RequireAuth>} />
      <Route path="/my-bookings" element={<RequireAuth><MyBookingsPage /></RequireAuth>} />
      <Route path="/admin/rooms" element={<RequireAuth><AdminRoomsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
