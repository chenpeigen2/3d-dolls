export function LoadingOverlay({ progress, message }: { progress?: number | undefined; message?: string | undefined }) {
  const percent = typeof progress === 'number' ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : null;

  return (
    <div className="overlay overlay--loading" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-card__spinner" aria-hidden="true" />
        <p className="loading-card__text">{message ?? '正在准备 3D 场景…'}</p>
        {percent !== null && (
          <div className="loading-card__progress" aria-hidden="true">
            <div className="loading-card__bar" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
