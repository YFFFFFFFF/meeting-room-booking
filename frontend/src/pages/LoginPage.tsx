// ============================================================
// 登录页面 — 企微 OAuth Mock 登录
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

// Mock 测试账号
const MOCK_ACCOUNTS = [
  { id: 'zhiniu', name: '执拗', role: '管理员', color: '#6366f1' },
  { id: 'muzirili', name: '木子日立', role: '超级管理员', color: '#8b5cf6' },
  { id: 'zhangsan', name: '张三', role: '员工', color: '#10b981' },
  { id: 'lisi', name: '李四', role: '员工', color: '#f59e0b' },
  { id: 'wangwu', name: '王五', role: '员工', color: '#ef4444' },
  { id: 'it_ops', name: 'IT运维', role: 'IT管理员', color: '#06b6d4' },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();

  async function handleLogin(userId: string) {
    setLoading(true);
    setError('');
    try {
      await login(userId);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🏢</div>
          <h1>会议室预约管理系统</h1>
          <p className={styles.subtitle}>企业微信 OAuth Mock 登录</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.section}>
          <p className={styles.sectionTitle}>选择 Mock 测试账号</p>
          <div className={styles.accountList}>
            {MOCK_ACCOUNTS.map(acc => (
              <button
                key={acc.id}
                className={styles.accountBtn}
                onClick={() => handleLogin(acc.id)}
                disabled={loading}
                style={{ '--accent': acc.color } as React.CSSProperties}
              >
                <span className={styles.accountAvatar} style={{ background: acc.color }}>
                  {acc.name.charAt(0)}
                </span>
                <div className={styles.accountInfo}>
                  <span className={styles.accountName}>{acc.name}</span>
                  <span className={styles.accountRole}>{acc.role}</span>
                </div>
                <span className={styles.accountId}>{acc.id}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <p>模拟企微 OAuth 免登录流程</p>
          <p className={styles.hint}>
            实际环境将通过企微客户端自动获取用户身份，无需手动选择
          </p>
        </div>
      </div>
    </div>
  );
}
