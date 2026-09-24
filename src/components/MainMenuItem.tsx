import { memo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import type { MainMenuItem as Item } from '../data/menuData';
import { Icon } from './icons';

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
};

const PRESS_SPRING = { type: 'spring', stiffness: 620, damping: 26, mass: 0.6 } as const;

function MainMenuItemBase({ item, x, y, size, isActive, counterRotate, onKeyboardActivate }: Props) {
  return (
    <motion.button
      type="button"
      className={`orb orb--item tone-${item.tone}${isActive ? ' is-active' : ''}`}
      data-role="main-item"
      data-item-id={item.id}
      aria-label={item.label}
      aria-pressed={isActive}
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, rotate: counterRotate }}
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
