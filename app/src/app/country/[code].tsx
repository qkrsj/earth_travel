import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import CountryMap from '../../components/CountryMap';
import { Button, Card, ErrorText, Field, Loading, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CITY_COLORS, flagEmoji, theme } from '../../lib/colors';
import { useAsync } from '../../lib/useAsync';
import type { City } from '../../lib/types';

export default function CountryScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode).toUpperCase();
  const { user } = useAuth();

  const base = useAsync(async () => {
    const [shape, { cities }] = await Promise.all([api.countryShape(code), api.cities(code)]);
    return { shape, cities };
  }, [code]);

  const [visited, setVisited] = useState<Map<number, string>>(new Map());
  const [selected, setSelected] = useState<City | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!user) { setVisited(new Map()); return; }
    api.myCities(code)
      .then((r) => setVisited(new Map(r.visits.map((v) => [v.cityId, v.color]))))
      .catch((e) => setError(e.message));
  }, [code, user]));

  const props = base.data?.shape.features[0]?.properties;
  const cities = base.data?.cities ?? [];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities;
    // 방문한 도시를 위로
    return [...filtered].sort((a, b) => Number(visited.has(b.id)) - Number(visited.has(a.id)));
  }, [cities, query, visited]);

  async function setColor(city: City, color: string | null) {
    if (!user) { router.push('/login'); return; }
    setBusy(true);
    setError(null);
    try {
      if (color) await api.setCityColor(city.id, color);
      else await api.unvisitCity(city.id);
      setVisited((prev) => {
        const next = new Map(prev);
        if (color) next.set(city.id, color); else next.delete(city.id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <View style={ui.center}><ErrorText>{base.error}</ErrorText></View>;

  const selectedColor = selected ? visited.get(selected.id) : undefined;

  const header = (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={ui.title}>{flagEmoji(code)} {props?.nameKo ?? code}</Text>
        <Text style={ui.dim}>방문한 도시 {visited.size} / {cities.length} · 도시를 눌러 색을 칠해보세요</Text>
      </View>

      <CountryMap
        shape={base.data.shape}
        cities={cities}
        visited={visited}
        selectedCityId={selected?.id ?? null}
        onSelectCity={setSelected}
      />

      {selected && (
        <Card style={{ gap: 12 }}>
          <View style={ui.sectionRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.section}>{selected.name}</Text>
              <Text style={ui.dim}>인구 {selected.population.toLocaleString()}명</Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={12}><Text style={ui.dim}>✕</Text></Pressable>
          </View>
          <Text style={ui.label}>{selectedColor ? '도시 색 바꾸기' : '방문했다면 색을 골라 체크하세요'}</Text>
          <View style={s.palette}>
            {CITY_COLORS.map((c) => (
              <Pressable
                key={c}
                disabled={busy}
                onPress={() => setColor(selected, c)}
                style={[s.swatch, { backgroundColor: c }, selectedColor === c && s.swatchActive]}
              />
            ))}
          </View>
          {error && <ErrorText>{error}</ErrorText>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button style={{ flex: 1 }} title="여행 기록 보기 · 쓰기" onPress={() => router.push(`/city/${selected.id}`)} />
            {selectedColor && (
              <Button variant="ghost" title="방문 취소" disabled={busy} onPress={() => setColor(selected, null)} />
            )}
          </View>
        </Card>
      )}

      <Field placeholder="도시 검색" value={query} onChangeText={setQuery} autoCorrect={false} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: props?.nameKo ?? code }} />
      <FlatList
        style={ui.screen}
        contentContainerStyle={[ui.content, { paddingBottom: 48 }]}
        ListHeaderComponent={header}
        data={list}
        keyExtractor={(c) => String(c.id)}
        initialNumToRender={30}
        renderItem={({ item }) => {
          const color = visited.get(item.id);
          return (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [s.row, item.id === selected?.id && s.rowActive, pressed && { opacity: 0.8 }]}
            >
              <View style={[s.rowDot, { backgroundColor: color ?? 'transparent', borderColor: color ?? theme.textDim }]} />
              <Text style={[s.rowName, color && { fontWeight: '700' }]}>{item.name}</Text>
              <Text style={ui.dim}>{color ? '방문' : ''}</Text>
            </Pressable>
          );
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff', transform: [{ scale: 1.12 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  rowActive: { backgroundColor: theme.surfaceAlt },
  rowDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  rowName: { color: theme.text, fontSize: 15, flex: 1 },
});
