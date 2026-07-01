import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { AgentStore, ConversationStore, MessageStore, SettingsStore } from '../storage';
import type { Agent, Conversation, Message } from '../types';
import { colors } from '../theme';
import { generateId } from '../utils/id';
import { MissingApiKeyError, sendChatMessage } from '../api/claude';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    (async () => {
      const [convos, agents, msgs] = await Promise.all([
        ConversationStore.list(),
        AgentStore.list(),
        MessageStore.list(conversationId),
      ]);
      const convo = convos.find((c) => c.id === conversationId) ?? null;
      setConversation(convo);
      setAgent(agents.find((a) => a.id === convo?.agentId) ?? null);
      setMessages(msgs);
      navigation.setOptions({ title: convo?.title ?? '对话' });
    })();
  }, [conversationId, navigation]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !agent || !conversation || sending) return;

    setDraft('');
    const userMessage: Message = {
      id: generateId(),
      conversationId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    let history = await MessageStore.append(conversationId, userMessage);
    setMessages(history);
    scrollToEnd();
    setSending(true);

    try {
      const settings = await SettingsStore.get();
      const replyText = await sendChatMessage({
        apiKey: settings.apiKey,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        history,
      });
      const assistantMessage: Message = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: replyText || '(空回复)',
        createdAt: Date.now(),
      };
      history = await MessageStore.append(conversationId, assistantMessage);
      setMessages(history);

      const updated: Conversation = { ...conversation, updatedAt: Date.now() };
      await ConversationStore.save(updated);
      setConversation(updated);
    } catch (err) {
      const message =
        err instanceof MissingApiKeyError
          ? err.message
          : `请求失败：${err instanceof Error ? err.message : String(err)}`;
      const errorMessage: Message = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: message,
        createdAt: Date.now(),
        error: true,
      };
      history = await MessageStore.append(conversationId, errorMessage);
      setMessages(history);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToEnd}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubbleRow,
              item.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
            ]}
          >
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                item.error && styles.bubbleError,
              ]}
            >
              <Text style={styles.bubbleText}>{item.content}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {agent ? `向 ${agent.name} 打个招呼吧` : '加载中…'}
            </Text>
          </View>
        }
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.typingText}>正在思考…</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="输入消息…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendButtonText}>发送</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleError: { borderColor: colors.danger, borderWidth: 1 },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  typingText: { color: colors.textMuted, fontSize: 13 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#141311', fontWeight: '700', fontSize: 14 },
});
