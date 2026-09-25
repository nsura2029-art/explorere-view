import { memo } from 'react';
import { motion, type MotionValue, type Transition } from 'framer-motion';
import type { MainMenuItem as Item } from '../data/menuData';
import { DEMO_BACK_MS, DEMO_OUT_MS, DEMO_SCALE } from '../utils/attractDemo';
import { Icon } from './icons';

/** Idle demo pulse for one item: offset (straight away from the menu center) and phase. */
export type ItemPulse = { id: string; dx: number; dy: number; out: boolean };

type Props = {
  item: Item;
  /** Center of the node in stage coordinates. */
  x: number;
  y: number;
  size: number;
  isActive: boolean;
  /** Cancels the ring's rotation so icon and label stay upright. */
  counterRotate: MotionValue<number>;
  /** Keyboard (Enter/Space) activation; pointer taps are recognized by the parent menu. */
  onKeyboardActivate: (itemId: string) => void;
  /** Set only on the item the idle demo is pulsing. */
  pulse: ItemPulse | null;
  onPulseSettled: (itemId: string, out: boolean) => void;
};

const PRESS_SPRING = { type: 'spring', stiffness: 620, damping: 26, mass: 0.6 } as const;
const PULSE_OUT: Transition = { duration: DEMO_OUT_MS / 1000, ease: [0.22, 1, 0.36, 1] };
const PULSE_BACK: Transition = { duration: DEMO_BACK_MS / 1000, ease: 'easeInOut' };

function MainMenuItemBase({
  item,
  x,
  y,
  size,
  isActive,
  counterRotate,
  onKeyboardActivate,
  pulse,
  onPulseSettled,
}: Props) {
  // At rest the offset is exactly 0 and the scale exactly 1: the item's original place and size.
  // (At rest the usual press spring applies, so taps feel as before and an interrupted pulse
  // glides home quickly.)
  const target = pulse
    ? pulse.out
      ? { x: pulse.dx, y: pulse.dy, scale: DEMO_SCALE, transition: PULSE_OUT }
      : { x: 0, y: 0, scale: 1, transition: PULSE_BACK }
    : { x: 0, y: 0, scale: 1 };
  return (
    <motion.button
      type="button"
      className={`orb orb--item tone-${item.tone}${isActive ? ' is-active' : ''}${pulse?.out ? ' is-demo' : ''}`}
      data-role="main-item"
      data-item-id={item.id}
      aria-label={item.label}
      aria-pressed={isActive}
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, rotate: counterRotate }}
      animate={target}
      onAnimationComplete={pulse ? () => onPulseSettled(item.id, pulse.out) : undefined}
      whileTap={{ scale: 0.9 }}
      transition={PRESS_SPRING}
      onClick={(e) => {
        if (e.detail === 0) onKeyboardActivate(item.id);
      }}
    >
      <span className="orb__icon">
        <Icon name={item.icon} size={Math.round(size * 0.26)} />
      </span>
      <span className="orb__label">{item.label}</span>
    </motion.button>
  );
}

export const MainMenuItem = memo(MainMenuItemBase);
