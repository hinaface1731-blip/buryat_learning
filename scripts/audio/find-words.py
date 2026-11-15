# Запуск из корня репозитория; общие файлы — в .audio-work/ (в git не попадают).
"""Ищет в расшифровках аудиоуроков бурятские слова курса.

В уроках пары «бурятское — русское» идут подряд. Находим русский перевод слова курса,
берём 1–3 соседних слова (до или после) и сравниваем их на слух-подобие с бурятским написанием.
"""
import difflib, glob, json, os, re, sys

TR, WORDS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
if WORDS.endswith('.tsv'):
    # content/templates/audio-candidates.tsv: тема (номер радиоурока) <TAB> бурятское <TAB> русское
    words = []
    for i, line in enumerate(open(WORDS, encoding='utf-8').read().strip().splitlines()):
        n, b, r = line.split('\t')
        words.append({'id': f'c{i}', 'b': b, 'r': r, 'alt': [], 'src': int(n), 'inCourse': True})
else:
    words = json.load(open(WORDS, encoding='utf-8'))

def norm(s):
    s = s.lower().replace('ё', 'е')
    return re.sub(r'[^а-яүөһ ]+', ' ', s).split()

def sound(s):
    # Грубое «звучание»: особые буквы к русским, долгие гласные в одну, ь/ъ прочь.
    s = s.lower().replace('ү', 'у').replace('ө', 'о').replace('һ', 'х').replace('ё', 'е')
    s = re.sub(r'[ьъ\W\d_]+', '', s)
    s = re.sub(r'(.)\1+', r'\1', s)
    for a, b in (('э', 'е'), ('ы', 'и'), ('й', 'и'), ('щ', 'ш'), ('ж', 'з'), ('ш', 'с'), ('о', 'а'), ('ц', 'с')):
        s = s.replace(a, b)
    return s

tokens = {}  # файл -> [(start, end, norm_word)]
for f in sorted(glob.glob(os.path.join(TR, '*.json'))):
    name = os.path.basename(f)[:-5] + '.mp3'
    toks = []
    for seg in json.load(open(f, encoding='utf-8')):
        for st, en, w in seg['words']:
            for n in norm(w):
                toks.append((st, en, n))
    tokens[name] = toks

def ru_variants(w):
    out = []
    for r in [w['r'], *w['alt']]:
        r = re.sub(r'\(.*?\)', ' ', r)
        n = norm(r)
        if n: out.append(n)
    return out

results = []
for w in words:
    target = sound(w['b'])
    if len(target) < 2: continue
    nbur = len(norm(w['b']))
    best = None
    for fname, toks in tokens.items():
        texts = [t[2] for t in toks]
        for rv in ru_variants(w):
            L = len(rv)
            for i in range(len(texts) - L + 1):
                if texts[i:i + L] != rv: continue
                cands = []
                for k in range(max(1, nbur), min(nbur + 2, 4) + 1):
                    if i - k >= 0: cands.append((i - k, i))          # бурятское перед русским
                    if i + L + k <= len(texts): cands.append((i + L, i + L + k))  # после
                for a, b in cands:
                    got = sound(''.join(texts[a:b]))
                    if not got: continue
                    score = difflib.SequenceMatcher(None, target, got).ratio()
                    start, end = toks[a][0], toks[b - 1][1]
                    # Отдельно стоящее слово надёжнее: соседи далеко по времени.
                    gap_before = start - toks[a - 1][1] if a > 0 else 2
                    gap_after = toks[b][0] - end if b < len(toks) else 2
                    iso = min(gap_before, 1.5) + min(gap_after, 1.5)
                    pref = 1 if fname.startswith(f"urok-{w['src']}-mixdown") else 0
                    key = (round(score, 2), pref, iso)
                    if best is None or key > best['key']:
                        best = {'key': key, 'id': w['id'], 'buryat': w['b'], 'russian': w['r'], 'file': fname,
                                'start': round(start, 2), 'end': round(end, 2), 'heard': ' '.join(texts[a:b]),
                                'score': round(score, 2), 'inCourse': w['inCourse'], 'src': w['src']}
    if best: results.append(best)

for r in results: r.pop('key')
results.sort(key=lambda r: -r['score'])
json.dump(results, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
good = [r for r in results if r['score'] >= 0.6]
print(f'кандидатов: {len(results)}, со сходством ≥0.6: {len(good)}, из них в курсе: {sum(r["inCourse"] for r in good)}')
for r in good[:40]: print(r['score'], r['buryat'], '|', r['heard'], '|', r['russian'], r['file'], r['start'])
