/**
 * 动画与插值工具：帧率无关的阻尼、缓动与简单弹性模型。
 * 所有时间推进均使用 Three.js 的 delta（秒），避免高刷新率下速度失真。
 */

/** 帧率无关的指数阻尼插值。lambda 越大收敛越快。 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

/** 阻尼插值的三维版本。 */
export function dampVector3(
  current: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  lambda: number,
  delta: number,
): { x: number; y: number; z: number } {
  const factor = 1 - Math.exp(-lambda * delta);
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
    z: current.z + (target.z - current.z) * factor,
  };
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** 带回弹的缓动，用于轻微弹跳反馈。 */
export function easeOutBack(t: number, overshoot = 1.7): number {
  const c3 = overshoot + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + overshoot * p * p;
}

export interface SpringState {
  value: number;
  velocity: number;
}

/**
 * 简单阻尼弹簧，用于身体挤压回弹这类需要“过冲再回落”的效果。
 */
export function stepSpring(state: SpringState, target: number, delta: number, stiffness = 160, damping = 14): SpringState {
  const step = Math.min(delta, 1 / 30);
  const acceleration = (target - state.value) * stiffness - state.velocity * damping;
  state.velocity += acceleration * step;
  state.value += state.velocity * step;
  return state;
}

/** 计算阻尼摆动的角度（用于悬挂摆动）。 */
export function swingAngle(elapsed: number, amplitude = 0.045, period = 3.4): number {
  return Math.sin((elapsed / period) * Math.PI * 2) * amplitude;
}

/** 生成 0→1→0 的单次脉冲进度，用于眨眼等一次性动作。 */
export function pulseProgress(elapsed: number, duration: number): number {
  if (duration <= 0) return 0;
  const t = elapsed / duration;
  if (t < 0 || t > 1) return 0;
  return Math.sin(t * Math.PI);
}
