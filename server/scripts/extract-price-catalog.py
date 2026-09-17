"""Extract international paid tariffs from the supplied NNMC workbook.

Usage: python3 extract-price-catalog.py SOURCE.xlsx OUTPUT.json RATE RATE_DATE
Only the two paid sheets are used. Column G is explicitly labelled for foreign
patients from outside the CIS; insurance tariffs are excluded.
"""
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

import openpyxl


def category_for_row(row):
    if row < 248:
        return 'Консультации специалистов'
    if row < 275:
        return 'Онлайн-консультации'
    if row < 570:
        return 'Амбулаторные услуги'
    if row < 630:
        return 'Эндоскопия'
    if row < 727:
        return 'Реабилитация'
    if row < 908:
        return 'Лучевая и УЗ-диагностика'
    if row < 1238:
        return 'Лабораторные анализы'
    if row < 1243:
        return 'Трансфузиология'
    if row < 1313:
        return 'Патоморфология'
    if row < 1800:
        return 'Лечение и операции'
    return 'Стационар и другие услуги'


def section_for(title, category):
    if re.search(r'(?i)\bcheck[ -]?up\b|чек[ -]?ап|^пакет[ "«]|^комплексн(?:ая услуга|ое исследование|ое узи)', title):
        return 'checkup'
    if category == 'Лабораторные анализы':
        return 'analysis'
    return 'service'


def main():
    source, output, rate_text, rate_date = sys.argv[1:5]
    rate = Decimal(rate_text)
    if rate <= 0 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', rate_date):
        raise ValueError('Expected positive KZT/USD rate and YYYY-MM-DD date')
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    entries = []
    for sheet_index in (0, 1):
        sheet = workbook.worksheets[sheet_index]
        for row_number, row in enumerate(sheet.values, 1):
            if len(row) < 7 or not isinstance(row[6], (int, float)) or not row[1]:
                continue
            title = re.sub(r'\s+', ' ', str(row[1])).strip()
            kzt = Decimal(str(row[6]))
            category = category_for_row(row_number) if sheet_index == 0 else (
                'Консультации специалистов' if 'консультац' in title.lower() else 'Дополнительные услуги')
            usd = (kzt / rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            entries.append({
                'sourceKey': f'nnmc-2026-08-paid-{sheet_index + 1}-{row_number}',
                'title': title,
                'category': category,
                'section': section_for(title, category),
                'tariffCode': re.sub(r'\s+', '', str(row[2] or '')) or None,
                'unit': re.sub(r'\s+', ' ', str(row[3] or 'услуга')).strip(),
                'priceKZT': float(kzt),
                'price': float(usd),
                'priceUSD': float(usd),
                'currency': 'USD',
                'exchangeRate': float(rate),
                'exchangeRateDate': rate_date,
                'sortOrder': len(entries) + 1,
                'isActive': True,
                'isFeatured': False,
                'i18n': {'ru': {'title': title, 'category': category}},
            })
    if len(entries) != 1882:
        raise ValueError(f'Expected 1882 paid services; found {len(entries)}')
    with open(output, 'w', encoding='utf-8') as handle:
        json.dump({'source': 'ПРЕЙСКУРАНТ с 24.08.xlsx', 'rateSource': 'https://nationalbank.kz/rss/rates_all.xml',
                   'rateDate': rate_date, 'kztPerUsd': float(rate), 'items': entries}, handle, ensure_ascii=False, separators=(',', ':'))
    print(f'Wrote {len(entries)} paid services to {output}')


if __name__ == '__main__':
    main()
