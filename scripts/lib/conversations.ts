import { normalizeAnswer } from '../../src/engine/check';
import type { Conversation, ConversationLine, Word } from '../../src/content/schema';

// Разговорные сценарии из content/templates/conversations.csv.
// Строка с role=say — реплика Сэсэг, option — вариант ответа ученика (correct / almost / wrong
// с объяснением), reply — ответ Сэсэг после верного варианта. Реплика, совпавшая со словом курса,
// получает его id: так в разговоре звучит запись и ответы идут в повторение.

const VERDICTS = new Set(['correct', 'almost', 'wrong']);

export function buildConversations(rows: Record<string, string>[], words: Word[]): { conversations: Conversation[]; errors: string[]; manual: string[] } {
  const byText = new Map(words.filter((w) => !w.excluded).map((w) => [normalizeAnswer(w.buryat), w.id]));
  const out = new Map<string, Conversation>();
  const errors: string[] = [];
  const manual = new Set<string>();
  const line = (buryat: string, russian: string): ConversationLine => {
    const wordId = byText.get(normalizeAnswer(buryat));
    if (!wordId) manual.add(buryat);
    return { buryat, russian, ...(wordId ? { wordId } : {}) };
  };

  rows.forEach((row, i) => {
    const at = `строка ${i + 2}`;
    const { conv, role, buryat, russian } = row;
    const n = Number(row.step);
    if (!conv || !n || !buryat || !russian) return errors.push(`${at}: нужны conv, step, buryat и russian`);
    let c = out.get(conv);
    if (!c) {
      if (!row.title) return errors.push(`${at}: у первой строки сценария нужен title`);
      c = { id: conv, title: row.title, scene: row.scene, ...(row.art ? { art: row.art } : {}), steps: [] };
      out.set(conv, c);
    }
    let step = c.steps[n - 1];
    if (role === 'say') {
      if (step) return errors.push(`${at}: у шага ${n} уже есть реплика`);
      c.steps[n - 1] = { say: line(buryat, russian), options: [] };
      return;
    }
    if (!step) return errors.push(`${at}: шаг ${n} должен начинаться с say`);
    if (role === 'reply') {
      step.reply = line(buryat, russian);
      return;
    }
    if (role !== 'option') return errors.push(`${at}: неизвестная роль «${role}»`);
    if (!VERDICTS.has(row.verdict)) return errors.push(`${at}: verdict — correct, almost или wrong`);
    if (row.verdict !== 'correct' && !row.explain) return errors.push(`${at}: неверному варианту нужно объяснение`);
    step.options.push({ ...line(buryat, russian), verdict: row.verdict as 'correct' | 'almost' | 'wrong', ...(row.explain ? { explain: row.explain } : {}) });
  });

  for (const c of out.values()) {
    c.steps.forEach((s, i) => {
      if (!s) errors.push(`${c.id}: пропущен шаг ${i + 1}`);
      else if (!s.options.some((o) => o.verdict === 'correct')) errors.push(`${c.id}, шаг ${i + 1}: нет верного варианта`);
    });
  }
  return { conversations: [...out.values()], errors, manual: [...manual] };
}
