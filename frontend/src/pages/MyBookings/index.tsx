// ============================================================
// 我的预约页面 (P4)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Booking, ApiResponse, PaginatedData } from '../../types';
import styles from './MyBookings.module.css';

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'confirmed,checked_in', label: '进行中' },
  { key: 'pending_approval', label: '待审批' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled,released', label: '已取消/释放' },
];

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  confirmed: { text: '已确认', color: '#3b82f6' },
  checked_in: { text: '已签到', color: '#10b981' },
  pending_approval: { text: '待审批', color: '#f59e0b' },
  completed: { text: '已完成', color: '#8b5cf6' },
  cancelled: { text: '已取消', color: '#9ca3af' },
  released: { text: '已释放', color: '#ef4444' },
};

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (activeTab) params.status = activeTab;
      const res = await api.get<ApiResponse<PaginatedData<Booking>>>('/bookings/mine', params);
      if (res.code === 0) setBookings(res.data.items);
      else setError(res.message);
    } catch {
      setError('加载预约列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleCancel(bookingId: string) {
    if (!confirm('确定取消该预约吗？')) return;
    setActionLoading(bookingId);
    try {
      await api.delete(`/bookings/${bookingId}`);
      fetchBookings();
    } catch {
      alert('取消失败');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCheckin(bookingId: string) {
    setActionLoading(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/checkin`);
      fetchBookings();
    } catch {
      alert('签到失败');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 首页</button>
        <h2>📋 我的预约</h2>
        <button className={styles.newBtn} onClick={() => navigate('/booking')}>+ 新建预约</button>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.skeleton}>
          {[1,2,3,4].map(i => <div key={i} className={styles.skelItem} />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className={styles.empty}>
          <p>📭</p>
          <p>暂无预约记录</p>
          <button className={styles.newBtn} onClick={() => navigate('/booking')}>去预约会议室</button>
        </div>
      ) : (
        <div className={styles.list}>
          {bookings.map(b => {
            const s = STATUS_MAP[b.status] || { text: b.status, color: '#9ca3af' };
            const isLoading = actionLoading === b.id;
            return (
              <div key={b.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{b.title}</h3>
                  <span className={styles.statusBadge} style={{ background: s.color }}>{s.text}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardInfo}>
                    <span>🏢 {b.room_name}</span>
                    <span>📍 {b.room_floor}</span>
                  </div>
                  <div className={styles.cardTime}>
                    {b.start_time?.slice(0, 16)?.replace('T', ' ')} — {b.end_time?.slice(11, 16)}
                  </div>
                  {b.attendees && b.attendees.length > 0 && (
                    <div className={styles.cardAttendees}>
                      👥 {b.attendees.map(a => a.user_name).join('、')}
                    </div>
                  )}
                </div>
                {(b.status === 'confirmed' || b.status === 'pending_approval') && (
                  <div className={styles.cardActions}>
                    {b.status === 'confirmed' && (
                      <button
                        className={styles.checkinBtn}
                        onClick={() => handleCheckin(b.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : '✅ 签到'}
                      </button>
                    )}
                    <button
                      className={styles.cancelBtn}
                      onClick={() => handleCancel(b.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? '...' : '取消预约'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
