import type { HotspotDefinition } from '../../types/frog';

export function MaterialCard({
  hotspot,
  onClose,
}: {
  hotspot: HotspotDefinition;
  onClose: () => void;
}) {
  return (
    <div className="material-card" role="dialog" aria-label={`${hotspot.label}材质介绍`}>
      <div className="material-card__header">
        <h3 className="material-card__title">{hotspot.label}</h3>
        <button type="button" className="material-card__close" onClick={onClose} aria-label="关闭材质介绍">
          ×
        </button>
      </div>
      <p className="material-card__body">{hotspot.description}</p>
    </div>
  );
}
