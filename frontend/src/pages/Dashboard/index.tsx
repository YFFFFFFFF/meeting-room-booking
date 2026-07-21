// ============================================================
// 数据看板页面 — 实时利用率 / 趋势图 / 楼层统计 / 热门排行
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { api } from '../../services/api';
import type { DashboardData, UtilizationReport, ApiResponse } from '../../types';
import styles from './index.module.css';

// 色板
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [report, setReport] = useState<UtilizationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, utilRes] = await Promise.all([
        api.get<ApiResponse<DashboardData>>('/stats/dashboard'),
        api.get<ApiResponse<UtilizationReport[]>>('/stats/utilization'),
      ]);
      if (dashRes.code === 0) setDashboard(dashRes.data);
      if (utilRes.code === 0) setReport(utilRes.data);
    } catch {
      setError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExport() {
    setExporting(true);
    try {
      await api.download('/stats/export', `数据报表_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skelTitle} />
              <div className={styles.skelValue} />
              <div className={styles.skelSub} />
            </div>
          ))}
        </div>
        <div className={styles.skeletonChart} />
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={fetchData}>重试</button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const utilPercent = dashboard.current_utilization.toFixed(1);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>📊 数据看板</h2>
          <p className={styles.subtitle}>会议室利用率与预约趋势分析</p>
        </div>
        <button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
          {exporting ? '⏳ 导出中...' : '📥 导出报表'}
        </button>
      </div>

      {/* 概览卡片 */}
      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: '#eef2ff', color: '#4f46e5' }}>🏢</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>会议室总数</div>
            <div className={styles.cardValue}>{dashboard.total_rooms}</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: '#fef3c7', color: '#f59e0b' }}>📅</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>今日预约</div>
            <div className={styles.cardValue}>{dashboard.today_bookings}</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: '#d1fae5', color: '#10b981' }}>✅</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>空闲中</div>
            <div className={styles.cardValue}>{dashboard.free_rooms}</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: '#fce7f3', color: '#ec4899' }}>📈</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>当前利用率</div>
            <div className={styles.cardValue}>{utilPercent}%</div>
            <div className={styles.utilBar}>
              <div className={styles.utilFill} style={{ width: `${utilPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 图表区 */}
      <div className={styles.chartRow}>
        {/* 楼层利用率柱状图 */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>各楼层利用率</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dashboard.floor_stats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="floor" tick={{ fontSize: 13, fill: '#6b7280' }} />
              <YAxis unit="%" tick={{ fontSize: 12, fill: '#9ca3af' }} domain={[0, 100]} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, '利用率']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
              />
              <Bar dataKey="utilization" name="利用率" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {dashboard.floor_stats.map((_, i) => (
                  <rect key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 预约趋势折线图 */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>近7天预约趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dashboard.trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#6b7280' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 12, fill: '#9ca3af' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="bookings" name="预约数" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="utilization" name="利用率" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 热门会议室排行 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>🔥 热门会议室 Top 5</h3>
        <div className={styles.rankList}>
          {dashboard.top_rooms.map((room, i) => (
            <div key={room.room_id} className={styles.rankItem}>
              <div className={styles.rankBadge} style={{ background: i < 3 ? COLORS[i] : '#9ca3af' }}>
                {i + 1}
              </div>
              <div className={styles.rankInfo}>
                <div className={styles.rankName}>{room.room_name}</div>
                <div className={styles.rankFloor}>{room.floor}</div>
              </div>
              <div className={styles.rankStats}>
                <span className={styles.rankCount}>{room.booking_count} 次预约</span>
                <span className={styles.rankRate}>{room.utilization_rate}%</span>
              </div>
              <div className={styles.rankBar}>
                <div className={styles.rankFill} style={{ width: `${room.utilization_rate}%`, background: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 详细报表 */}
      {report.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>📋 利用率明细表</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>会议室</th>
                  <th>利用率</th>
                  <th>总预约</th>
                  <th>取消</th>
                  <th>平均时长</th>
                </tr>
              </thead>
              <tbody>
                {[...report]
                  .sort((a, b) => b.utilization_rate - a.utilization_rate)
                  .map((r, i) => (
                    <tr key={r.room_id}>
                      <td className={styles.rankCell}>{i + 1}</td>
                      <td className={styles.roomCell}>{r.room_name}</td>
                      <td>
                        <div className={styles.utilCell}>
                          <div className={styles.utilBarSmall}>
                            <div className={styles.utilFillSmall} style={{ width: `${r.utilization_rate}%` }} />
                          </div>
                          <span>{r.utilization_rate}%</span>
                        </div>
                      </td>
                      <td>{r.total_bookings}</td>
                      <td>{r.cancelled_bookings}</td>
                      <td>{r.avg_duration_minutes} 分钟</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
