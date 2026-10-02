import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { theme } from '../lib/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, style, small,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: theme.primary, secondary: theme.surfaceAlt, danger: theme.danger, ghost: 'transparent' }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, small && { fontSize: 13 }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={theme.textDim} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={theme.textDim} /></View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonSmall: { height: 36, borderRadius: 10, paddingHorizontal: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  label: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: theme.surface, color: theme.text, borderRadius: 12, borderWidth: 1,
    borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { color: theme.text, fontSize: 18, fontWeight: '800' },
  empty: { color: theme.textDim, textAlign: 'center', paddingVertical: 24 },
  error: { color: theme.danger },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  body: { color: theme.text, fontSize: 15, lineHeight: 22 },
  dim: { color: theme.textDim, fontSize: 13 },
});
