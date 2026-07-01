import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Agent, Conversation, Message, Settings } from '../types';

const KEYS = {
  agents: '@openclaw/agents',
  conversations: '@openclaw/conversations',
  settings: '@openclaw/settings',
  messages: (conversationId: string) => `@openclaw/messages:${conversationId}`,
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

export const DEFAULT_AGENT_ID = 'default-assistant';

function defaultAgents(): Agent[] {
  return [
    {
      id: DEFAULT_AGENT_ID,
      name: 'Claude 助理',
      systemPrompt: 'You are a helpful personal assistant running on the user\'s phone.',
      model: 'claude-sonnet-5',
      channel: 'direct',
      color: '#D97757',
      createdAt: Date.now(),
    },
  ];
}

export const AgentStore = {
  async list(): Promise<Agent[]> {
    const agents = await readJson<Agent[]>(KEYS.agents, []);
    if (agents.length === 0) {
      const seeded = defaultAgents();
      await writeJson(KEYS.agents, seeded);
      return seeded;
    }
    return agents;
  },
  async save(agent: Agent): Promise<void> {
    const agents = await AgentStore.list();
    const idx = agents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) agents[idx] = agent;
    else agents.push(agent);
    await writeJson(KEYS.agents, agents);
  },
  async remove(agentId: string): Promise<void> {
    const agents = await AgentStore.list();
    await writeJson(KEYS.agents, agents.filter((a) => a.id !== agentId));
  },
};

export const ConversationStore = {
  async list(): Promise<Conversation[]> {
    const items = await readJson<Conversation[]>(KEYS.conversations, []);
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async save(conversation: Conversation): Promise<void> {
    const items = await readJson<Conversation[]>(KEYS.conversations, []);
    const idx = items.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) items[idx] = conversation;
    else items.push(conversation);
    await writeJson(KEYS.conversations, items);
  },
  async remove(conversationId: string): Promise<void> {
    const items = await readJson<Conversation[]>(KEYS.conversations, []);
    await writeJson(KEYS.conversations, items.filter((c) => c.id !== conversationId));
    await AsyncStorage.removeItem(KEYS.messages(conversationId));
  },
};

export const MessageStore = {
  async list(conversationId: string): Promise<Message[]> {
    return readJson<Message[]>(KEYS.messages(conversationId), []);
  },
  async append(conversationId: string, message: Message): Promise<Message[]> {
    const items = await MessageStore.list(conversationId);
    items.push(message);
    await writeJson(KEYS.messages(conversationId), items);
    return items;
  },
  async replace(conversationId: string, messages: Message[]): Promise<void> {
    await writeJson(KEYS.messages(conversationId), messages);
  },
};

export const SettingsStore = {
  async get(): Promise<Settings> {
    return readJson<Settings>(KEYS.settings, { apiKey: '' });
  },
  async save(settings: Settings): Promise<void> {
    await writeJson(KEYS.settings, settings);
  },
};
