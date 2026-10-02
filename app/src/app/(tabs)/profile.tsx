import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import RecordCard from '../../components/RecordCard';
import { Button, Card, Empty, ErrorText, SectionTitle, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { flagEmoji, theme, visitColor } from '../../lib/colors';
import { useCountryNames } from '../../lib/countryNames';
import type { CountryVisit, RecordSummary } from '../../lib/types';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const names = useCountryNames();
  const [countries, setCountries] = useState<CountryVisit[]>([]);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    Promise.all([api.myCountries(), api.myRecords({ limit: 20 })])
      .then(([c, r]) => {
        setCountries([...c.countries].sort((a, b) => b.visitCount - a.visitCount));
        setRecords(r.records);
      })
      .catch((e) => setError(e.message));
  }, [user]));

  if (!user) {
    return (
      <View style={[ui.screen, ui.center, { gap: 16 }]}>
        <Text style={{ fontSize: 56 }}>🧳</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>로그인하고 나만의 여행 지구본을 만들어보세요</Text>
        <Button title="로그인 / 회원가입" onPress={() => router.push('/login')} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const cityTotal = countries.reduce((s, c) => s + c.cityCount, 0);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingBottom: 48 }]}>
      <View style={s.headerRow}>
        <View>
          <Text style={ui.title}>{user.nickname}</Text>
          <Text style={ui.dim}>{user.email}</Text>
        </View>
        <Button small variant="ghost" title="로그아웃" onPress={logout} />
      </View>

      <View style={s.stats}>
        <Stat label="나라" value={countries.length} />
        <Stat label="도시" value={cityTotal} />
        <Stat label="기록" value={records.length >= 20 ? '20+' : records.length} />
      </View>
      {error && <ErrorText>{error}</ErrorText>}

      <SectionTitle>방문한 나라</SectionTitle>
      {countries.length === 0 ? (
        <Empty>지구본에서 나라를 눌러 방문 횟수를 기록해보세요</Empty>
      ) : (
        <View style={s.countryGrid}>
          {countries.map((c) => (
            <Pressable key={c.countryCode} style={s.country} onPress={() => router.push(`/country/${c.countryCode}`)}>
              <View style={[s.bar, { backgroundColor: visitColor(c.visitCount) ?? theme.border }]} />
              <Text style={s.countryName} numberOfLines={1}>
                {flagEmoji(c.countryCode)} {names.get(c.countryCode)?.nameKo ?? c.countryCode}
              </Text>
              <Text style={ui.dim}>{c.visitCount}회 · 도시 {c.cityCount}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <SectionTitle>내 여행 기록</SectionTitle>
      {records.length === 0 ? <Empty>아직 기록이 없어요</Empty> : records.map((r) => <RecordCard key={r.id} record={r} showAuthor={false} />)}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={ui.dim}>{label}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', gap: 10 },
  statValue: { color: theme.text, fontSize: 24, fontWeight: '900' },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  country: {
    width: '48%', flexGrow: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, gap: 4,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  countryName: { color: theme.text, fontSize: 15, fontWeight: '700' },
});
