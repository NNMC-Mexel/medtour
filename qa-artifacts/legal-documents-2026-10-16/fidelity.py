"""Сверка текста страницы с исходным .docx: слова по порядку, иероглифы по одному.
   python3 -I fidelity.py <qa-dir>  → fidelity.json"""
import difflib, json, pathlib, re, sys

QA = pathlib.Path(sys.argv[1])
SOURCES = {
    'offer': {'ru': 'Оферта - для иностр.txt', 'kk': 'Оферта по иностр казакша.txt', 'en': 'англ_Оферта - для иностр.txt', 'zh': 'кит_Оферта - для иностр.txt'},
    'consent': {'ru': 'Согласие на сбор и обработку и ИС для иностранцев 24.09.26.txt', 'kk': 'Согласие на сбор и обработку и ИС по иностр казакша.txt', 'en': 'англ_Consent.txt', 'zh': 'кит_Согласие на сбор и обработку и ИС для иностранцев 24.09.26.txt'},
}
HAN = '㐀-鿿豈-﫿'
TOKEN = re.compile(f'[{HAN}]|[^\\W_{HAN}]+')

def tokens(text):
    return TOKEN.findall(text.lower())

out = {}
for slug, files in SOURCES.items():
    for lang, name in files.items():
        src = tokens((QA / 'source-txt' / name).read_text(encoding='utf-8'))
        page = tokens((QA / 'rendered' / f'{slug}.{lang}.txt').read_text(encoding='utf-8'))
        sm = difflib.SequenceMatcher(a=src, b=page, autojunk=False)
        missing, extra = [], []
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            if op in ('delete', 'replace'): missing.append(' '.join(src[a1:a2]))
            if op in ('insert', 'replace'): extra.append(' '.join(page[b1:b2]))
        out[f'{slug}.{lang}'] = {'sourceWords': len(src), 'pageWords': len(page), 'missing': missing, 'extra': extra}
(QA / 'fidelity.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(json.dumps({k: (v['sourceWords'], v['pageWords'], len(v['missing']), len(v['extra'])) for k, v in out.items()}, ensure_ascii=False))
