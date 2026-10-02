import { Text } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { theme } from '../../lib/colors';

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textDim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '지구본', headerShown: false, tabBarIcon: icon('🌏') }} />
      <Tabs.Screen name="explore" options={{ title: '둘러보기', tabBarIcon: icon('🧭') }} />
      <Tabs.Screen name="profile" options={{ title: '내 여행', tabBarIcon: icon('🧳') }} />
    </Tabs>
  );
}
