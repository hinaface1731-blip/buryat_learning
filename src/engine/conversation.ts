import type { ConversationOption } from '@/content/schema';

import type { Outcome } from './types';

type Verdict = ConversationOption['verdict'];

/** Оценка разговора по первому ответу на каждом шаге: три звезды — всё верно с первого раза. */
export function conversationScore(first: Verdict[]): { stars: 1 | 2 | 3; result: Outcome['result'] } {
  const right = first.filter((v) => v === 'correct').length;
  const wrong = first.filter((v) => v === 'wrong').length;
  const share = first.length ? right / first.length : 1;
  const stars = share === 1 ? 3 : share >= 0.6 ? 2 : 1;
  const result = right === first.length ? 'correct' : wrong * 2 >= first.length ? 'wrong' : 'almost';
  return { stars, result };
}
