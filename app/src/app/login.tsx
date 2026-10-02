import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Button, ErrorText, Field, styles as ui } from '../components/ui';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/colors';

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password, nickname);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: mode === 'login' ? '로그인' : '회원가입' }} />
      <ScrollView contentContainerStyle={[ui.content, { paddingTop: 32 }]} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 56 }}>🌏</Text>
          <Text style={ui.title}>지구여행</Text>
          <Text style={ui.dim}>내가 다녀온 세계를 지구본에 칠해보세요</Text>
        </View>
        <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {mode === 'signup' && <Field label="닉네임" value={nickname} onChangeText={setNickname} maxLength={30} />}
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder={mode === 'signup' ? '8자 이상' : undefined}
          onSubmitEditing={submit}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={mode === 'login' ? '로그인' : '가입하기'} loading={loading} onPress={submit} />
        <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
          <Text style={{ color: theme.primary, textAlign: 'center', padding: 8 }}>
            {mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
