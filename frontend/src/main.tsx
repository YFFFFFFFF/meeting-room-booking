import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// MSW Mock Server — 通过环境变量 VITE_USE_MOCK=true 启用
// 联调时设置 VITE_USE_MOCK=false 让请求走真实后端
async function enableMockServer() {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  if (import.meta.env.DEV && useMock) {
    const { worker } = await import('./mock/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    })
    console.log('[MSW] Mock Server 已启动 — 覆盖后端API + 企微API')
  } else {
    console.log('[API] 直连后端 API — http://localhost:8080')
  }
}

enableMockServer().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
