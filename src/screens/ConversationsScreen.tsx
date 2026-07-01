import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AgentStore, ConversationStore } from '../storage';
import type { Agent, Conversation } from '../types';
import { colors } from '../theme';
import { generateId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversations'>;

export default function ConversationsScreen({ navigation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const reload = useCallback(async () => {
    const [convos, agentList] = await Promise.all([
      ConversationStore.list(),
      AgentStore.list(),
    ]);
    setConversations(convos);
    setAgents(agentList);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const agentFor = (agentId: string) => agents.find((a) => a.id === agentId);

  const createWithAgent = async (agent: Agent) => {
    const conversation: Conversation = {
      id: generateId(),
      agentId: agent.id,
      title: `与 ${agent.name} 的新对话`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ConversationStore.save(conversation);
    navigation.navigate('Chat', { conversationId: conversation.id });
  };

  const startConversation = () => {
    if (agents.length === 0) return;
    if (agents.length === 1) {
      createWithAgent(agents[0]);
      return;
    }
    Alert.alert(
      '选择 Agent',
      '这段新对话由哪个 Agent 负责？',
      [
        ...agents.map((agent) => ({
          text: agent.name,
          onPress: () => createWithAgent(agent),
        })),
        { text: '取消', style: 'cancel' as const },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OpenClaw</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('Agents')} hitSlop={8}>
            <Text style={styles.headerAction}>Agent</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Text style={styles.headerAction}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>还没有会话，开始你的第一段对话吧</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const agent = agentFor(item.agentId);
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  navigation.navigate('Chat', { conversationId: item.id })
                }
                onLongPress={() => {
                  Alert.alert('删除会话', `确定删除「${item.title}」吗？`, [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '删除',
                      style: 'destructive',
                      onPress: async () => {
                        await ConversationStore.remove(item.id);
                        reload();
                      },
                    },
                  ]);
                }}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: agent?.color ?? colors.accent },
                  ]}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {agent?.name ?? '未知 Agent'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.fab} onPress={startConversation}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerAction: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
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
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
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
