// ============================================================
// 会议室详情页 (P2)
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { MeetingRoom, ApiResponse } from '../../types';
import styles from './RoomDetail.module.css';

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  projector: '投影仪', tv: '电视屏幕', vc_terminal: '视频会议终端',
  mic: '麦克风', speaker: '音响', whiteboard: '白板',
  dock: '扩展坞', adapter: '转接头', phone: '会议电话',
};

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  active: { text: '可用', color: '#10b981' },
  inactive: { text: '已停用', color: '#9ca3af' },
  maintenance: { text: '维护中', color: '#f59e0b' },
};

const ROOM_TYPE_MAP: Record<string, string> = {
  small: '小会议室（≤6人）',
  medium: '中型会议室（7-20人）',
  large: '大型会议室（>20人）',
};

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<MeetingRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<ApiResponse<MeetingRoom>>(`/rooms/${id}`)
      .then(res => {
        if (res.code === 0) setRoom(res.data);
        else setError(res.message);
      })
      .catch(() => setError('加载会议室详情失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.page}><div className={styles.skeleton}><div /><div /><div /></div></div>;
  if (error) return <div className={styles.page}><div className={styles.error}>❌ {error}</div></div>;
  if (!room) return <div className={styles.page}><div className={styles.error}>会议室不存在</div></div>;

  const status = STATUS_MAP[room.status] || { text: room.status, color: '#9ca3af' };
  const bookings = room.current_status?.today_bookings || [];

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← 返回</button>

      <div className={styles.card}>
        <div className={styles.topSection}>
          <div>
            <h1>{room.name}</h1>
            <p className={styles.location}>{room.building} · {room.floor} · {room.location_desc}</p>
          </div>
          <span className={styles.statusBadge} style={{ background: status.color }}>
            {status.text}
          </span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>类型</span>
            <span>{ROOM_TYPE_MAP[room.room_type] || room.room_type}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>容量</span>
            <span>{room.capacity} 人</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>楼层</span>
            <span>{room.floor}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>楼栋</span>
            <span>{room.building}</span>
          </div>
        </div>

        {/* 设备清单 */}
        {room.equipment && room.equipment.length > 0 && (
          <div className={styles.section}>
            <h3>🖥️ 设备清单</h3>
            <div className={styles.equipGrid}>
              {room.equipment.map(eq => (
                <div key={eq.id} className={styles.equipCard}>
                  <span className={styles.equipName}>{eq.name}</span>
                  <span className={styles.equipType}>{EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}</span>
                  <span className={styles.equipStatus} style={{
                    color: eq.status === 'available' ? '#10b981' : eq.status === 'faulty' ? '#ef4444' : '#f59e0b'
                  }}>
                    {eq.status === 'available' ? '✓ 可用' : eq.status === 'faulty' ? '✗ 故障' : '🔧 维修中'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 今日预约 */}
        <div className={styles.section}>
          <h3>📅 今日预约</h3>
          {bookings.length === 0 ? (
            <p className={styles.noBookings}>今天暂无预约</p>
          ) : (
            <div className={styles.bookingList}>
              {bookings.map(b => (
                <div key={b.booking_id} className={styles.bookingItem}>
                  <div className={styles.bookingTime}>
                    {b.start_time.slice(11, 16)} - {b.end_time.slice(11, 16)}
                  </div>
                  <div className={styles.bookingInfo}>
                    <span className={styles.bookingTitle}>{b.title}</span>
                    <span className={styles.bookingOrg}>{b.organizer_name}</span>
                  </div>
                  <span className={`${styles.bookingStatus} ${styles[`status_${b.status}`]}`}>
                    {b.status === 'confirmed' ? '已确认' :
                     b.status === 'checked_in' ? '进行中' :
                     b.status === 'pending_approval' ? '待审批' : b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 预约按钮 */}
        <button
          className={styles.bookBtn}
          onClick={() => navigate(`/booking?room_id=${room.id}`)}
        >
          立即预约 →
        </button>
      </div>
    </div>
  );
}
