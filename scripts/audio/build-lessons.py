# Запуск из корня репозитория; общие файлы — в .audio-work/ (в git не попадают).
import json, re, glob, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from wordfreq import zipf_frequency as zf
THEMES = {1:'Знакомство',2:'Откуда вы родом',3:'Числа',4:'Возраст и внешность',5:'Семья',6:'Цвета и действия',7:'Части тела',8:'Одежда',9:'Еда',10:'На кухне',11:'Дом',12:'Домашние животные',13:'Растения',14:'Время',15:'Природа',16:'Погода',17:'Дикие животные',18:'Город и село',19:'Рынок и день',20:'Праздники'}
AMBIG = {'мини','би','ши','та','энэ','тэрэ','гэр','аба','аха','ута','хара','гал'}
def is_ru(text):
    ts = re.findall(r'[а-яёa-z]+', text.lower())
    if not ts: return False
    return sum((0 if w in AMBIG else zf(w,'ru')) >= 3.2 for w in ts) / len(ts) >= 0.6
import csv
clips = [r for r in csv.DictReader(open('content/templates/audio-clips.csv', encoding='utf-8-sig')) if r['status'] != 'skip']
out = []
for f in glob.glob('.audio-work/tr/*.json'):
    name = os.path.basename(f)[:-5]
    n = int(re.search(r'urok-(\d+)', name).group(1))
    fm = 'mixdown' in name
    words = [w for seg in json.load(open(f, encoding='utf-8')) for w in seg['words']]
    chunks, cur = [], []
    for w in words:
        if cur and (w[0]-cur[-1][1] > 0.28 or re.search(r'[.!?,:;]$', cur[-1][2].strip())): chunks.append(cur); cur = []
        cur.append(w)
    if cur: chunks.append(cur)
    segs = []
    for c in chunks:
        s, e = round(c[0][0], 1), round(c[-1][1], 1)
        text = ''.join(w[2] for w in c).strip()
        kind = 'ru' if is_ru(text) else 'bur'
        last = segs[-1] if segs else None
        if last and last['k'] == kind and s - last['e'] < 1.5 and (kind == 'bur' or not re.search(r'[.!?]$', last['x'])):
            last['e'] = e
            if kind == 'ru': last['x'] += ' ' + text
        else:
            segs.append({'t': s, 'e': e, 'k': kind, 'x': text if kind == 'ru' else ''})
    items = []
    for sg in segs:
        k = sg['k']
        if k == 'bur' and sg['e'] - sg['t'] > 25: k = 'music'
        items.append({'t': sg['t'], 'k': k, **({'x': sg['x']} if k == 'ru' else {})})
    # Слова курса, вырезанные из этого урока: в ленте на своём месте, с переводом.
    for r in clips:
        if r['file'][:-4] == name: items.append({'t': round(float(r['start']), 1), 'k': 'word', 'id': r['id']})
    items.sort(key=lambda x: x['t'])
    lid = f"fm-{n:02d}" if fm else f"kids-{n:02d}"
    out.append({'id': lid, 'n': n, 'course': 'burfm' if fm else 'kids', 'title': THEMES[n] if fm else f'Урок {n}', 'segments': items})
out.sort(key=lambda x: (x['course'] != 'burfm', x['n']))
json.dump(out, open('content/audio-lessons.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), sum(len(x['segments']) for x in out), os.path.getsize('content/audio-lessons.json'))
