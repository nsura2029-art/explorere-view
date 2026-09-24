import type { IconName } from '../components/icons';

export type Tone = 'blue' | 'purple' | 'magenta';

export type SubMenuItem = { id: string; label: string; icon: IconName; tone: Tone };

export type MainMenuItem = {
  id: string;
  label: string;
  icon: IconName;
  tone: Tone;
  subItems: SubMenuItem[];
};

const SUB_TEMPLATE: Array<{ icon: IconName; tone: Tone }> = [
  { icon: 'search', tone: 'blue' },
  { icon: 'document', tone: 'purple' },
  { icon: 'users', tone: 'magenta' },
  { icon: 'link', tone: 'blue' },
  { icon: 'pie', tone: 'magenta' },
];

const MAIN_TEMPLATE: Array<{ icon: IconName; tone: Tone }> = [
  { icon: 'home', tone: 'blue' },
  { icon: 'user', tone: 'purple' },
  { icon: 'gear', tone: 'magenta' },
  { icon: 'chart', tone: 'blue' },
  { icon: 'star', tone: 'purple' },
  { icon: 'heart', tone: 'magenta' },
  { icon: 'folder', tone: 'blue' },
  { icon: 'grid', tone: 'purple' },
];

export const MAIN_MENU_ITEMS: MainMenuItem[] = MAIN_TEMPLATE.map((m, i) => {
  const id = `item-${i + 1}`;
  return {
    id,
    label: `Item ${i + 1}`,
    icon: m.icon,
    tone: m.tone,
    subItems: SUB_TEMPLATE.map((s, j) => ({
      id: `${id}-sub-${j + 1}`,
      label: `SubItem ${j + 1}`,
      icon: s.icon,
      tone: s.tone,
    })),
  };
});

/** SVG-friendly color per tone (connectors, dots). */
export const TONE_COLORS: Record<Tone, { core: string; soft: string }> = {
  blue: { core: '#3d82ff', soft: '#7fb3ff' },
  purple: { core: '#9058ff', soft: '#c4a2ff' },
  magenta: { core: '#ff38c0', soft: '#ff9ade' },
};
