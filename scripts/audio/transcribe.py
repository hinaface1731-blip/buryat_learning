# Запуск из корня репозитория; общие файлы — в .audio-work/ (в git не попадают).
import sys, json, os, glob, time
from faster_whisper import WhisperModel
src, out = sys.argv[1], sys.argv[2]
m = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=8)
for f in sorted(glob.glob(os.path.join(src, 'urok-*.mp3'))):
    name = os.path.splitext(os.path.basename(f))[0]
    dst = os.path.join(out, name + '.json')
    if os.path.exists(dst): continue
    t = time.time()
    segs, info = m.transcribe(f, language='ru', word_timestamps=True, vad_filter=True)
    data = [{'start': s.start, 'end': s.end, 'text': s.text.strip(), 'words': [[w.start, w.end, w.word] for w in (s.words or [])]} for s in segs]
    json.dump(data, open(dst + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(dst + '.tmp', dst)
    print(name, len(data), round(time.time() - t), flush=True)
