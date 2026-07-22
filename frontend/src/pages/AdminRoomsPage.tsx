// ============================================================
// 会议室管理页面 (P6) — 管理后台
// CRUD 表格 + 表单弹窗 + 设备绑定 + 状态管理 + 批量导入导出
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { MeetingRoom, Equipment, RoomType, RoomStatus, ApiResponse } from '../types';
import styles from './AdminRoomsPage.module.css';

// 设备类型中文映射
const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  projector: '投影仪',
  tv: '电视屏幕',
  vc_terminal: '视频会议终端',
  mic: '麦克风',
  speaker: '音响',
  whiteboard: '白板',
  dock: '扩展坞',
  adapter: '转接头',
  phone: '会议电话',
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  small: '小（≤6人）',
  medium: '中（7-20人）',
  large: '大（>20人）',
};

const STATUS_LABELS: Record<RoomStatus, { text: string; color: string }> = {
  active: { text: '可用', color: '#10b981' },
  inactive: { text: '已停用', color: '#9ca3af' },
  maintenance: { text: '维护中', color: '#f59e0b' },
};

interface RoomFormData {
  name: string;
  floor: string;
  building: string;
  capacity: number;
  room_type: RoomType;
  status: RoomStatus;
  location_desc: string;
  equipment_ids: string[];
}

const EMPTY_FORM: RoomFormData = {
  name: '',
  floor: '',
  building: 'A栋',
  capacity: 10,
  room_type: 'medium',
  status: 'active',
  location_desc: '',
  equipment_ids: [],
};

const FLOORS = ['1F', '2F', '3F', '5F', '8F', '10F', '12F', '15F'];
const BUILDINGS = ['A栋', 'B栋', 'C栋'];

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ---- 导入导出状态 ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ApiResponse<MeetingRoom[]>>('/rooms');
      if (res.code === 0) setRooms(res.data);
      else setError(res.message);
    } catch {
      setError('加载会议室列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEquipment = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<Equipment[]>>('/equipment');
      if (res.code === 0) setEquipment(res.data);
    } catch { /* 非关键 */ }
  }, []);

  useEffect(() => { fetchRooms(); fetchEquipment(); }, [fetchRooms, fetchEquipment]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(room: MeetingRoom) {
    setEditingId(room.id);
    setForm({
      name: room.name,
      floor: room.floor,
      building: room.building,
      capacity: room.capacity,
      room_type: room.room_type,
      status: room.status,
      location_desc: room.location_desc,
      equipment_ids: (room.equipment || []).map(e => e.id),
    });
    setFormError('');
    setModalOpen(true);
  }

  function validateForm(): boolean {
    if (!form.name.trim()) { setFormError('请输入会议室名称'); return false; }
    if (!form.floor) { setFormError('请选择楼层'); return false; }
    if (form.capacity < 1) { setFormError('容量必须大于0'); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    setSubmitting(true);
    setFormError('');

    try {
      const body = {
        name: form.name.trim(),
        floor: form.floor,
        building: form.building,
        capacity: form.capacity,
        room_type: form.room_type,
        status: form.status,
        location_desc: form.location_desc.trim(),
        equipment_ids: form.equipment_ids,
      };

      if (editingId) {
        await api.put(`/rooms/${editingId}`, body);
      } else {
        await api.post('/rooms', body);
      }
      setModalOpen(false);
      fetchRooms();
    } catch {
      setFormError('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(room: MeetingRoom) {
    const newStatus: RoomStatus = room.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/rooms/${room.id}`, { status: newStatus });
      fetchRooms();
    } catch {
      alert('操作失败');
    }
  }

  async function handleDelete(room: MeetingRoom) {
    if (!confirm(`确定停用「${room.name}」吗？`)) return;
    try {
      await api.delete(`/rooms/${room.id}`);
      fetchRooms();
    } catch {
      alert('操作失败');
    }
  }

  // ---- 导入 ----
  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    setImportErrors([]);
    try {
      const res = await api.upload<ApiResponse<{ imported: number; failed: number; errors?: Array<{ row: number; reason: string }> }>>('/rooms/import', file);
      if (res.code === 0) {
        setImportResult({ imported: res.data.imported, failed: res.data.failed });
        if (res.data.errors?.length) {
          setImportErrors(res.data.errors.map(e => `第${e.row}行：${e.reason}`));
        }
        fetchRooms();
      } else {
        setImportErrors([res.message || '导入失败']);
      }
    } catch {
      setImportErrors(['导入请求失败，请检查文件格式']);
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    // 重置 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ---- 导出 ----
  async function handleExport() {
    setExporting(true);
    try {
      await api.download('/rooms/export', `会议室列表_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  // ---- 模板下载 ----
  async function handleDownloadTemplate() {
    try {
      await api.download('/rooms/export', '会议室导入模板.xlsx');
    } catch {
      alert('模板下载失败');
    }
  }

  function toggleEquipment(equipId: string) {
    setForm(prev => ({
      ...prev,
      equipment_ids: prev.equipment_ids.includes(equipId)
        ? prev.equipment_ids.filter(id => id !== equipId)
        : [...prev.equipment_ids, equipId],
    }));
  }

  // 按楼层分组设备
  const roomEquipment = equipment.filter(e => !e.room_id || e.room_id === editingId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>🏢 会议室管理</h2>
          <p className={styles.subtitle}>管理会议室资源、设备绑定和状态</p>
        </div>
        <div className={styles.headerActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className={styles.btnSecondary}
            onClick={handleDownloadTemplate}
            title="下载 Excel 导入模板"
          >
            📥 模板
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? '⏳ 导入中...' : '📤 导入'}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? '⏳ 导出中...' : '📥 导出'}
          </button>
          <button className={styles.btnPrimary} onClick={openCreate}>
            + 新增会议室
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* 导入结果提示 */}
      {importResult && (
        <div className={`${styles.importBanner} ${importResult.failed > 0 ? styles.importBannerWarn : ''}`}>
          <span className={styles.importBannerIcon}>
            {importResult.failed === 0 ? '✅' : '⚠️'}
          </span>
          <div>
            <strong>导入完成：</strong>
            成功 {importResult.imported} 条
            {importResult.failed > 0 && <span>，失败 {importResult.failed} 条</span>}
          </div>
          {importErrors.length > 0 && (
            <ul className={styles.importErrors}>
              {importErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
          <button className={styles.importDismiss} onClick={() => { setImportResult(null); setImportErrors([]); }}>×</button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.skeleton}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={styles.skeletonRow}>
                <div /><div /><div /><div /><div />
              </div>
            ))}
          </div>
        </div>
      ) : rooms.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>📭</p>
          <p>暂无会议室数据</p>
          <button className={styles.btnPrimary} onClick={openCreate}>创建第一间会议室</button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>名称</th>
                <th>楼层</th>
                <th>楼栋</th>
                <th>容量</th>
                <th>类型</th>
                <th>状态</th>
                <th>设备数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const s = STATUS_LABELS[room.status];
                const eqCount = (room.equipment || []).length;
                return (
                  <tr key={room.id}>
                    <td className={styles.roomName}>{room.name}</td>
                    <td>{room.floor}</td>
                    <td>{room.building}</td>
                    <td>{room.capacity} 人</td>
                    <td>{ROOM_TYPE_LABELS[room.room_type]}</td>
                    <td>
                      <span className={styles.statusBadge} style={{ background: s.color }}>
                        {s.text}
                      </span>
                    </td>
                    <td>{eqCount} 台</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.btnSm} onClick={() => openEdit(room)}>编辑</button>
                        <button
                          className={styles.btnSm}
                          onClick={() => handleToggleStatus(room)}
                        >
                          {room.status === 'active' ? '停用' : '启用'}
                        </button>
                        <button
                          className={`${styles.btnSm} ${styles.btnDanger}`}
                          onClick={() => handleDelete(room)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingId ? '编辑会议室' : '新增会议室'}</h3>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>×</button>
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>会议室名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：3F-长江"
                  maxLength={100}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>楼层 *</label>
                  <select value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}>
                    <option value="">请选择</option>
                    {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>楼栋</label>
                  <select value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))}>
                    {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>容量（人数）*</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                    min={1}
                    max={500}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>类型</label>
                  <select value={form.room_type} onChange={e => setForm(f => ({ ...f, room_type: e.target.value as RoomType }))}>
                    <option value="small">小（≤6人）</option>
                    <option value="medium">中（7-20人）</option>
                    <option value="large">大（{'>'}20人）</option>
                  </select>
                </div>
              </div>

              {editingId && (
                <div className={styles.formGroup}>
                  <label>状态</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as RoomStatus }))}>
                    <option value="active">可用</option>
                    <option value="inactive">已停用</option>
                    <option value="maintenance">维护中</option>
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>位置描述</label>
                <input
                  type="text"
                  value={form.location_desc}
                  onChange={e => setForm(f => ({ ...f, location_desc: e.target.value }))}
                  placeholder="如：3楼东侧走廊尽头"
                  maxLength={200}
                />
              </div>

              {editingId && (
                <div className={styles.formGroup}>
                  <label>设备绑定（从设备清单中选择）</label>
                  <div className={styles.equipList}>
                    {roomEquipment.length === 0 ? (
                      <p className={styles.noEquip}>暂无设备，请先在设备管理中录入</p>
                    ) : (
                      roomEquipment.map(eq => {
                        const checked = form.equipment_ids.includes(eq.id);
                        return (
                          <label key={eq.id} className={`${styles.equipItem} ${checked ? styles.equipChecked : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEquipment(eq.id)}
                            />
                            <span>{eq.name}</span>
                            <span className={styles.equipType}>
                              {EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}
                            </span>
                            <span
                              className={styles.equipStatus}
                              style={{
                                color: eq.status === 'available' ? '#10b981' : eq.status === 'faulty' ? '#ef4444' : '#f59e0b',
                              }}
                            >
                              {eq.status === 'available' ? '可用' : eq.status === 'faulty' ? '故障' : '维修中'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModalOpen(false)}>取消</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
