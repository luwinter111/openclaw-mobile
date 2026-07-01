import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import AgentsScreen from '../screens/AgentsScreen';
import AgentEditScreen from '../screens/AgentEditScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }}
      >
        <Stack.Screen
          name="Conversations"
          component={ConversationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '对话' }} />
        <Stack.Screen name="Agents" component={AgentsScreen} options={{ title: 'Agents' }} />
        <Stack.Screen
          name="AgentEdit"
          component={AgentEditScreen}
          options={{ title: '编辑 Agent' }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
