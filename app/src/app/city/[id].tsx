import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import RecordCard from '../../components/RecordCard';
import { Button, Empty, ErrorText, Loading, SectionTitle, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { flagEmoji, theme } from '../../lib/colors';
import type { City, RecordSummary } from '../../lib/types';

export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cityId = Number(id);
  const { user } = useAuth();
  const [city, setCity] = useState<City | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [mine, setMine] = useState<RecordSummary[]>([]);
  const [others, setOthers] = useState<RecordSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 기록 작성/수정 후 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const { city: c } = await api.city(cityId);
        const [pub, my, visits] = await Promise.all([
          api.publicRecords({ cityId, limit: 30 }),
          user ? api.myRecords({ cityId, limit: 50 }) : Promise.resolve({ records: [], nextCursor: null }),
          user ? api.myCities(c.countryCode) : Promise.resolve({ visits: [] }),
        ]);
        if (!alive) return;
        setCity(c);
        setMine(my.records);
        setOthers(pub.records.filter((r) => r.author.id !== user?.id));
        setColor(visits.visits.find((v) => v.cityId === cityId)?.color ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [cityId, user]));

  if (error) return <View style={ui.center}><ErrorText>{error}</ErrorText></View>;
  if (!city) return <Loading />;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingBottom: 48 }]}>
      <Stack.Screen options={{ title: city.name }} />
      <View style={s.hero}>
        <View style={[s.colorDot, { backgroundColor: color ?? theme.surfaceAlt }]} />
        <View style={{ flex: 1 }}>
          <Text style={ui.title}>{city.name}</Text>
          <Text style={ui.dim}>{flagEmoji(city.countryCode)} {color ? '방문한 도시' : '아직 방문 체크 전'}</Text>
        </View>
      </View>

      <Button
        title="＋ 이 도시 여행 기록하기"
        onPress={() => (user ? router.push(`/record/edit?cityId=${city.id}`) : router.push('/login'))}
      />

      <SectionTitle>내 기록</SectionTitle>
      {!user ? (
        <Empty>로그인하면 이 도시에서의 코스, 사진, 일기를 남길 수 있어요</Empty>
      ) : mine.length === 0 ? (
        <Empty>아직 기록이 없어요</Empty>
      ) : (
        mine.map((r) => <RecordCard key={r.id} record={r} showAuthor={false} />)
      )}

      <SectionTitle>다른 여행자들의 공개 기록</SectionTitle>
      {others.length === 0 ? <Empty>아직 공개된 기록이 없어요</Empty> : others.map((r) => <RecordCard key={r.id} record={r} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  colorDot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.border },
});
