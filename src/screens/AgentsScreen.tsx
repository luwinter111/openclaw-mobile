import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AgentStore } from '../storage';
import type { Agent } from '../types';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Agents'>;

const CHANNEL_LABEL: Record<Agent['channel'], string> = {
  direct: '直接对话',
  telegram: 'Telegram',
  webhook: 'Webhook',
};

export default function AgentsScreen({ navigation }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);

  const reload = useCallback(async () => {
    setAgents(await AgentStore.list());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const confirmDelete = (agent: Agent) => {
    Alert.alert('删除 Agent', `确定删除「${agent.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await AgentStore.remove(agent.id);
          reload();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('AgentEdit', { agentId: item.id })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {CHANNEL_LABEL[item.channel]} · {item.model}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有 Agent，点右下角创建一个</Text>
          </View>
        }
      />
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('AgentEdit', {})}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#141311', fontSize: 30, fontWeight: '700', marginTop: -2 },
});
