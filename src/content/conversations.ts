import conversationsJson from '../../content/conversations.json';

import { Conversations, type Conversation } from './schema';

// Разговорные сценарии (content/templates/conversations.csv → npm run import:dialogues).

let cache: Conversation[] | null = null;

export function getConversations(): Conversation[] {
  cache ??= Conversations.parse(conversationsJson);
  return cache;
}
