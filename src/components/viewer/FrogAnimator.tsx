import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { damp, easeOutBack, pulseProgress, stepSpring, swingAngle, type SpringState } from '../../lib/animation';
import { useFrogController, useFrogRig } from './rig';

export interface FrogAnimatorProps {
  /** 用户是否正在操作（用于暂停自动旋转） */
  idle: boolean;
  /** 是否尊重系统的减少动态效果设置 */
  reducedMotion: boolean;
}

interface Trigger {
  /** 触发时刻（秒），-1 表示未触发 */
  startedAt: number;
}

const BLINK_DURATION = 0.42;
const SQUISH_DURATION = 0.55;
const BOUNCE_DURATION = 0.6;
const IDLE_ROTATION_SPEED = 0.32;

/**
 * 娃娃动画执行器。
 *
 * 所有动画基于 useFrame 的 delta 推进，与帧率解耦；
 * 形变直接作用于节点 scale/rotation，避免触发 React 重渲染。
 */
export function FrogAnimator({ idle, reducedMotion }: FrogAnimatorProps) {
  const rig = useFrogRig();
  const controller = useFrogController();

  const blink = useRef<Trigger>({ startedAt: -1 });
  const squish = useRef<Trigger>({ startedAt: -1 });
  const bowBounce = useRef<Trigger>({ startedAt: -1 });
  const pantsBounce = useRef<Trigger>({ startedAt: -1 });

  const spring = useRef<SpringState>({ value: 0, velocity: 0 });
  const clock = useRef(0);
  const idleRotation = useRef(0);
  const nextAutoBlink = useRef(3.5);

  const baseScales = useRef(new WeakMap<THREE.Object3D, THREE.Vector3>());

  const rememberScale = useCallback((object: THREE.Object3D | null) => {
    if (!object) return;
    if (!baseScales.current.has(object)) {
      baseScales.current.set(object, object.scale.clone());
    }
  }, []);

  const applyScale = useCallback(
    (object: THREE.Object3D | null, x: number, y: number, z: number) => {
      if (!object) return;
      const base = baseScales.current.get(object) ?? object.scale.clone();
      baseScales.current.set(object, base);
      object.scale.set(base.x * x, base.y * y, base.z * z);
    },
    [],
  );

  useEffect(() => {
    controller.blink = () => {
      blink.current.startedAt = clock.current;
    };
    controller.squish = () => {
      squish.current.startedAt = clock.current;
      spring.current.value = 0;
      spring.current.velocity = 0;
    };
    controller.bounce = (part) => {
      if (part === 'bowTie') bowBounce.current.startedAt = clock.current;
      if (part === 'pants') pantsBounce.current.startedAt = clock.current;
    };
    controller.reset = () => {
      blink.current.startedAt = -1;
      squish.current.startedAt = -1;
      bowBounce.current.startedAt = -1;
      pantsBounce.current.startedAt = -1;
      spring.current = { value: 0, velocity: 0 };
      idleRotation.current = 0;
      const root = rig.current.root;
      if (root) {
        root.rotation.y = 0;
        root.rotation.x = 0;
        root.rotation.z = 0;
      }
    };
    controller.setIdle = () => {
      /* 空闲状态由 props 传入，此处保留接口以便扩展 */
    };
  }, [controller, rig]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 1 / 20);
    clock.current += step;

    const parts = rig.current;
    rememberScale(parts.body);
    rememberScale(parts.bowTie);
    rememberScale(parts.pants);
    rememberScale(parts.eyes.L);
    rememberScale(parts.eyes.R);

    // 1. 闲置自动旋转：仅在空闲且未开启减少动态效果时运行
    if (idle && !reducedMotion && parts.root) {
      idleRotation.current += step * IDLE_ROTATION_SPEED;
      parts.root.rotation.y = idleRotation.current;
    }

    // 2. 悬挂摆动：绕顶部悬挂点做小角度衰减摆动
    if (parts.suspensionPivot) {
      const target = reducedMotion ? 0 : swingAngle(clock.current, 0.035, 3.8);
      parts.suspensionPivot.rotation.z = damp(parts.suspensionPivot.rotation.z, target, 3, step);
      parts.suspensionPivot.rotation.x = damp(
        parts.suspensionPivot.rotation.x,
        reducedMotion ? 0 : swingAngle(clock.current + 1.2, 0.022, 4.6),
        3,
        step,
      );
    }

    // 3. 眨眼：自动眨眼 + 手动触发
    if (!reducedMotion && clock.current > nextAutoBlink.current) {
      nextAutoBlink.current = clock.current + 3.5 + Math.random() * 3;
      blink.current.startedAt = clock.current;
    }

    const blinkElapsed = clock.current - blink.current.startedAt;
    const blinkAmount =
      blink.current.startedAt < 0 ? 0 : pulseProgress(blinkElapsed, BLINK_DURATION);
    if (blink.current.startedAt >= 0 && blinkElapsed > BLINK_DURATION) {
      blink.current.startedAt = -1;
    }

    for (const eye of [parts.eyes.L, parts.eyes.R]) {
      if (!eye) continue;
      const lidScale = 1 - blinkAmount * 0.86;
      applyScale(eye, 1, lidScale, 1);
    }

    // 4. 身体挤压回弹：弹簧模型，位移小且回弹柔和
    const squishElapsed = clock.current - squish.current.startedAt;
    const squishActive = squish.current.startedAt >= 0 && squishElapsed < SQUISH_DURATION;
    if (squishActive) {
      stepSpring(spring.current, 0, step, 210, 15);
    } else {
      spring.current.value = damp(spring.current.value, 0, 12, step);
      spring.current.velocity = damp(spring.current.velocity, 0, 12, step);
    }
    const squeeze = spring.current.value;
    applyScale(parts.body, 1 + squeeze * 0.1, 1 - squeeze * 0.14, 1 + squeeze * 0.1);

    // 5. 服饰弹跳：使用带回弹的缓动
    const bowElapsed = clock.current - bowBounce.current.startedAt;
    if (bowBounce.current.startedAt >= 0 && bowElapsed > BOUNCE_DURATION) {
      bowBounce.current.startedAt = -1;
    }
    const bowProgress =
      bowBounce.current.startedAt < 0 ? 0 : easeOutBack(Math.min(bowElapsed / BOUNCE_DURATION, 1));
    if (parts.bowTie) {
      parts.bowTie.position.y = parts.bowTie.userData.baseY ?? (parts.bowTie.userData.baseY = parts.bowTie.position.y);
      parts.bowTie.position.y += bowProgress * 0.035;
      applyScale(parts.bowTie, 1 + bowProgress * 0.08, 1 + bowProgress * 0.08, 1);
    }

    const pantsElapsed = clock.current - pantsBounce.current.startedAt;
    if (pantsBounce.current.startedAt >= 0 && pantsElapsed > BOUNCE_DURATION) {
      pantsBounce.current.startedAt = -1;
    }
    const pantsProgress =
      pantsBounce.current.startedAt < 0 ? 0 : easeOutBack(Math.min(pantsElapsed / BOUNCE_DURATION, 1));
    if (parts.pants) {
      applyScale(parts.pants, 1 + pantsProgress * 0.05, 1 - pantsProgress * 0.06, 1 + pantsProgress * 0.05);
    }
  });

  return null;
}

/** 供外部读取动画状态（调试用）。 */
export function useAnimationClock(): { current: number } {
  const clock = useMemo(() => ({ current: 0 }), []);
  return clock;
}
