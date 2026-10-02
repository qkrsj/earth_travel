import { useCallback, useEffect, useRef, useState } from 'react';
import { visitColor } from '../../lib/colors';
import type { GlobeOutMessage, GlobeViewProps } from './types';

/** WebView / iframe 공통: 지구본 페이지와 메시지를 주고받는 로직 */
export function useGlobeBridge(props: GlobeViewProps, post: (msg: object) => void) {
  const { visits, selectedCode, onSelect, onDeselect } = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFromGlobe = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const colors: Record<string, string> = {};
    for (const [code, count] of Object.entries(visits)) {
      const c = visitColor(count);
      if (c) colors[code] = c;
    }
    post({ type: 'visits', visits, colors });
  }, [ready, visits, post]);

  useEffect(() => {
    if (!ready) return;
    // 지구본에서 직접 고른 경우에는 다시 보내지 않음 (카메라 이동 중복 방지)
    if (selectedCode === lastFromGlobe.current) return;
    lastFromGlobe.current = selectedCode;
    post(selectedCode ? { type: 'select', code: selectedCode } : { type: 'deselect' });
  }, [ready, selectedCode, post]);

  const handleMessage = useCallback((raw: string) => {
    let msg: GlobeOutMessage;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case 'ready': setReady(true); setError(null); break;
      case 'error': setError(msg.message); break;
      case 'select':
        lastFromGlobe.current = msg.code;
        onSelect({ code: msg.code, name: msg.name, nameKo: msg.nameKo });
        break;
      case 'deselect':
        lastFromGlobe.current = null;
        onDeselect();
        break;
    }
  }, [onSelect, onDeselect]);

  return { ready, error, handleMessage };
}
