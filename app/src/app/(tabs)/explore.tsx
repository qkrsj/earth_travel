import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import RecordCard from '../../components/RecordCard';
import { Empty, ErrorText, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { flagEmoji, theme } from '../../lib/colors';
import { useCountryNames } from '../../lib/countryNames';
import type { RecordSummary } from '../../lib/types';

const POPULAR = ['JP', 'KR', 'FR', 'IT', 'ES', 'US', 'TH', 'VN', 'GB', 'TW', 'AU', 'CH'];

/** 공개된 여행 기록 피드 */
export default function ExploreScreen() {
  const names = useCountryNames();
  const [country, setCountry] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (reset: boolean, nextCursor: string | null = null) => {
    setLoading(true);
    try {
      const page = await api.publicRecords({ countryCode: country ?? undefined, cursor: reset ? null : nextCursor, limit: 20 });
      setRecords((prev) => (reset ? page.records : [...prev, ...page.records]));
      setCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [country]);

  useEffect(() => { void load(true); }, [load]);

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={[ui.content, { paddingTop: 8 }]}
      data={records}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <RecordCard record={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.textDim} onRefresh={() => { setRefreshing(true); void load(true); }} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (cursor && !loading) void load(false, cursor); }}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <Text style={ui.dim}>다른 여행자들의 공개 기록을 보고 다음 여행을 계획해보세요</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <Chip label="전체" active={!country} onPress={() => setCountry(null)} />
            {POPULAR.map((code) => (
              <Chip key={code} label={`${flagEmoji(code)} ${names.get(code)?.nameKo ?? code}`} active={country === code} onPress={() => setCountry(code)} />
            ))}
          </ScrollView>
          {error && <ErrorText>{error}</ErrorText>}
        </View>
      }
      ListEmptyComponent={loading ? <ActivityIndicator color={theme.textDim} style={{ marginTop: 32 }} /> : <Empty>아직 공개된 기록이 없어요</Empty>}
      ListFooterComponent={loading && records.length > 0 ? <ActivityIndicator color={theme.textDim} /> : null}
    />
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
});
