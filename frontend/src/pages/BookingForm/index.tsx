// ============================================================
// 预约表单页面 (P3) — 核心业务流程
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import AttendeePicker from '../../components/AttendeePicker';
import type { MeetingRoom, User, ApiResponse, ConflictInfo } from '../../types';
import styles from './BookingForm.module.css';

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  projector: '投影仪', tv: '电视屏幕', vc_terminal: '视频会议终端',
  mic: '麦克风', speaker: '音响', whiteboard: '白板',
  dock: '扩展坞', adapter: '转接头', phone: '会议电话',
};

export default function BookingFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [attendees, setAttendees] = useState<User[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 加载会议室列表 + 处理预填充参数
  useEffect(() => {
    api.get<ApiResponse<MeetingRoom[]>>('/rooms').then(res => {
      if (res.code === 0) {
        setRooms(res.data);
        const roomId = searchParams.get('room_id');
        if (roomId) {
          const room = res.data.find(r => r.id === roomId);
          if (room) setSelectedRoom(room);
        }
      }
    });
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start) setStartTime(start.slice(11, 16));
    if (end) setEndTime(end.slice(11, 16));
  }, [searchParams]);

  const selectedRoomData = rooms.find(r => r.id === selectedRoom?.id);

  async function handleSubmit() {
    if (!selectedRoom) { setError('请选择会议室'); return; }
    if (!title.trim()) { setError('请输入会议标题'); return; }
    if (startTime >= endTime) { setError('结束时间必须晚于开始时间'); return; }
    if (attendees.length === 0) { setError('请至少添加一位参会人'); return; }
    if (attendees.length > selectedRoom.capacity) {
      setError(`参会人数(${attendees.length})超过会议室容量(${selectedRoom.capacity}人)`);
      return;
    }

    setSubmitting(true);
    setError('');
    setConflict(null);

    try {
      const res = await api.post<ApiResponse<ConflictInfo | { id: string }>>('/bookings', {
        room_id: selectedRoom.id,
        title: title.trim(),
        agenda: agenda.trim(),
        start_time: `${date}T${startTime}:00`,
        end_time: `${date}T${endTime}:00`,
        attendee_ids: attendees.map(a => a.id),
        equipment_ids: selectedEquip,
      });

      if (res.code === 409) {
        setConflict(res.data as ConflictInfo);
      } else if (res.code === 0) {
        const data = res.data as { id: string; status?: string };
        if (data.status === 'pending_approval') {
          setSuccess('已提交审批，请等待管理员审核');
          setTimeout(() => navigate('/my-bookings'), 1500);
        } else {
          setSuccess('预约成功！');
          setTimeout(() => navigate('/my-bookings'), 1000);
        }
      }
    } catch {
      setError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>← 返回</button>
          <h2>📋 预约会议室</h2>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.form}>
          {/* 会议室选择 */}
          <div className={styles.formGroup}>
            <label>会议室 *</label>
            <select
              value={selectedRoom?.id || ''}
              onChange={e => {
                const room = rooms.find(r => r.id === e.target.value);
                setSelectedRoom(room || null);
                setSelectedEquip([]);
              }}
            >
              <option value="">请选择会议室</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.floor} · {r.capacity}人 · {r.room_type === 'small' ? '小' : r.room_type === 'medium' ? '中' : '大'}
                </option>
              ))}
            </select>
          </div>

          {/* 日期 + 时间 */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>日期 *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>开始时间 *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} step="1800" />
            </div>
            <div className={styles.formGroup}>
              <label>结束时间 *</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} step="1800" />
            </div>
          </div>

          {/* 标题 + 议程 */}
          <div className={styles.formGroup}>
            <label>会议标题 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入会议标题"
              maxLength={100}
            />
          </div>

          <div className={styles.formGroup}>
            <label>会议议程</label>
            <textarea
              value={agenda}
              onChange={e => setAgenda(e.target.value)}
              placeholder="输入会议议程（可选）"
              maxLength={500}
              rows={3}
            />
          </div>

          {/* 参会人选择器 */}
          <div className={styles.formGroup}>
            <label>参会人 *（至少含自己）</label>
            <AttendeePicker selected={attendees} onChange={setAttendees} />
          </div>

          {/* 设备需求 */}
          {selectedRoomData?.equipment && selectedRoomData.equipment.length > 0 && (
            <div className={styles.formGroup}>
              <label>设备需求</label>
              <div className={styles.equipList}>
                {selectedRoomData.equipment.map(eq => {
                  const checked = selectedEquip.includes(eq.id);
                  const disabled = eq.status !== 'available';
                  return (
                    <label
                      key={eq.id}
                      className={`${styles.equipItem} ${checked ? styles.equipChecked : ''} ${disabled ? styles.equipDisabled : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => setSelectedEquip(prev =>
                          prev.includes(eq.id) ? prev.filter(id => id !== eq.id) : [...prev, eq.id]
                        )}
                      />
                      <span>{eq.name}</span>
                      <span className={styles.equipType}>{EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}</span>
                      <span className={styles.equipStatus} style={{
                        color: eq.status === 'available' ? '#10b981' : eq.status === 'faulty' ? '#ef4444' : '#f59e0b'
                      }}>
                        {eq.status === 'available' ? '可用' : eq.status === 'faulty' ? '故障' : '维修中'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 冲突提示 */}
          {conflict?.has_conflict && (
            <div className={styles.conflictAlert}>
              <p className={styles.conflictTitle}>⚠️ 时间冲突</p>
              <p>该时段已被 <strong>{conflict.existing_booking?.organizer_name}</strong> 的「{conflict.existing_booking?.title}」占用</p>
              {conflict.alternative_rooms && conflict.alternative_rooms.length > 0 && (
                <div className={styles.alternatives}>
                  <p>推荐替代会议室：</p>
                  {conflict.alternative_rooms.map(r => (
                    <button
                      key={r.id}
                      className={styles.altBtn}
                      onClick={() => {
                        setSelectedRoom(r);
                        setConflict(null);
                      }}
                    >
                      {r.name} · {r.floor} · {r.capacity}人
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 审批提示 */}
          {selectedRoom && selectedRoom.capacity > 20 && !conflict && (
            <div className={styles.approvalHint}>
              💡 该会议室为大会议室（{'>'}20人），提交后将进入审批流程
            </div>
          )}

          {/* 提交 */}
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交预约'}
          </button>
        </div>
      </div>
    </div>
  );
}
