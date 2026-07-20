// ============================================================
// 参会人选择器组件 (AttendeePicker)
// 支持搜索企微通讯录、多选、展示已选用户
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import styles from './AttendeePicker.module.css';

interface AttendeePickerProps {
  selected: User[];
  onChange: (users: User[]) => void;
  placeholder?: string;
  maxCount?: number;
}

export default function AttendeePicker({
  selected,
  onChange,
  placeholder = '搜索参会人...',
  maxCount = 50,
}: AttendeePickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 搜索用户
  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get<{ code: number; data: User[] }>('/users/search', { q });
      if (res.code === 0) {
        // 过滤已选用户
        const filtered = res.data.filter(
          u => !selected.some(s => s.id === u.id)
        );
        setResults(filtered);
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selected]);

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchUsers]);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addUser(user: User) {
    if (selected.length >= maxCount) return;
    if (selected.some(s => s.id === user.id)) return;
    onChange([...selected, user]);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeUser(userId: string) {
    onChange(selected.filter(s => s.id !== userId));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      addUser(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const roleLabels: Record<string, string> = {
    employee: '员工',
    admin: '管理员',
    it_admin: 'IT运维',
    super_admin: '超管',
  };

  return (
    <div className={styles.picker}>
      <div className={styles.selectedList}>
        {selected.map(user => (
          <span key={user.id} className={styles.chip}>
            <span className={styles.chipAvatar}>
              {user.name.charAt(0)}
            </span>
            {user.name}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => removeUser(user.id)}
              aria-label={`移除 ${user.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={selected.length > 0 ? '继续添加参会人...' : placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isSearching && <span className={styles.spinner}>⏳</span>}
      </div>

      {isOpen && (results.length > 0 || query.trim()) && (
        <div ref={dropdownRef} className={styles.dropdown}>
          {results.length === 0 && query.trim() ? (
            <div className={styles.empty}>未找到匹配用户</div>
          ) : (
            results.map((user, idx) => (
              <div
                key={user.id}
                className={`${styles.option} ${idx === activeIndex ? styles.active : ''}`}
                onClick={() => addUser(user)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <span className={styles.avatar}>{user.name.charAt(0)}</span>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userDept}>
                    {user.department} · {roleLabels[user.role] || user.role}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
