// ============================================================
// 企微日程同步页面 — 查看/手动同步日历事件
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import type { WeComCalendarEvent, SyncStatus, ApiResponse } from '../../types';
import styles from './index.module.css';

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; bg: string }> = {
  synced: { label: '已同步', color: '#10b981', bg: '#d1fae5' },
  pending: { label: '待同步', color: '#f59e0b', bg: '#fef3c7' },
  failed: { label: '同步失败', color: '#ef4444', bg: '#fee2e2' },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function WeComSyncPage() {
  const [events, setEvents] = useState<WeComCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; errors?: string[] } | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ApiResponse<WeComCalendarEvent[]>>('/wecom/calendar/events');
      if (res.code === 0) setEvents(res.data);
      else setError(res.message);
    } catch {
      setError('加载日程列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function handleSyncAll() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post<ApiResponse<{ synced: number; failed: number; errors?: string[] }>>('/wecom/calendar/sync');
      if (res.code === 0) {
        setSyncResult(res.data);
        fetchEvents();
      } else {
        setSyncResult({ synced: 0, failed: 1, errors: [res.message] });
      }
    } catch {
      setSyncResult({ synced: 0, failed: 1, errors: ['同步请求失败'] });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncOne(eventId: string) {
    try {
      const res = await api.post<ApiResponse<null>>(`/wecom/calendar/sync/${eventId}`);
      if (res.code === 0) fetchEvents();
    } catch { /* 静默失败 */ }
  }

  const syncedCount = events.filter(e => e.sync_status === 'synced').length;
  const pendingCount = events.filter(e => e.sync_status === 'pending').length;
  const failedCount = events.filter(e => e.sync_status === 'failed').length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>📅 企微日程同步</h2>
          <p className={styles.subtitle}>预约与企微日历双向同步状态监控</p>
        </div>
        <button className={styles.syncBtn} onClick={handleSyncAll} disabled={syncing}>
          {syncing ? '⏳ 同步中...' : '🔄 全部同步'}
        </button>
      </div>

      {/* 同步结果提示 */}
      {syncResult && (
        <div className={`${styles.syncBanner} ${syncResult.failed > 0 ? styles.syncBannerWarn : ''}`}>
          <span>{syncResult.failed === 0 ? '✅' : '⚠️'}</span>
          <div>
            <strong>同步完成：</strong>
            成功 {syncResult.synced} 个
            {syncResult.failed > 0 && <span>，失败 {syncResult.failed} 个</span>}
          </div>
          {syncResult.errors?.map((e, i) => <p key={i} className={styles.syncError}>{e}</p>)}
          <button className={styles.dismiss} onClick={() => setSyncResult(null)}>×</button>
        </div>
      )}

      {/* 统计卡片 */}
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{events.length}</div>
          <div className={styles.statLabel}>总日程数</div>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          <div className={styles.statValue}>{syncedCount}</div>
          <div className={styles.statLabel}>已同步</div>
        </div>
        <div className={`${styles.statCard} ${styles.statYellow}`}>
          <div className={styles.statValue}>{pendingCount}</div>
          <div className={styles.statLabel}>待同步</div>
        </div>
        <div className={`${styles.statCard} ${styles.statRed}`}>
          <div className={styles.statValue}>{failedCount}</div>
          <div className={styles.statLabel}>失败</div>
        </div>
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Loading */}
      {loading ? (
        <div className={styles.loadingWrap}>
          {[1,2,3,4].map(i => (
            <div key={i} className={styles.skelRow}>
              <div /><div /><div /><div />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>📭</p>
          <p>暂无日程同步记录</p>
          <p className={styles.emptyHint}>创建预约后系统将自动尝试同步到企微日历</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日程标题</th>
                <th>时间</th>
                <th>参与人数</th>
                <th>同步状态</th>
                <th>同步时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map(evt => {
                const st = STATUS_CONFIG[evt.sync_status];
                return (
                  <tr key={evt.id}>
                    <td className={styles.titleCell}>{evt.title}</td>
                    <td className={styles.timeCell}>
                      {formatTime(evt.start_time)} — {formatTime(evt.end_time)}
                    </td>
                    <td>{evt.attendees.length} 人</td>
                    <td>
                      <span className={styles.statusBadge} style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td className={styles.timeCell}>
                      {evt.synced_at ? formatTime(evt.synced_at) : '—'}
                    </td>
                    <td>
                      {evt.sync_status === 'pending' && (
                        <button className={styles.syncOneBtn} onClick={() => handleSyncOne(evt.id)}>
                          立即同步
                        </button>
                      )}
                      {evt.sync_status === 'failed' && (
                        <div>
                          <button className={styles.retryBtn} onClick={() => handleSyncOne(evt.id)}>
                            重试
                          </button>
                          {evt.sync_error && (
                            <div className={styles.errorHint}>{evt.sync_error}</div>
                          )}
                        </div>
                      )}
                      {evt.sync_status === 'synced' && (
                        <span className={styles.doneCheck}>✅</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
