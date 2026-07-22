// ============================================================
// 首页时间轴视图 (P1) — 核心页面
// 会议室卡片列表 + 当日时间槽 + 快速预约入口
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../hooks/useAuth';
import type { MeetingRoom, ApiResponse } from '../../types';
import styles from './Home.module.css';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 ~ 20:00
const FLOORS = ['3F', '5F', '8F', '10F'];
const EQUIPMENT_TYPES = [
  { value: 'projector', label: '投影仪', icon: '📽️' },
  { value: 'vc_terminal', label: '视频会议', icon: '📹' },
  { value: 'whiteboard', label: '白板', icon: '📝' },
];

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export default function HomePage() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [floorFilter, setFloorFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [equipFilter, setEquipFilter] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{
    roomId: string;
    roomName: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | string[]> = { date: selectedDate };
      if (keyword) params.keyword = keyword;
      if (floorFilter) params.floor = floorFilter;
      if (equipFilter.length > 0) params.equipment_types = equipFilter;

      const res = await api.get<ApiResponse<MeetingRoom[]>>('/rooms', params);
      if (res.code === 0) {
        // 按楼层排序
        const sorted = [...res.data].sort((a, b) => {
          const fa = parseInt(a.floor) || 0;
          const fb = parseInt(b.floor) || 0;
          if (fa !== fb) return fa - fb;
          return a.name.localeCompare(b.name);
        });
        setRooms(sorted);
      } else {
        setError(res.message);
      }
    } catch {
      setError('加载会议室列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, keyword, floorFilter, equipFilter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  function getSlotStatus(room: MeetingRoom, hour: number, minute: number): 'free' | 'occupied' | 'ongoing' | 'past' {
    const slotStart = `${selectedDate}T${formatTime(hour, minute)}:00`;
    const slotEndHour = minute === 30 ? hour + 1 : hour;
    const slotEndMin = minute === 30 ? 0 : 30;
    const slotEnd = `${selectedDate}T${formatTime(slotEndHour, slotEndMin)}:00`;

    const now = new Date().toISOString();
    if (slotEnd < now) return 'past';

    const bookings = room.current_status?.today_bookings || [];
    for (const b of bookings) {
      if (b.start_time < slotEnd && b.end_time > slotStart) {
        if (b.status === 'checked_in') return 'ongoing';
        return 'occupied';
      }
    }
    return 'free';
  }

  function handleSlotClick(room: MeetingRoom, hour: number, minute: number) {
    const startTime = `${selectedDate}T${formatTime(hour, minute)}:00`;
    const endHour = minute === 30 ? hour + 1 : hour;
    const endMin = minute === 30 ? 0 : 30;
    const endTime = `${selectedDate}T${formatTime(endHour, endMin)}:00`;

    setSelectedSlot({
      roomId: room.id,
      roomName: room.name,
      startTime,
      endTime,
    });
  }

  function handleQuickBook() {
    if (!selectedSlot) return;
    navigate(`/booking?room_id=${selectedSlot.roomId}&start=${selectedSlot.startTime}&end=${selectedSlot.endTime}`);
  }

  function getOccupiedInfo(room: MeetingRoom, hour: number, minute: number) {
    const slotStart = `${selectedDate}T${formatTime(hour, minute)}:00`;
    const slotEndHour = minute === 30 ? hour + 1 : hour;
    const slotEndMin = minute === 30 ? 0 : 30;
    const slotEnd = `${selectedDate}T${formatTime(slotEndHour, slotEndMin)}:00`;

    const bookings = room.current_status?.today_bookings || [];
    return bookings.find(b => b.start_time < slotEnd && b.end_time > slotStart) || null;
  }

  return (
    <div className={styles.page}>
      {/* 顶部导航 */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <h1>🏢 会议室预约</h1>
          <span className={styles.userInfo}>{user?.name} · {user?.department}</span>
        </div>
        <div className={styles.topRight}>
          <button className={styles.navBtn} onClick={() => navigate('/admin/rooms')}>⚙️ 管理</button>
          <button className={styles.navBtn} onClick={() => { logout(); navigate('/login'); }}>退出</button>
        </div>
      </header>

      {/* 筛选栏 */}
      <div className={styles.filterBar}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className={styles.dateInput}
        />
        <input
          type="text"
          placeholder="🔍 搜索会议室..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.floorBtns}>
          <button
            className={`${styles.filterBtn} ${!floorFilter ? styles.active : ''}`}
            onClick={() => setFloorFilter('')}
          >
            全部
          </button>
          {FLOORS.map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${floorFilter === f ? styles.active : ''}`}
              onClick={() => setFloorFilter(floorFilter === f ? '' : f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className={styles.equipBtns}>
          {EQUIPMENT_TYPES.map(eq => (
            <button
              key={eq.value}
              className={`${styles.filterBtn} ${equipFilter.includes(eq.value) ? styles.active : ''}`}
              onClick={() => setEquipFilter(prev =>
                prev.includes(eq.value) ? prev.filter(v => v !== eq.value) : [...prev, eq.value]
              )}
            >
              {eq.icon} {eq.label}
            </button>
          ))}
        </div>
      </div>

      {/* 时间轴 */}
      <div className={styles.timeline}>
        {/* 时间刻度头 */}
        <div className={styles.timelineHeader}>
          <div className={styles.roomLabel}>会议室</div>
          <div className={styles.timeSlots}>
            {HOURS.map(h => (
              <div key={h} className={styles.hourLabel}>{formatTime(h, 0)}</div>
            ))}
          </div>
        </div>

        {/* 状态 */}
        {loading ? (
          <div className={styles.skeleton}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skelName} />
                <div className={styles.skelSlots}>
                  {HOURS.map(h => <div key={h} className={styles.skelSlot} />)}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>❌ {error}</p>
            <button className={styles.retryBtn} onClick={fetchRooms}>重试</button>
          </div>
        ) : rooms.length === 0 ? (
          <div className={styles.empty}>
            <p>📭</p>
            <p>没有找到匹配的会议室</p>
            <button className={styles.clearFilterBtn} onClick={() => { setKeyword(''); setFloorFilter(''); setEquipFilter([]); }}>
              清除筛选条件
            </button>
          </div>
        ) : (
          <div className={styles.timelineBody}>
            {rooms.map(room => (
              <div key={room.id} className={styles.roomRow}>
                <div className={styles.roomInfo} onClick={() => navigate(`/rooms/${room.id}`)}>
                  <span className={styles.roomName}>{room.name}</span>
                  <span className={styles.roomMeta}>
                    {room.capacity}人
                    {room.equipment && room.equipment.length > 0 && (
                      <span className={styles.equipIcons}>
                        {' '}
                        {room.equipment.slice(0, 3).map(eq => {
                          const found = EQUIPMENT_TYPES.find(et => et.value === eq.type);
                          return <span key={eq.id} title={found?.label}>{found?.icon || '📌'}</span>;
                        })}
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.slotRow}>
                  {HOURS.flatMap(h => [[h, 0], [h, 30]] as const).map(([h, m]) => {
                    const status = getSlotStatus(room, h, m);
                    const booking = status !== 'free' && status !== 'past' ? getOccupiedInfo(room, h, m) : null;
                    const isSelected = selectedSlot?.roomId === room.id &&
                      selectedSlot.startTime === `${selectedDate}T${formatTime(h, m)}:00`;

                    return (
                      <div
                        key={`${h}-${m}`}
                        className={`${styles.slot} ${styles[status]} ${isSelected ? styles.selected : ''}`}
                        onClick={() => status === 'free' && handleSlotClick(room, h, m)}
                        title={booking ? `${booking.title} - ${booking.organizer_name}` : status === 'free' ? '点击预约' : ''}
                      >
                        {booking && (
                          <span className={styles.slotLabel}>
                            {booking.title.slice(0, 6)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 图例 */}
        <div className={styles.legend}>
          <span><span className={styles.legendDot} style={{ background: '#22c55e' }} /> 空闲可预约</span>
          <span><span className={styles.legendDot} style={{ background: '#ef4444' }} /> 已占用</span>
          <span><span className={styles.legendDot} style={{ background: '#f97316' }} /> 会议进行中</span>
          <span><span className={styles.legendDot} style={{ background: '#f3f4f6' }} /> 已过期</span>
        </div>
      </div>

      {/* 快速预约浮层 */}
      {selectedSlot && (
        <div className={styles.quickBookBar}>
          <div className={styles.quickBookInfo}>
            <strong>{selectedSlot.roomName}</strong>
            <span>{selectedSlot.startTime.slice(11, 16)} - {selectedSlot.endTime.slice(11, 16)}</span>
          </div>
          <div className={styles.quickBookActions}>
            <button className={styles.cancelBtn} onClick={() => setSelectedSlot(null)}>取消</button>
            <button className={styles.bookBtn} onClick={handleQuickBook}>立即预约 →</button>
          </div>
        </div>
      )}
    </div>
  );
}
