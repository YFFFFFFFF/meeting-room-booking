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
          if (refreshData.code === 0 && refreshData.data?.access_token) {
            localStorage.setItem('auth_tokens', JSON.stringify(refreshData.data));
            // 重试原请求
            reqHeaders['Authorization'] = `Bearer ${refreshData.data.access_token}`;
            const retryRes = await fetch(url, { ...config, headers: reqHeaders });
            if (retryRes.status === 401) {
              // 刷新后的 token 仍然 401，清除并跳转
              localStorage.removeItem('auth_tokens');
              window.location.href = '/login';
              throw new Error('登录已过期，请重新登录');
            }
            return retryRes.json();
          }
        }
      } catch {
        // 刷新请求本身失败（网络错误等），继续走下面的 401 处理
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

// ---- 文件上传 ----
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {};
  if (tokens?.access_token) {
    headers['Authorization'] = `Bearer ${tokens.access_token}`;
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json();
      throw err;
    }
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

// ---- 文件下载 ----
async function downloadFile(path: string, filename?: string): Promise<void> {
  const tokens = getTokens();
  const headers: Record<string, string> = {};
  if (tokens?.access_token) {
    headers['Authorization'] = `Bearer ${tokens.access_token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  upload: <T>(path: string, file: File) =>
    uploadFile<T>(path, file),

  download: (path: string, filename?: string) =>
    downloadFile(path, filename),
};
