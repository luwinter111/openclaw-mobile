import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AgentStore } from '../storage';
import type { Agent, ChannelType } from '../types';
import { colors } from '../theme';
import { generateId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'AgentEdit'>;

const CHANNELS: { value: ChannelType; label: string }[] = [
  { value: 'direct', label: '直接对话' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'webhook', label: 'Webhook' },
];

const SWATCHES = ['#D97757', '#5E9DFF', '#6FCF97', '#E5604D', '#B08CFF', '#F2C94C'];

const MODELS = ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'];

export default function AgentEditScreen({ route, navigation }: Props) {
  const { agentId } = route.params;
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [channel, setChannel] = useState<ChannelType>('direct');
  const [color, setColor] = useState(SWATCHES[0]);
  const [loaded, setLoaded] = useState(!agentId);

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      const agents = await AgentStore.list();
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        setName(agent.name);
        setSystemPrompt(agent.systemPrompt);
        setModel(agent.model);
        setChannel(agent.channel);
        setColor(agent.color);
      }
      setLoaded(true);
    })();
  }, [agentId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const agent: Agent = {
      id: agentId ?? generateId(),
      name: name.trim(),
      systemPrompt: systemPrompt.trim(),
      model,
      channel,
      color,
      createdAt: Date.now(),
    };
    await AgentStore.save(agent);
    navigation.goBack();
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>名称</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="例如：工作助理"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>系统提示词（System Prompt）</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="描述这个 Agent 的角色与行为…"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={styles.label}>模型</Text>
      <View style={styles.chipRow}>
        {MODELS.map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, model === m && styles.chipActive]}
            onPress={() => setModel(m)}
          >
            <Text style={[styles.chipText, model === m && styles.chipTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>接入渠道</Text>
      <View style={styles.chipRow}>
        {CHANNELS.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.chip, channel === c.value && styles.chipActive]}
            onPress={() => setChannel(c.value)}
          >
            <Text style={[styles.chipText, channel === c.value && styles.chipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>颜色标记</Text>
      <View style={styles.chipRow}>
        {SWATCHES.map((sw) => (
          <Pressable
            key={sw}
            style={[
              styles.swatch,
              { backgroundColor: sw },
              color === sw && styles.swatchActive,
            ]}
            onPress={() => setColor(sw)}
          />
        ))}
      </View>

      <Pressable
        style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!name.trim()}
      >
        <Text style={styles.saveButtonText}>保存</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 18 },
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: '#141311', fontWeight: '700' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#141311', fontWeight: '700', fontSize: 16 },
});
