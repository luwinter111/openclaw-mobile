import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SettingsStore } from '../storage';
import { colors } from '../theme';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    SettingsStore.get().then((s) => setApiKey(s.apiKey));
  }, []);

  const handleSave = async () => {
    await SettingsStore.save({ apiKey: apiKey.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Claude API Key</Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="sk-ant-..."
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={styles.hint}>
        Key 仅保存在本机存储中，用于直接调用 Anthropic API。这是个人助理客户端的简化实现——如果要分享给其他人使用，建议改为通过你自己的后端网关转发请求，避免把 Key 打包进 App。
      </Text>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{saved ? '已保存 ✓' : '保存'}</Text>
      </Pressable>

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>关于 OpenClaw Mobile</Text>
        <Text style={styles.aboutText}>
          一个运行在你手机上的个人 AI 助理客户端，灵感来自 OpenClaw 的多 Agent /
          多渠道网关理念：每个 Agent 拥有独立的角色设定与（未来可扩展的）接入渠道，
          对话历史保存在本机。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 18 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#141311', fontWeight: '700', fontSize: 16 },
  about: { marginTop: 40, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
  aboutTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  aboutText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
});
