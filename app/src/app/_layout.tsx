import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { theme } from '../lib/colors';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: theme.bg, card: theme.bg, primary: theme.primary, border: theme.border, text: theme.text },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.text, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ presentation: 'modal', title: '로그인' }} />
          <Stack.Screen name="country/[code]" options={{ title: '' }} />
          <Stack.Screen name="city/[id]" options={{ title: '' }} />
          <Stack.Screen name="record/[id]" options={{ title: '여행 기록' }} />
          <Stack.Screen name="record/edit" options={{ title: '기록 작성', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
