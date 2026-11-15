# Запуск из корня репозитория; общие файлы — в .audio-work/ (в git не попадают).
import json, sys, os, subprocess, difflib, re
sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel
AUDIO = 'assets/audio'
bad = set(sys.argv[1].split(','))
r = json.load(open('.audio-work/found.json', encoding='utf-8'))
seen, rows = set(), []
for x in sorted(r, key=lambda x: -x['score']):
    k = (x['buryat'], x['russian'])
    if x['score'] < 0.67 or x['id'] in bad or k in seen: continue
    seen.add(k); rows.append(x)
os.makedirs('.audio-work/qa_clips', exist_ok=True)
def flt(lead, d):
    return ','.join(['highpass=f=80', 'afftdn=nr=12:nf=-40:tn=1', f'atrim=start={lead:.3f}', 'asetpts=PTS-STARTPTS', 'loudnorm=I=-18:TP=-2:LRA=7', 'afade=t=in:d=0.03', f'afade=t=out:st={max(0, d - 0.06):.3f}:d=0.06'])
for x in rows:
    st = max(0, x['start'] - 0.12); d = x['end'] + 0.2 - st; lead = min(1, st)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{st - lead:.3f}', '-t', f'{d + lead:.3f}', '-i', os.path.join(AUDIO, x['file']), '-af', flt(lead, d), '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', f".audio-work/qa_clips/{x['id']}.m4a"], check=True)
def sound(s):
    s = s.lower().replace('ү', 'у').replace('ө', 'о').replace('һ', 'х').replace('ё', 'е')
    s = re.sub(r'[ьъ\W\d_]+', '', s); s = re.sub(r'(.)\1+', r'\1', s)
    for a, b in (('э', 'е'), ('ы', 'и'), ('й', 'и'), ('щ', 'ш'), ('ж', 'з'), ('ш', 'с'), ('о', 'а'), ('ц', 'с')): s = s.replace(a, b)
    return s
m = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=8)
for x in rows:
    segs, _ = m.transcribe(f".audio-work/qa_clips/{x['id']}.m4a", language='ru', beam_size=5, vad_filter=False, condition_on_previous_text=False)
    t = ' '.join(s.text for s in segs).strip()
    x['qa'] = t; x['qasim'] = round(difflib.SequenceMatcher(None, sound(x['buryat']), sound(t)).ratio(), 2)
    ru = [w for w in re.findall(r'[а-яё]+', x['russian'].lower()) if len(w) > 2]
    x['leak'] = any(w in t.lower() for w in ru)
    print(x['qasim'], 'LEAK' if x['leak'] else '', x['buryat'], '|', t, '|', x['russian'], flush=True)
json.dump(rows, open('.audio-work/qa.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
