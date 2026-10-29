export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-panel" role="dialog" aria-label="操作说明">
      <div className="help-panel__header">
        <h3 className="help-panel__title">操作说明</h3>
        <button type="button" className="help-panel__close" onClick={onClose} aria-label="关闭操作说明">
          ×
        </button>
      </div>
      <ul className="help-panel__list">
        <li>拖动画面：旋转查看各个角度</li>
        <li>滚轮或双指：放大与缩小</li>
        <li>点击眼睛、身体、蝴蝶结或裤子：触发局部互动</li>
        <li>双击画面或点击「复位」：回到默认视角</li>
      </ul>
    </div>
  );
}
