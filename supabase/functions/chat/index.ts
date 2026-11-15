// ИИ-собеседник на бурятском: Edge Function принимает историю разговора от вошедшего
// пользователя и отвечает через Claude API. Ключ ANTHROPIC_API_KEY хранится только здесь,
// в секретах Supabase (`supabase secrets set ANTHROPIC_API_KEY=...`), и в приложение не попадает.
//
//   supabase functions deploy chat

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_LIMIT = 40;
const MAX_TURNS = 30;
const MAX_CHARS = 600;

const SYSTEM = `Ты — Сэсэг, дружелюбная собеседница из Улан-Удэ. Ты помогаешь взрослому русскоязычному новичку разговаривать на литературном бурятском языке (хоринская основа, кириллица с буквами ү, ө, һ).

Как отвечать:
- Пиши короткую реплику на бурятском (1–2 простых предложения), ниже в скобках — перевод на русский.
- Если в последнем сообщении ученика есть ошибка, после перевода добавь строку «Поправка:» с правильным вариантом и одним коротким объяснением по-русски. Нет ошибки — не пиши «Поправка».
- Используй простую бытовую лексику: приветствие, знакомство, семья, еда, дом, погода, город.
- Если ученик пишет по-русски, подскажи, как сказать это по-бурятски, и продолжи разговор.
- Если не уверена в написании слова, скажи об этом прямо, а не выдумывай.
- Не обсуждай темы, не связанные с изучением языка и бытовым разговором; мягко верни разговор к практике.`;

type Turn = { role: 'user' | 'assistant'; content: string };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Кто пишет: проверяем токен вошедшего пользователя.
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'auth' }, 401);

  let turns: Turn[];
  try {
    const body = await req.json();
    turns = (body.messages as Turn[])
      .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
      .slice(-MAX_TURNS)
      .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHARS) }));
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (turns.length === 0 || turns[0].role !== 'user' || turns[turns.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);

  // Дневной лимит — чтобы чужой токен не съел бюджет.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin.from('chat_usage').select('messages').eq('user_id', user.id).eq('day', today).maybeSingle();
  const used = usage?.messages ?? 0;
  if (used >= DAILY_LIMIT) return json({ error: 'limit', limit: DAILY_LIMIT }, 429);
  await admin.from('chat_usage').upsert({ user_id: user.id, day: today, messages: used + 1 });

  const client = new Anthropic(); // ANTHROPIC_API_KEY из секретов функции
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Короткие реплики в чате: низкое усилие, мышление по умолчанию (адаптивное).
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: turns,
    });
    if (response.stop_reason === 'refusal') return json({ reply: 'Давайте вернёмся к разговору на бурятском. Хэр байнаш? (Как дела?)', refused: true });
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return json({ reply, left: DAILY_LIMIT - used - 1 });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503);
    if (error instanceof Anthropic.APIError) return json({ error: 'api', status: error.status }, 502);
    return json({ error: 'network' }, 502);
  }
});
