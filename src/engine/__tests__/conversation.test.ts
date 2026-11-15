import { conversationScore } from '@/engine/conversation';

describe('conversationScore', () => {
  it('всё верно с первого раза — три звезды', () => expect(conversationScore(['correct', 'correct', 'correct'])).toEqual({ stars: 3, result: 'correct' }));
  it('одно «почти» из четырёх — две звезды, почти верно', () => expect(conversationScore(['correct', 'almost', 'correct', 'correct'])).toEqual({ stars: 2, result: 'almost' }));
  it('половина ошибок — одна звезда, неверно', () => expect(conversationScore(['wrong', 'correct', 'wrong', 'almost'])).toEqual({ stars: 1, result: 'wrong' }));
});
