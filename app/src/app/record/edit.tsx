import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, Card, ErrorText, Field, Loading, SectionTitle, styles as ui } from '../../components/ui';
import { api, type RecordInput } from '../../lib/api';
import { theme } from '../../lib/colors';
import type { Photo, Visibility } from '../../lib/types';

interface StopDraft { key: string; name: string; note: string; day: string }
interface PhotoDraft extends Photo { uploading?: boolean; localUri?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function RecordEditScreen() {
  const params = useLocalSearchParams<{ id?: string; cityId?: string }>();
  const editingId = params.id ? String(params.id) : null;
  const [cityId, setCityId] = useState<number | null>(params.cityId ? Number(params.cityId) : null);
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (editingId) {
          const { record } = await api.record(editingId);
          setCityId(record.cityId);
          setCityName(record.city.name);
          setTitle(record.title);
          setContent(record.content);
          setTripStart(record.tripStart ?? '');
          setTripEnd(record.tripEnd ?? '');
          setVisibility(record.visibility);
          setStops(record.stops.map((s) => ({ key: newKey(), name: s.name, note: s.note, day: s.day ? String(s.day) : '' })));
          setPhotos(record.photos);
        } else if (cityId) {
          setCityName((await api.city(cityId)).city.name);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const tempKey = `uploading-${newKey()}`;
      setPhotos((prev) => [...prev, { url: asset.uri, storageKey: tempKey, caption: '', uploading: true, localUri: asset.uri }]);
      try {
        const uploaded = await api.upload(asset);
        setPhotos((prev) => prev.map((p) => (p.storageKey === tempKey ? { ...p, url: uploaded.url, storageKey: uploaded.key, uploading: false } : p)));
      } catch (e) {
        setPhotos((prev) => prev.filter((p) => p.storageKey !== tempKey));
        setError(`사진 업로드 실패: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  function updateStop(key: string, patch: Partial<StopDraft>) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function moveStop(index: number, dir: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError('제목을 입력하세요');
    for (const d of [tripStart, tripEnd]) if (d && !DATE_RE.test(d)) return setError('날짜는 YYYY-MM-DD 형식으로 입력하세요');
    if (photos.some((p) => p.uploading)) return setError('사진 업로드가 끝날 때까지 기다려주세요');

    const input: RecordInput = {
      title: title.trim(),
      content,
      tripStart: tripStart || null,
      tripEnd: tripEnd || null,
      visibility,
      stops: stops.filter((s) => s.name.trim()).map((s) => ({
        name: s.name.trim(), note: s.note, day: s.day ? Number(s.day) || null : null,
      })),
      photos: photos.map((p) => ({ storageKey: p.storageKey, caption: p.caption })),
    };
    setSaving(true);
    try {
      const { record } = editingId ? await api.updateRecord(editingId, input) : await api.createRecord(cityId!, input);
      if (editingId) router.back();
      else router.replace(`/record/${record.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingBottom: 64 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editingId ? '기록 수정' : `${cityName} 기록 작성` }} />

      <Field label="제목" placeholder="예) 벚꽃 가득했던 교토 3박 4일" value={title} onChangeText={setTitle} maxLength={100} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="시작일" placeholder="2026-04-01" value={tripStart} onChangeText={setTripStart} maxLength={10} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="종료일" placeholder="2026-04-04" value={tripEnd} onChangeText={setTripEnd} maxLength={10} />
        </View>
      </View>

      <Card style={s.visRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.visTitle}>{visibility === 'public' ? '🌐 공개' : '🔒 비공개'}</Text>
          <Text style={ui.dim}>
            {visibility === 'public' ? '다른 여행자들이 이 기록을 보고 참고할 수 있어요' : '나만 볼 수 있어요'}
          </Text>
        </View>
        <Switch value={visibility === 'public'} onValueChange={(v) => setVisibility(v ? 'public' : 'private')} />
      </Card>

      <SectionTitle right={<Button small variant="secondary" title="＋ 사진" onPress={pickPhotos} />}>사진</SectionTitle>
      {photos.length === 0 ? (
        <Text style={ui.dim}>여행 사진을 추가해 기록을 꾸며보세요</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {photos.map((p) => (
            <View key={p.storageKey} style={s.photoRow}>
              <View>
                <Image source={{ uri: p.localUri ?? p.url }} style={s.thumb} contentFit="cover" />
                {p.uploading && <View style={s.thumbOverlay}><ActivityIndicator color="#fff" /></View>}
              </View>
              <TextInput
                style={[ui.input, { flex: 1 }]}
                placeholder="사진 설명"
                placeholderTextColor={theme.textDim}
                value={p.caption}
                onChangeText={(caption) => setPhotos((prev) => prev.map((x) => (x.storageKey === p.storageKey ? { ...x, caption } : x)))}
              />
              <Pressable hitSlop={8} onPress={() => setPhotos((prev) => prev.filter((x) => x.storageKey !== p.storageKey))}>
                <Text style={s.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <SectionTitle right={<Button small variant="secondary" title="＋ 장소" onPress={() => setStops((p) => [...p, { key: newKey(), name: '', note: '', day: p.at(-1)?.day ?? '1' }])} />}>
        여행 코스
      </SectionTitle>
      {stops.length === 0 ? (
        <Text style={ui.dim}>방문한 장소를 순서대로 추가하세요</Text>
      ) : (
        stops.map((stop, i) => (
          <Card key={stop.key} style={{ gap: 8 }}>
            <View style={s.stopHeader}>
              <Text style={s.stopNum}>{i + 1}</Text>
              <TextInput style={[ui.input, s.dayInput]} placeholder="일차" placeholderTextColor={theme.textDim}
                keyboardType="number-pad" value={stop.day} onChangeText={(day) => updateStop(stop.key, { day: day.replace(/\D/g, '') })} maxLength={3} />
              <Text style={ui.dim}>일차</Text>
              <View style={{ flex: 1 }} />
              <Pressable hitSlop={6} onPress={() => moveStop(i, -1)}><Text style={s.icon}>↑</Text></Pressable>
              <Pressable hitSlop={6} onPress={() => moveStop(i, 1)}><Text style={s.icon}>↓</Text></Pressable>
              <Pressable hitSlop={6} onPress={() => setStops((prev) => prev.filter((x) => x.key !== stop.key))}><Text style={s.remove}>✕</Text></Pressable>
            </View>
            <TextInput style={ui.input} placeholder="장소 이름 (예: 후시미 이나리)" placeholderTextColor={theme.textDim}
              value={stop.name} onChangeText={(name) => updateStop(stop.key, { name })} />
            <TextInput style={ui.input} placeholder="메모 (선택)" placeholderTextColor={theme.textDim}
              value={stop.note} onChangeText={(note) => updateStop(stop.key, { note })} />
          </Card>
        ))
      )}

      <Field label="일기 · 메모" placeholder="그날의 이야기를 남겨보세요" value={content} onChangeText={setContent} multiline />

      {error && <ErrorText>{error}</ErrorText>}
      <Button title={editingId ? '수정 완료' : '기록 저장'} loading={saving} onPress={save} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: theme.surfaceAlt },
  thumbOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  remove: { color: theme.danger, fontSize: 18, paddingHorizontal: 4 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopNum: { color: '#fff', backgroundColor: theme.primary, width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, fontWeight: '800', overflow: 'hidden' },
  dayInput: { width: 56, paddingVertical: 6, textAlign: 'center' },
  icon: { color: theme.text, fontSize: 18, paddingHorizontal: 4 },
});
