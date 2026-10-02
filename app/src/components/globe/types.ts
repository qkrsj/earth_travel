import type { CountryProps } from '../../lib/types';

export interface GlobeViewProps {
  /** 나라 코드 → 방문 횟수 */
  visits: Record<string, number>;
  selectedCode: string | null;
  onSelect: (country: CountryProps) => void;
  onDeselect: () => void;
}

export type GlobeOutMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | ({ type: 'select' } & CountryProps)
  | { type: 'deselect' };
