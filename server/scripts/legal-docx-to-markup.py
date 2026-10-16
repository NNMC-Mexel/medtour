#!/usr/bin/env python3
"""
Конвертер правовых документов (.docx) в разметку страниц /documents/*.

Используется для первичного импорта и для обновлений, когда юристы присылают
новую редакцию в Word. Дальше документы правятся в Admin > Правовые документы.

    textutil -convert html -output offer.ru.html "Оферта.docx"   # macOS
    python3 -I scripts/legal-docx-to-markup.py offer.ru.html > offer.ru.md

Разметка (её же понимает фронтенд, см. frontend/src/config/legalMarkup.js):
    # Заголовок части        — подряд идущие строки «#» — один заголовок с подзаголовком
    ## Раздел
    ### Подзаголовок
    - пункт списка
    > примечание
    | ячейка | ячейка |      — строка таблицы
    **жирный**, [текст](/ссылка)
"""
import re
import sys
from html.parser import HTMLParser

SAMPLE_WORDS = {'ОБРАЗЕЦ', 'ҮЛГІ', 'SAMPLE', 'TEMPLATE', '样本', '样例', '范本', '模板'}


class DocParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.centered_classes = set()
        self.in_style = False
        self.style = ''
        self.blocks = []        # (kind, runs, centered); runs = [(text, bold)]
        self.current = None
        self.bold = 0
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'style':
            self.in_style = True
        elif tag in ('p', 'li') and self.cell is None:
            klass = attrs.get('class', '')
            self.current = [tag, [], klass in self.centered_classes]
        elif tag == 'b':
            self.bold += 1
        elif tag == 'br' and self.current is not None:
            self.current[1].append((' ', self.bold > 0))
        elif tag == 'tr':
            self.row = []
        elif tag == 'td':
            self.cell = []

    def handle_endtag(self, tag):
        if tag == 'style':
            self.in_style = False
            for klass, body in re.findall(r'(?:p|li)\.(\w+)\s*\{([^}]*)\}', self.style):
                if 'text-align: center' in body:
                    self.centered_classes.add(klass)
        elif tag in ('p', 'li') and self.current is not None and self.cell is None:
            self.blocks.append(tuple(self.current))
            self.current = None
        elif tag == 'b':
            self.bold -= 1
        elif tag == 'td' and self.cell is not None:
            self.row.append(clean(''.join(self.cell)))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if any(self.row):
                self.blocks.append(('tr', [(' | '.join(self.row), False)], False))
            self.row = None

    def handle_data(self, data):
        if self.in_style:
            self.style += data
        elif self.cell is not None:
            self.cell.append(data)
        elif self.current is not None:
            self.current[1].append((data, self.bold > 0))


def clean(text):
    text = text.replace(' ', ' ').replace('\t', ' ')
    return re.sub(r'[ ]{2,}', ' ', text).strip()


def inline(runs):
    """Текст абзаца; жирные фрагменты внутри обычного текста — **так**."""
    out = []
    for text, bold in runs:
        if bold and text.strip():
            lead = text[:len(text) - len(text.lstrip())]
            trail = text[len(text.rstrip()):]
            out.append(f'{lead}**{text.strip()}**{trail}')
        else:
            out.append(text)
    line = clean(''.join(out))
    # «**a** **b**» → «**a b**»: соседние жирные куски сливаем, пробел между ними сохраняем.
    return re.sub(r'\*\*(\s*)\*\*', r'\1', line)


def bold_share(runs):
    total = sum(len(t.strip()) for t, _ in runs)
    bold = sum(len(t.strip()) for t, b in runs if b)
    return bold / total if total else 0


def convert(html):
    parser = DocParser()
    parser.feed(html)
    lines = []
    group = []      # подряд идущие центрированные жирные строки

    def flush_group():
        if not group:
            return
        if len(group) == 1 and re.match(r'^\d+\.\s', group[0]):
            lines.append(f'## {group[0]}')
        else:
            samples = [g for g in group if g.strip(' :.').upper() in SAMPLE_WORDS]
            for g in group:
                if g not in samples:
                    lines.append(f'# {g}')
            lines.extend(f'> {s}' for s in samples)
        group.clear()

    for kind, runs, centered in parser.blocks:
        plain = clean(''.join(t for t, _ in runs))
        if not plain:
            flush_group()
            continue
        if kind == 'tr':
            flush_group()
            lines.append(f'| {plain} |')
            continue
        if centered and bold_share(runs) > 0.8:
            group.append(plain.replace('**', ''))
            continue
        flush_group()
        if kind == 'li':
            lines.append(f'- {inline(runs)}')
        elif bold_share(runs) > 0.95 and len(plain) < 160:
            lines.append(f'### {plain}')
        else:
            text = inline(runs)
            # Абзац, который сам по себе выглядит как разметка, не должен ею стать.
            if re.match(r'^(#|>|\|)', text):
                text = '\\' + text
            lines.append(text)
    flush_group()
    return '\n'.join(normalize(lines)) + '\n'


APPENDIX = re.compile(r'^(Приложение\s*№\s*\d|Appendix\s+No\.?\s*\d|.*\d+\s*-\s*қосымша$|.*附件\s*\d+$)', re.I)
NOTE = re.compile(r'^(ПРИМЕЧАНИЕ|ЕСКЕРТУ|ЕСКЕРТПЕ|NOTE|注意|备注|附注)\s*[:：]?$', re.I)
SECTION = re.compile(r'^\d{1,2}\.\s+\S')


def strip_marks(line):
    return re.sub(r'^(#{1,3}|>)\s+', '', line).replace('**', '').strip()


def normalize(raw):
    """Оформление в исходных Word-файлах разное на разных языках, поэтому
    структуру выравниваем по содержанию строки, а не по её стилю."""
    out = []
    pending_samples = []
    i = 0
    while i < len(raw):
        line = raw[i]
        text = strip_marks(line)
        is_heading = line.startswith('#')
        i += 1
        if not text.strip('()[]:;., '):
            continue                                    # «# )» и прочие осколки
        if text.strip(' :.').upper() in SAMPLE_WORDS:
            marker = f'> {text.strip(" :.")}'
            nxt = raw[i] if i < len(raw) else ''
            last_part = max((k for k, l in enumerate(out) if l.startswith('# ')), default=None)
            if nxt.startswith('#') or last_part is None:
                pending_samples.append(marker)          # пометка стоит перед заголовком формы
            else:
                k = last_part                           # …или уже после него, среди полей формы
                while k + 1 < len(out) and out[k + 1].startswith('# '):
                    k += 1
                out.insert(k + 1, marker)
            continue
        if APPENDIX.match(text) and len(text) < 80:
            out.append(f'# {text}')
            continue
        inline_note = re.match(r'^\*\*(ПРИМЕЧАНИЕ|ЕСКЕРТУ|NOTE|注意|备注|附注)\s*[:：]\s*\*\*', line, re.I)
        if inline_note:
            out.append(f'> {line}')                     # «**Примечание:** текст» в одном абзаце
            continue
        if NOTE.match(text):
            nxt = raw[i] if i < len(raw) else ''
            out.append(f'> {text}')
            if nxt and not nxt.startswith(('#', '-', '|', '>')):
                out.append(f'> {nxt}')
                i += 1
            continue
        if line.startswith(('-', '|', '>')):
            out.append(line)
            continue
        # Подписи под полями формы, строки с пропусками «____» и флажки — не заголовки.
        # «(ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ)» сразу под заголовком — часть заголовка.
        if is_heading and text.startswith(('(', '（')) and out and out[-1].startswith('# '):
            out.append(f'# {text}')
            continue
        if text.startswith(('(', '（')) or '___' in text or '☐' in text:
            out.append(text)
            continue
        if SECTION.match(text) and len(text) <= 90 and not re.search(r'[.;:,。；：，]$', text):
            out.append(f'## {text}')
            continue
        if is_heading:
            if line.startswith(('# ', '## ')):
                out.append(line)
            elif len(text) <= 60 or re.search(r'[:：]$', text):
                out.append(f'### {text}')
            else:
                out.append(text)                        # жирное предложение, а не заголовок
        else:
            out.append(line)
        # Пометку «ОБРАЗЕЦ» ставим после заголовка формы, к которой она относится.
        if pending_samples and out[-1].startswith('# ') and not (i < len(raw) and raw[i].startswith('# ')):
            nxt_text = strip_marks(raw[i]) if i < len(raw) else ''
            if not (nxt_text.strip(' :.').upper() in SAMPLE_WORDS or (APPENDIX.match(nxt_text) and len(nxt_text) < 80)):
                out.extend(pending_samples)
                pending_samples.clear()
    out.extend(pending_samples)
    return out


if __name__ == '__main__':
    with open(sys.argv[1], encoding='utf-8') as f:
        sys.stdout.write(convert(f.read()))
