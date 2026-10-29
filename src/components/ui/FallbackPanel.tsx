export function FallbackPanel({
  posterUrl,
  title = '暂时无法显示 3D 内容',
  description = '你的浏览器或设备可能不支持 WebGL。可以先查看下面的实拍图片。',
  onRetry,
}: {
  posterUrl?: string | undefined;
  title?: string;
  description?: string;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div className="overlay overlay--fallback" role="alert">
      <div className="fallback-card">
        {posterUrl && (
          <img className="fallback-card__image" src={posterUrl} alt="布艺青蛙挂件实拍图" />
        )}
        <h2 className="fallback-card__title">{title}</h2>
        <p className="fallback-card__text">{description}</p>
        {onRetry && (
          <button type="button" className="button button--primary" onClick={onRetry}>
            重新加载
          </button>
        )}
      </div>
    </div>
  );
}
