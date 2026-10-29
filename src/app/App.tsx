import { Suspense, lazy } from 'react';
import { FROG_MODEL_URL, FROG_POSTER_URL } from '../config';

// 3D 引擎体积较大，按需要懒加载：HTML 首屏与海报先显示，
// 模型场景在 chunk 加载完成后再初始化。
const FrogViewer = lazy(() =>
  import('../components/viewer/FrogViewer').then((module) => ({ default: module.FrogViewer })),
);

function ViewerFallback() {
  return (
    <div className="viewer viewer--skeleton" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-card__spinner" aria-hidden="true" />
        <p className="loading-card__text">正在加载 3D 查看器…</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <p className="app__eyebrow">手作布艺 · 绿蛙先生</p>
        <h1 className="app__title">丑萌青蛙挂件</h1>
        <p className="app__subtitle">
          棉麻身体、牛仔背带裤与一点点不规则的手作感。拖动查看，或点一点它的眼睛。
        </p>
      </header>

      <main className="app__stage">
        <Suspense fallback={<ViewerFallback />}>
          <FrogViewer modelUrl={FROG_MODEL_URL} posterUrl={FROG_POSTER_URL} quality="auto" autoRotate />
        </Suspense>
      </main>

      <footer className="app__footer">
        <span>基于单张实拍图重建的三维模型</span>
      </footer>
    </div>
  );
}
