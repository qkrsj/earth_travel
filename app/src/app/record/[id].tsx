import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { formatTrip } from '../../components/RecordCard';
import { Button, Card, ErrorText, Loading, SectionTitle, styles as ui } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { flagEmoji, theme } from '../../lib/colors';
import type { Stop, TravelRecord } from '../../lib/types';

function confirm(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => Alert.alert('확인', message, [
    { text: '취소', style: 'cancel', onPress: () => resolve(false) },
    { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
  ]));
}

/** 코스를 일차별로 묶음 */
function groupByDay(stops: Stop[]) {
  const groups: { day: number | null; stops: Stop[] }[] = [];
  for (const stop of stops) {
    const last = groups[groups.length - 1];
    if (last && last.day === stop.day) last.stops.push(stop);
    else groups.push({ day: stop.day, stops: [stop] });
  }
  return groups;
}

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [record, setRecord] = useState<TravelRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(useCallback(() => {
    api.record(String(id)).then((r) => setRecord(r.record)).catch((e) => setError(e.message));
  }, [id]));

  if (error) return <View style={ui.center}><ErrorText>{error}</ErrorText></View>;
  if (!record) return <Loading />;

  const isOwner = user?.id === record.userId;
  const photoWidth = Math.min(width, 720) - 32;

  async function remove() {
    if (!record || !(await confirm('이 기록을 삭제할까요? 사진도 함께 삭제됩니다.'))) return;
    setDeleting(true);
    try {
      await api.deleteRecord(record.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingBottom: 48 }]}>
      <Stack.Screen options={{ title: record.city.name }} />

      {record.photos.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {record.photos.map((p) => (
            <View key={p.storageKey} style={{ width: photoWidth, gap: 6 }}>
              <Image source={{ uri: p.url }} style={{ width: photoWidth, height: photoWidth * 0.75, borderRadius: 16 }} contentFit="cover" transition={150} />
              {!!p.caption && <Text style={ui.dim}>{p.caption}</Text>}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={{ gap: 6 }}>
        <Text style={ui.dim}>
          {flagEmoji(record.countryCode)} {record.city.name} · {record.visibility === 'public' ? '🌐 공개' : '🔒 비공개'}
        </Text>
        <Text style={ui.title}>{record.title}</Text>
        <Text style={ui.dim}>
          {[record.author.nickname, formatTrip(record.tripStart, record.tripEnd)].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {!!record.content && <Text style={ui.body}>{record.content}</Text>}

      {record.stops.length > 0 && (
        <>
          <SectionTitle>여행 코스</SectionTitle>
          <Card style={{ gap: 14 }}>
            {groupByDay(record.stops).map((g, gi) => (
              <View key={gi} style={{ gap: 10 }}>
                {g.day != null && <Text style={s.day}>Day {g.day}</Text>}
                {g.stops.map((stop, i) => (
                  <View key={i} style={s.stop}>
                    <View style={s.stopDot}><Text style={s.stopNum}>{record.stops.indexOf(stop) + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stopName}>{stop.name}</Text>
                      {!!stop.note && <Text style={ui.dim}>{stop.note}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </Card>
        </>
      )}

      {isOwner && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} variant="secondary" title="수정" onPress={() => router.push(`/record/edit?id=${record.id}`)} />
          <Button style={{ flex: 1 }} variant="danger" title="삭제" loading={deleting} onPress={remove} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  day: { color: theme.primary, fontWeight: '800', fontSize: 14 },
  stop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stopDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  stopNum: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stopName: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
