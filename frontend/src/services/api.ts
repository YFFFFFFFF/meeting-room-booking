// ============================================================
// API 服务层 — 统一请求封装 + Token 自动注入
// ============================================================

const BASE_URL = '/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | string[]>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

function getTokens(): { access_token?: string } | null {
  try {
    const stored = localStorage.getItem('auth_tokens');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {}, skipAuth = false } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const tokens = getTokens();
    if (tokens?.access_token) {
      reqHeaders['Authorization'] = `Bearer ${tokens.access_token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers: reqHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(url, config);

  // Token 过期 → 尝试刷新
  if (res.status === 401 && !skipAuth) {
    const tokens = getTokens();
    if (tokens?.access_token) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.code === 0) {
            localStorage.setItem('auth_tokens', JSON.stringify(refreshData.data));
            // 重试原请求
            reqHeaders['Authorization'] = `Bearer ${refreshData.data.access_token}`;
            const retryRes = await fetch(url, { ...config, headers: reqHeaders });
            return retryRes.json();
          }
        }
      } catch {
        // 刷新失败，继续抛出 401
      }
    }
    localStorage.removeItem('auth_tokens');
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.ok) {
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json();
      throw err;
    }
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }

  return res as unknown as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | string[]>) =>
    request<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
