// ============================================================
// 首页 — 会议室列表 + 时间轴视图（占位，T4.2 完整实现）
// ============================================================

import { useAuthStore } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🏢 会议室预约管理系统</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
            欢迎，{user?.name}（{user?.department}）
          </p>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            padding: '8px 20px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: 'white',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          退出登录
        </button>
      </div>

      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 60,
        textAlign: 'center',
        border: '2px dashed #e5e7eb',
      }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>📅</p>
        <h2 style={{ margin: '0 0 8px', color: '#374151' }}>首页时间轴视图</h2>
        <p style={{ color: '#9ca3af', margin: 0 }}>
          将在 T4.2 实现 — 会议室列表 + 时间轴 + 快速预约入口
        </p>
      </div>
    </div>
  );
}
