import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import RootErrorBoundary from './components/RootErrorBoundary.tsx'

// 최상위 경계가 없으면 렌더 중 오류 하나에 트리 전체가 사라져 백지화면이 된다.
// 최소한 무슨 일이 났는지 보이고 다시 시도할 수단은 남긴다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
