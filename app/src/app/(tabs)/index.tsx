import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlobeView from '../../components/globe/GlobeView';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { flagEmoji, theme, VISIT_LEVELS, visitColor } from '../../lib/colors';
import type { CountryProps, CountryVisit } from '../../lib/types';

export default function GlobeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [visitList, setVisitList] = useState<CountryVisit[]>([]);
  const [selected, setSelected] = useState<CountryProps | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면에 돌아올 때마다 최신 방문 정보 반영
  useFocusEffect(useCallback(() => {
    if (!user) { setVisitList([]); return; }
    api.myCountries().then((r) => setVisitList(r.countries)).catch((e) => setError(e.message));
  }, [user]));

  const visits = useMemo(() => Object.fromEntries(visitList.map((v) => [v.countryCode, v.visitCount])), [visitList]);
  const totalCities = visitList.reduce((s, v) => s + v.cityCount, 0);
  const current = selected ? visitList.find((v) => v.countryCode === selected.code) : undefined;
  const count = current?.visitCount ?? 0;

  const onSelect = useCallback((c: CountryProps) => { setSelected(c); setError(null); }, []);
  const onDeselect = useCallback(() => setSelected(null), []);

  async function changeCount(next: number) {
    if (!selected) return;
    if (!user) { router.push('/login'); return; }
    setSaving(true);
    try {
      await api.setCountryVisits(selected.code, next);
      setVisitList((list) => {
        const rest = list.filter((v) => v.countryCode !== selected.code);
        return next > 0 ? [...rest, { countryCode: selected.code, visitCount: next, cityCount: current?.cityCount ?? 0 }] : rest;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.fill}>
      <GlobeView visits={visits} selectedCode={selected?.code ?? null} onSelect={onSelect} onDeselect={onDeselect} />

      <View style={[styles.header, { top: insets.top + 12 }]} pointerEvents="box-none">
        <Text style={styles.brand}>지구여행</Text>
        <Text style={styles.stats}>
          {user ? `${visitList.length}개국 · ${totalCities}개 도시` : '지구를 돌려 여행한 나라를 눌러보세요'}
        </Text>
      </View>

      {!selected && (
        <View style={[styles.legend, { bottom: 16 }]} pointerEvents="none">
          {VISIT_LEVELS.map((l) => (
            <View key={l.min} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}

      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetRow}>
            <Text style={styles.flag}>{flagEmoji(selected.code)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.countryName}>{selected.nameKo}</Text>
              <Text style={styles.dim}>
                {selected.name}{current?.cityCount ? ` · 방문한 도시 ${current.cityCount}곳` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={12}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <View style={styles.counterRow}>
            <Text style={styles.label}>방문 횟수</Text>
            <View style={styles.counter}>
              <Pressable style={styles.stepBtn} disabled={saving || count === 0} onPress={() => changeCount(count - 1)}>
                <Text style={styles.stepText}>－</Text>
              </Pressable>
              <View style={[styles.countBadge, { backgroundColor: visitColor(count) ?? theme.surfaceAlt }]}>
                <Text style={[styles.countText, count > 0 && { color: '#0b1020' }]}>{count}회</Text>
              </View>
              <Pressable style={styles.stepBtn} disabled={saving} onPress={() => changeCount(count + 1)}>
                <Text style={styles.stepText}>＋</Text>
              </Pressable>
            </View>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="도시 지도 보기 →" onPress={() => router.push(`/country/${selected.code}`)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', left: 20, right: 20 },
  brand: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  stats: { color: '#c9d2f0', fontSize: 14, marginTop: 2 },
  legend: {
    position: 'absolute', left: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    backgroundColor: 'rgba(11,16,32,0.75)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { color: '#dfe5f7', fontSize: 11 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: {
    position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(21,27,47,0.97)',
    borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: theme.border,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 36 },
  countryName: { color: theme.text, fontSize: 20, fontWeight: '800' },
  dim: { color: theme.textDim, fontSize: 13 },
  close: { color: theme.textDim, fontSize: 18, padding: 4 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: theme.text, fontSize: 15, fontWeight: '600' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: theme.text, fontSize: 20, fontWeight: '700' },
  countBadge: { minWidth: 64, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  countText: { color: theme.text, fontSize: 16, fontWeight: '800' },
  error: { color: theme.danger },
});
