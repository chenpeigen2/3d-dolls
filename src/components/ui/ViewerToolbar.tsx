export function ViewerToolbar({
  onReset,
  onToggleHelp,
  showHelp,
}: {
  onReset: () => void;
  onToggleHelp: () => void;
  showHelp: boolean;
}) {
  return (
    <div className="toolbar">
      <button type="button" className="button" onClick={onReset} aria-label="复位视角">
        <span aria-hidden="true">⟲</span>
        <span className="button__label">复位</span>
      </button>
      <button
        type="button"
        className="button"
        onClick={onToggleHelp}
        aria-expanded={showHelp}
        aria-label="查看操作说明"
      >
        <span aria-hidden="true">?</span>
        <span className="button__label">操作说明</span>
      </button>
    </div>
  );
}
