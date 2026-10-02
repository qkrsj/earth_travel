import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { flagEmoji, theme } from '../lib/colors';
import type { RecordSummary } from '../lib/types';

export function formatTrip(start: string | null, end: string | null) {
  if (!start && !end) return '';
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start ?? end ?? '';
}

export default function RecordCard({ record, showAuthor = true }: { record: RecordSummary; showAuthor?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/record/${record.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {record.coverUrl ? (
        <Image source={{ uri: record.coverUrl }} style={styles.cover} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.cover, styles.placeholder]}><Text style={{ fontSize: 32 }}>{flagEmoji(record.countryCode)}</Text></View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.city} numberOfLines={1}>{flagEmoji(record.countryCode)} {record.cityName}</Text>
          {record.visibility === 'private' && <Text style={styles.badge}>🔒 비공개</Text>}
        </View>
        <Text style={styles.title} numberOfLines={1}>{record.title}</Text>
        {!!record.excerpt && <Text style={styles.excerpt} numberOfLines={2}>{record.excerpt}</Text>}
        <Text style={styles.meta} numberOfLines={1}>
          {[showAuthor ? record.author.nickname : null, formatTrip(record.tripStart, record.tripEnd),
            record.photoCount ? `사진 ${record.photoCount}장` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  cover: { width: 104, height: 112 },
  placeholder: { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: 12, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  city: { color: theme.textDim, fontSize: 12, flexShrink: 1 },
  badge: { color: theme.textDim, fontSize: 11 },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  excerpt: { color: theme.textDim, fontSize: 13, lineHeight: 18 },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 'auto' },
});
