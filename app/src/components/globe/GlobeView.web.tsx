import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../lib/api';
import { theme } from '../../lib/colors';
import type { GlobeViewProps } from './types';
import { useGlobeBridge } from './useGlobeBridge';

const GLOBE_ORIGIN = new URL(API_URL).origin;

/** 웹: 같은 /globe/ 페이지를 iframe 으로 띄우고 postMessage 로 통신 */
export default function GlobeView(props: GlobeViewProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const post = useCallback((msg: object) => {
    ref.current?.contentWindow?.postMessage(JSON.stringify(msg), GLOBE_ORIGIN);
  }, []);
  const { error, handleMessage } = useGlobeBridge(props, post);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.origin !== GLOBE_ORIGIN || e.source !== ref.current?.contentWindow) return;
      if (typeof e.data === 'string') handleMessage(e.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handleMessage]);

  return (
    <View style={styles.fill}>
      <iframe
        ref={ref}
        src={`${API_URL}/globe/`}
        title="globe"
        style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#000' }}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  error: { position: 'absolute', top: 80, alignSelf: 'center', color: theme.danger },
});
