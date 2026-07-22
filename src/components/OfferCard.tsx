import { useState } from 'react'
import {
  formatEuro,
  validity,
  savings,
  priceInsight,
  type GroupedOffer,
  type PriceInsight,
} from '../lib/offers'
import { AlarmButton } from './AlarmButton'

/** Textbausteine je Preisniveau (relativ zur eigenen Historie des Produkts). */
const INSIGHT_COPY: Record<PriceInsight['level'], { label: string; icon: 'bolt' | 'trend' }> = {
  best: { label: 'Bestpreis', icon: 'bolt' },
  good: { label: 'Günstiger als üblich', icon: 'trend' },
  normal: { label: 'Üblicher Preis', icon: 'trend' },
  high: { label: 'Über üblichem Preis', icon: 'trend' },
}

/** Badge-Farben je Preisniveau. */
const INSIGHT_BADGE: Record<PriceInsight['level'], string> = {
  best: 'text-white bg-accent border-accent',
  good: 'text-good bg-good-tint border-[color-mix(in_srgb,var(--good)_30%,transparent)]',
  normal: 'text-muted bg-surface-2 border-border',
  high: 'text-warn-ink bg-warn-tint border-[color-mix(in_srgb,var(--warn-ink)_30%,transparent)]',
}

/** Sparkline-Farbe (currentColor) je Preisniveau. */
const INSIGHT_SPARK: Record<PriceInsight['level'], string> = {
  best: 'text-accent',
  good: 'text-good',
  normal: 'text-muted',
  high: 'text-warn-ink',
}

const VALID_VARIANT = {
  base: 'bg-surface-2 text-muted border-border',
  ending: 'bg-warn-tint text-warn-ink border-[color-mix(in_srgb,var(--warn-ink)_30%,transparent)]',
  upcoming: 'bg-accent-tint text-accent-strong border-[color-mix(in_srgb,var(--accent-strong)_30%,transparent)]',
}

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ArrowIcon = () => (
  <svg
    className="transition-transform duration-150 group-hover:translate-x-[3px]"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
)

const BoltIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
)

const TrendIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Winzige €/L-Verlaufslinie; der jüngste (aktuelle) Punkt ist hervorgehoben. */
function Sparkline({ trend, colorClass }: { trend: PriceInsight['trend']; colorClass: string }) {
  const w = 60
  const h = 20
  const pad = 3
  const values = trend.map((t) => t.perLiter)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) =>
    trend.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (trend.length - 1)
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad)
  const line = trend.map((t, i) => `${x(i)},${y(t.perLiter)}`).join(' ')
  const last = trend[trend.length - 1]
  return (
    <svg
      className={`flex-none ml-auto overflow-visible ${colorClass}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(trend.length - 1)} cy={y(last.perLiter)} r="2.4" fill="currentColor" />
    </svg>
  )
}

interface Props {
  offer: GroupedOffer
  isBest: boolean
  view?: 'grid' | 'list'
}

export function OfferCard({ offer, isBest, view = 'grid' }: Props) {
  const { label: validLabel, ending, upcoming } = validity(offer)
  const saved = savings(offer)
  const insight = priceInsight(offer)
  const extraVariants = offer.variantCount - 1
  const isMulti = offer.unitCount > 1
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = offer.imageUrl && !imgFailed
  const alt = `${offer.brand} ${offer.title}, Angebot bei ${offer.supermarket}`

  const validVariant = ending ? VALID_VARIANT.ending : upcoming ? VALID_VARIANT.upcoming : VALID_VARIANT.base

  // Geteilte Bausteine für Kachel- und Listenansicht.
  const insightBlock = insight && (
    <div
      className="flex flex-col gap-[5px] text-[0.76rem]"
      aria-label={`Preisniveau: ${INSIGHT_COPY[insight.level].label}. Typischer Grundpreis ${formatEuro(insight.median)} pro Liter über ${insight.dayCount} erfasste Tage.`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex-none inline-flex items-center gap-[5px] font-bold rounded-[7px] px-2 py-[3px] border ${INSIGHT_BADGE[insight.level]}`}>
          {INSIGHT_COPY[insight.level].icon === 'bolt' ? <BoltIcon /> : <TrendIcon />}
          {INSIGHT_COPY[insight.level].label}
        </span>
        <Sparkline trend={insight.trend} colorClass={INSIGHT_SPARK[insight.level]} />
      </div>
      <span className="text-muted font-mono tabular-nums whitespace-nowrap overflow-hidden text-ellipsis" aria-hidden="true">
        {insight.level === 'best' ? 'günstigster erfasster Preis' : `⌀ ${formatEuro(insight.median)}/L · ${insight.dayCount} Tage`}
      </span>
    </div>
  )

  const validBadge = (
    <span className={`inline-flex items-center gap-1.5 self-start text-[0.76rem] font-semibold rounded-[7px] px-[9px] py-1 border ${validVariant}`}>
      <ClockIcon />
      {validLabel}
    </span>
  )

  // --- Listenansicht: kompakte horizontale Zeile ---------------------------
  if (view === 'list') {
    return (
      <li>
        <article
          className="offer-card group relative flex flex-col gap-2 bg-surface border border-border rounded-card p-3 shadow-card transition-[border-color] duration-150 hover:border-border-strong focus-within:border-focus"
          aria-label={alt}
        >
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 flex-none rounded-lg bg-surface-2 border border-border grid place-items-center overflow-hidden">
              {showImage ? (
                <img src={offer.imageUrl!} alt={alt} loading="lazy" width="56" height="56" className="w-full h-full object-contain p-1" onError={() => setImgFailed(true)} />
              ) : (
                <span className="w-6 h-9 rounded" style={{ background: offer.marketColor }} role="img" aria-label={alt} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[0.68rem] tracking-[0.08em] uppercase text-accent-strong font-bold">{offer.brand}</span>
                <span className="text-[0.66rem] font-bold text-muted border border-border-strong rounded px-1.5 py-px">{offer.market}</span>
                {isBest && (
                  <span className="inline-flex items-center gap-[3px] bg-good text-white text-[0.6rem] font-bold px-1.5 py-px rounded">
                    <CheckIcon />
                    Bester €/L
                  </span>
                )}
              </div>
              <h3 className="text-[0.95rem] leading-tight truncate mt-0.5">{offer.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {validBadge}
                {saved && (
                  <span className="font-mono font-bold tabular-nums text-good text-[0.72rem] bg-good-tint border border-[color-mix(in_srgb,var(--good)_30%,transparent)] rounded px-1.5 py-px">
                    −{saved.percent}&nbsp;%
                  </span>
                )}
              </div>
            </div>

            <div className="flex-none text-right">
              <div className="font-mono text-[1.1rem] font-bold tracking-[-0.02em] tabular-nums text-ink whitespace-nowrap">
                {formatEuro(offer.perUnit)}
                <span className="text-[0.62rem] font-medium text-muted"> {isMulti ? '/ Dose' : ''}</span>
              </div>
              <div className={`font-mono text-[0.82rem] font-bold tabular-nums whitespace-nowrap ${isBest ? 'text-good' : 'text-muted'}`}>
                {offer.perLiter != null ? `${formatEuro(offer.perLiter)}/L` : '—'}
              </div>
            </div>

            {offer.url && (
              <a
                data-cta=""
                className="flex-none inline-flex items-center gap-1 text-accent-strong text-[0.82rem] font-[650] no-underline after:content-[''] after:absolute after:inset-0 after:rounded-card group-hover:text-accent focus-visible:outline-none"
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Angebot ansehen: ${alt} (öffnet in neuem Tab)`}
              >
                <span className="hidden sm:inline">Angebot</span>
                <ArrowIcon />
              </a>
            )}
          </div>

          {(insightBlock || offer.url) && (
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              {insightBlock}
              <AlarmButton offer={offer} />
            </div>
          )}
        </article>
      </li>
    )
  }

  // --- Kachelansicht -------------------------------------------------------
  return (
    <li className="flex">
      <article
        className="offer-card group relative flex flex-col h-full w-full bg-surface border border-border rounded-card overflow-hidden shadow-card transition-[transform,border-color] duration-150 hover:-translate-y-[3px] hover:border-border-strong focus-within:border-focus"
        aria-label={alt}
      >
        <div className="relative aspect-[5/4] bg-surface-2 grid place-items-center border-b border-border overflow-hidden">
          <span className="absolute left-2.5 top-2.5 text-[0.72rem] font-bold bg-surface text-ink border border-border-strong rounded-[7px] px-2 py-[3px]">
            {offer.market}
          </span>
          {isBest && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-[5px] bg-good text-white text-[0.7rem] font-bold tracking-[0.03em] px-[9px] py-1 rounded-[7px]">
              <CheckIcon />
              Bester €/L
            </span>
          )}
          {showImage ? (
            <img
              src={offer.imageUrl!}
              alt={alt}
              loading="lazy"
              width="200"
              height="160"
              className="w-full h-full object-contain p-3"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="can" style={{ background: offer.marketColor }} role="img" aria-label={alt} />
          )}
        </div>

        <div className="pt-[14px] px-[15px] pb-4 flex flex-col gap-1 flex-1">
          <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-accent-strong font-bold">
            {offer.brand}
          </span>
          <h3 className="text-base leading-[1.25] tracking-[-0.01em]">{offer.title}</h3>
          {extraVariants > 0 && (
            <span
              className="self-start mt-[5px] text-[0.76rem] text-muted cursor-default"
              title={offer.variantTitles.join(', ')}
              aria-label={`${offer.variantCount} Sorten zum gleichen Preis: ${offer.variantTitles.join(', ')}`}
            >
              {offer.variantCount} Sorten · gleicher Preis
            </span>
          )}

          <div className="flex items-baseline gap-3.5 mt-auto pt-3">
            <span className="flex flex-col gap-px flex-1 min-w-0">
              <span className="font-mono text-[1.45rem] font-bold tracking-[-0.02em] tabular-nums text-ink whitespace-nowrap">
                {formatEuro(offer.perUnit)}
              </span>
              <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {isMulti ? 'je Dose' : offer.unitLabel}
              </span>
            </span>
            <span className="flex flex-col gap-px flex-1 min-w-0 items-end text-right">
              {offer.perLiter != null ? (
                <>
                  <span
                    className={`font-mono text-[1.45rem] font-bold tracking-[-0.02em] tabular-nums whitespace-nowrap ${
                      isBest ? 'text-good' : 'text-ink'
                    }`}
                  >
                    {formatEuro(offer.perLiter)}
                    <span className="text-[0.9rem] text-muted font-bold">/L</span>
                  </span>
                  <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    pro Liter
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-[1.45rem] font-bold tabular-nums text-ink" aria-label="unbekannt">
                    —
                  </span>
                  <span className="font-mono text-[0.66rem] tracking-[0.06em] uppercase text-muted">Grundpreis</span>
                </>
              )}
            </span>
          </div>
          {isMulti && (
            <p className="mt-2 font-mono text-[0.74rem] tabular-nums text-muted">
              {offer.unitLabel} · {formatEuro(offer.price)} gesamt
            </p>
          )}

          {saved && (
            <p className="flex items-center gap-2 mt-2.5 text-[0.8rem]">
              <span className="flex-none font-mono font-bold tabular-nums text-good bg-good-tint border border-[color-mix(in_srgb,var(--good)_30%,transparent)] rounded-[7px] px-2 py-[3px]">
                <span aria-hidden="true">−{saved.percent}&nbsp;%</span>
                <span className="visually-hidden">{saved.percent} Prozent gespart</span>
              </span>
              <span className="text-muted font-mono tabular-nums">
                <span className="visually-hidden">Sie sparen {formatEuro(saved.amount)} gegenüber vorher {formatEuro(offer.oldPrice!)}</span>
                <span aria-hidden="true">
                  {formatEuro(saved.amount)} gespart · <s className="text-muted">{formatEuro(offer.oldPrice!)}</s>
                </span>
              </span>
            </p>
          )}

          {insightBlock && <div className="mt-2.5">{insightBlock}</div>}

          <div className="mt-3">{validBadge}</div>

          <AlarmButton offer={offer} />

          {offer.url && (
            <a
              data-cta=""
              className="mt-3.5 pt-3 border-t border-border text-accent-strong text-[0.84rem] font-[650] no-underline inline-flex items-center gap-1.5 after:content-[''] after:absolute after:inset-0 after:rounded-card group-hover:text-accent focus-visible:outline-none"
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Angebot ansehen: ${alt} (öffnet in neuem Tab)`}
            >
              Zum Angebot bei {offer.market}
              <ArrowIcon />
            </a>
          )}
        </div>
      </article>
    </li>
  )
}
