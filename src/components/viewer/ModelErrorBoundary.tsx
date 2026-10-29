import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

/**
 * 错误边界：模型加载或渲染异常时降级为备用内容，
 * 避免整个页面出现空白。
 */
export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[FrogViewer] 模型渲染失败', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
