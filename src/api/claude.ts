import type { Message } from '../types';

export class MissingApiKeyError extends Error {
  constructor() {
    super('未配置 Claude API Key，请前往设置页填写。');
    this.name = 'MissingApiKeyError';
  }
}

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function toApiMessages(messages: Message[]) {
  return messages
    .filter((m) => !m.pending && !m.error)
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function sendChatMessage(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: Message[];
}): Promise<string> {
  const { apiKey, model, systemPrompt, history } = params;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: toApiMessages(history),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();
  const textBlock = (data.content as Array<{ type: string; text?: string }>).find(
    (block) => block.type === 'text'
  );
  return textBlock?.text ?? '';
}
