import { useCallback, useEffect, useState } from 'react';

/**
 * 空闲状态管理：记录最后一次用户交互时间。
 * 用户操作期间立即停止自动旋转与待机动画，闲置一段时间后再恢复。
 */
export interface IdleActivity {
  /** 当前是否处于空闲（可播放待机动画） */
  isIdle: boolean;
  /** 最后一次交互的时间戳 */
  lastInteraction: number;
  /** 手动通知发生了交互 */
  notifyInteraction: () => void;
}

export function useIdleActivity(idleDelayMs = 2600): IdleActivity {
  const [lastInteraction, setLastInteraction] = useState(() => Date.now());
  const [isIdle, setIsIdle] = useState(false);

  const notifyInteraction = useCallback(() => {
    setLastInteraction(Date.now());
    setIsIdle(false);
  }, []);

  useEffect(() => {
    const evaluate = () => {
      const now = Date.now();
      setIsIdle(now - lastInteraction >= idleDelayMs);
    };

    const interval = window.setInterval(evaluate, 400);
    evaluate();

    return () => window.clearInterval(interval);
  }, [idleDelayMs, lastInteraction]);

  return { isIdle, lastInteraction, notifyInteraction };
}
