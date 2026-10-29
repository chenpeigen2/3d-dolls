import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FallbackPanel } from '../../src/components/ui/FallbackPanel';
import { HelpPanel } from '../../src/components/ui/HelpPanel';
import { LoadingOverlay } from '../../src/components/ui/LoadingOverlay';
import { MaterialCard } from '../../src/components/ui/MaterialCard';
import { ViewerToolbar } from '../../src/components/ui/ViewerToolbar';
import { HOTSPOT_BY_ID } from '../../src/types/frog';

describe('LoadingOverlay', () => {
  it('默认展示加载提示', () => {
    render(<LoadingOverlay />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('正在准备 3D 场景…')).toBeInTheDocument();
  });

  it('可以自定义提示文案', () => {
    render(<LoadingOverlay message="模型加载异常，正在显示备用模型…" />);

    expect(screen.getByText('模型加载异常，正在显示备用模型…')).toBeInTheDocument();
  });

  it('有进度时展示进度条且宽度被限制在 0~100%', () => {
    const { rerender } = render(<LoadingOverlay progress={0.42} />);

    const bar = document.querySelector('.loading-card__bar') as HTMLElement;
    expect(bar.style.width).toBe('42%');

    rerender(<LoadingOverlay progress={5} />);
    expect((document.querySelector('.loading-card__bar') as HTMLElement).style.width).toBe('100%');
  });

  it('没有进度时不渲染进度条', () => {
    render(<LoadingOverlay />);

    expect(document.querySelector('.loading-card__bar')).toBeNull();
  });
});

describe('FallbackPanel', () => {
  it('展示海报图片与可理解的说明', () => {
    render(<FallbackPanel posterUrl="images/frog-poster.webp" />);

    expect(screen.getByAltText('布艺青蛙挂件实拍图')).toHaveAttribute(
      'src',
      'images/frog-poster.webp',
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('暂时无法显示 3D 内容')).toBeInTheDocument();
  });

  it('点击重新加载触发回调', async () => {
    const onRetry = vi.fn();
    render(<FallbackPanel onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('不提供回调时不渲染重试按钮', () => {
    render(<FallbackPanel />);

    expect(screen.queryByRole('button', { name: '重新加载' })).toBeNull();
  });
});

describe('MaterialCard', () => {
  it('展示热区名称与材质说明', () => {
    const hotspot = HOTSPOT_BY_ID.bowTie;
    render(<MaterialCard hotspot={hotspot} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: '格纹蝴蝶结材质介绍' })).toBeInTheDocument();
    expect(screen.getByText(hotspot.description)).toBeInTheDocument();
  });

  it('关闭按钮触发回调', async () => {
    const onClose = vi.fn();
    render(<MaterialCard hotspot={HOTSPOT_BY_ID.eye} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: '关闭材质介绍' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ViewerToolbar', () => {
  it('提供带无障碍标签的复位与帮助按钮', () => {
    render(<ViewerToolbar onReset={() => {}} onToggleHelp={() => {}} showHelp={false} />);

    expect(screen.getByRole('button', { name: '复位视角' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看操作说明' })).toBeInTheDocument();
  });

  it('帮助按钮通过 aria-expanded 反映展开状态', () => {
    const { rerender } = render(
      <ViewerToolbar onReset={() => {}} onToggleHelp={() => {}} showHelp={false} />,
    );

    expect(screen.getByRole('button', { name: '查看操作说明' })).toHaveAttribute('aria-expanded', 'false');

    rerender(<ViewerToolbar onReset={() => {}} onToggleHelp={() => {}} showHelp />);
    expect(screen.getByRole('button', { name: '查看操作说明' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('点击按钮触发对应回调', async () => {
    const onReset = vi.fn();
    const onToggleHelp = vi.fn();
    render(<ViewerToolbar onReset={onReset} onToggleHelp={onToggleHelp} showHelp={false} />);

    await userEvent.click(screen.getByRole('button', { name: '复位视角' }));
    await userEvent.click(screen.getByRole('button', { name: '查看操作说明' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });
});

describe('HelpPanel', () => {
  it('列出旋转、缩放、互动与复位说明', () => {
    render(<HelpPanel onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: '操作说明' })).toBeInTheDocument();
    expect(screen.getByText(/拖动画面/)).toBeInTheDocument();
    expect(screen.getByText(/滚轮或双指/)).toBeInTheDocument();
    expect(screen.getByText(/点击眼睛、身体、蝴蝶结或裤子/)).toBeInTheDocument();
    expect(screen.getByText(/复位/)).toBeInTheDocument();
  });

  it('关闭按钮触发回调', async () => {
    const onClose = vi.fn();
    render(<HelpPanel onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: '关闭操作说明' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
