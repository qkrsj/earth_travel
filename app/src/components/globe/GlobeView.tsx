import { useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_URL } from '../../lib/api';
import { theme } from '../../lib/colors';
import type { GlobeViewProps } from './types';
import { useGlobeBridge } from './useGlobeBridge';

/** iOS / Android: 서버의 /globe/ 페이지를 WebView 로 띄움 (three.js + WebGL) */
export default function GlobeView(props: GlobeViewProps) {
  const ref = useRef<WebView>(null);
  const post = useCallback((msg: object) => ref.current?.postMessage(JSON.stringify(msg)), []);
  const { ready, error, handleMessage } = useGlobeBridge(props, post);

  return (
    <View style={styles.fill}>
      <WebView
        ref={ref}
        source={{ uri: `${API_URL}/globe/` }}
        style={styles.web}
        onMessage={(e) => handleMessage(e.nativeEvent.data)}
        originWhitelist={[API_URL]}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
      {!ready && (
        <View style={styles.overlay} pointerEvents="none">
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={theme.textDim} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  error: { color: theme.danger, padding: 24, textAlign: 'center' },
});
