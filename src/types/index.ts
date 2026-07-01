export type ChannelType = 'direct' | 'telegram' | 'webhook';

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  channel: ChannelType;
  color: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
}

export interface Settings {
  apiKey: string;
}
