import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { parseInline, withDocLang } from '../../config/legalMarkup'

/** Строка с **жирным** и [ссылками]: внутренние — через роутер, внешние — в новой вкладке. */
function Inline({ text, linkLang }) {
  return parseInline(text).map((part, index) => {
    if (part.type === 'bold') return <strong key={index} className='font-semibold text-slate-900'>{part.text}</strong>
    if (part.type === 'link') {
      const className = 'font-medium text-mt-accent underline decoration-mt-accent/40 underline-offset-2 hover:decoration-mt-accent'
      if (part.href.startsWith('/')) return <Link key={index} to={withDocLang(part.href, linkLang)} className={className}>{part.text}</Link>
      if (part.href.startsWith('#')) return <a key={index} href={part.href} className={className}>{part.text}</a>
      return <a key={index} href={part.href} target='_blank' rel='noopener noreferrer' className={className}>{part.text}</a>
    }
    return <Fragment key={index}>{part.text}</Fragment>
  })
}

/**
 * Текст правового документа из legalMarkup.parseLegalMarkup.
 * Длинные «____» в образцах форм переносятся (overflow-wrap: anywhere),
 * иначе на телефоне появляется горизонтальная прокрутка.
 */
function LegalDocumentBody({ blocks, lang, linkLang = null }) {
  return (
    <div lang={lang} className='legal-document text-[15px] leading-7 text-slate-700 [overflow-wrap:anywhere] sm:text-base'>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'part':
            return (
              <div key={block.id} id={block.id} className={`scroll-mt-28 ${index ? 'mt-14 border-t border-slate-200 pt-10 print:break-before-page print:border-0 print:pt-0' : ''} mb-6 text-center`}>
                <h2 className='text-xl font-semibold tracking-[-.01em] text-mt-ink sm:text-2xl'>{block.lines[0]}</h2>
                {block.lines.slice(1).map((line) => (
                  <p key={line} className='mt-1.5 text-base font-medium text-slate-600 sm:text-lg'>{line}</p>
                ))}
              </div>
            )
          case 'section':
            return <h3 key={block.id} id={block.id} className='mb-3 mt-9 scroll-mt-28 text-lg font-semibold text-mt-ink'>{block.text}</h3>
          case 'subheading':
            return <h4 key={index} className='mb-2 mt-5 font-semibold text-slate-900'><Inline linkLang={linkLang} text={block.text} /></h4>
          case 'list':
            return (
              <ul key={index} className='my-3 list-disc space-y-1.5 pl-6 marker:text-slate-400'>
                {block.items.map((item, itemIndex) => <li key={itemIndex}><Inline linkLang={linkLang} text={item} /></li>)}
              </ul>
            )
          case 'note':
            return (
              <aside key={index} className='my-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-800'>
                {block.lines.map((line, lineIndex) => <p key={lineIndex} className={lineIndex ? 'mt-1' : 'font-semibold'}><Inline linkLang={linkLang} text={line} /></p>)}
              </aside>
            )
          case 'sample':
            return (
              <p key={index} className='-mt-3 mb-6 text-center'>
                <span className='inline-flex rounded-full border border-slate-300 px-3 py-0.5 text-xs font-semibold uppercase tracking-[.14em] text-slate-500'>{block.text}</span>
              </p>
            )
          case 'table':
            return (
              <div key={index} className='my-4 overflow-x-auto rounded-xl border border-slate-200'>
                <table className='w-full min-w-[480px] border-collapse text-sm'>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? 'bg-slate-50 font-medium text-slate-900' : ''}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className='h-10 border-b border-r border-slate-200 px-3 py-2 align-top last:border-r-0'><Inline linkLang={linkLang} text={cell} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return block.caption
              ? <p key={index} className='-mt-1 mb-3 text-center text-sm text-slate-500'><Inline linkLang={linkLang} text={block.text} /></p>
              // Абзацы с пропусками «____» не выравниваем по ширине — иначе между словами огромные зазоры.
              : <p key={index} className={`my-3 [hyphens:auto] ${block.text.includes('___') ? '' : 'sm:text-justify'}`}><Inline linkLang={linkLang} text={block.text} /></p>
        }
      })}
    </div>
  )
}

export default LegalDocumentBody
