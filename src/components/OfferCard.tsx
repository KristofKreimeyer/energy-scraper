import { useState } from 'react'
import { formatEuro, validity, savings, type GroupedOffer } from '../lib/offers'

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ArrowIcon = () => (
  <svg className="cta-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
)

interface Props {
  offer: GroupedOffer
  isBest: boolean
}

export function OfferCard({ offer, isBest }: Props) {
  const { label: validLabel, ending, upcoming } = validity(offer)
  const saved = savings(offer)
  const extraVariants = offer.variantCount - 1
  const isMulti = offer.unitCount > 1
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = offer.imageUrl && !imgFailed
  const alt = `${offer.brand} ${offer.title}, Angebot bei ${offer.supermarket}`

  return (
    <li>
      <article className={`card${isBest ? ' is-best' : ''}`} aria-label={alt}>
        <div className="card-media">
          <span className="market-badge">{offer.market}</span>
          {isBest && (
            <span className="best-ribbon">
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
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="can" style={{ background: offer.marketColor }} role="img" aria-label={alt} />
          )}
        </div>

        <div className="card-body">
          <span className="brand-name">{offer.brand}</span>
          <h3>{offer.title}</h3>
          {extraVariants > 0 && (
            <span
              className="variants"
              title={offer.variantTitles.join(', ')}
              aria-label={`${offer.variantCount} Sorten zum gleichen Preis: ${offer.variantTitles.join(', ')}`}
            >
              {offer.variantCount} Sorten · gleicher Preis
            </span>
          )}

          <div className="price-row">
            <span className="anchor">
              <span className="anchor-val">{formatEuro(offer.perUnit)}</span>
              <span className="anchor-label">{isMulti ? 'je Dose' : offer.unitLabel}</span>
            </span>
            <span className="anchor liter">
              {offer.perLiter != null ? (
                <>
                  <span className="anchor-val">
                    {formatEuro(offer.perLiter)}
                    <span className="per">/L</span>
                  </span>
                  <span className="anchor-label">pro Liter</span>
                </>
              ) : (
                <>
                  <span className="anchor-val" aria-label="unbekannt">
                    —
                  </span>
                  <span className="anchor-label">Grundpreis</span>
                </>
              )}
            </span>
          </div>
          {isMulti && (
            <p className="pack-note">
              {offer.unitLabel} · {formatEuro(offer.price)} gesamt
            </p>
          )}

          {saved && (
            <p className="saving">
              <span className="saving-badge">
                <span aria-hidden="true">−{saved.percent}&nbsp;%</span>
                <span className="visually-hidden">{saved.percent} Prozent gespart</span>
              </span>
              <span className="saving-detail">
                <span className="visually-hidden">Sie sparen {formatEuro(saved.amount)} gegenüber vorher {formatEuro(offer.oldPrice!)}</span>
                <span aria-hidden="true">
                  {formatEuro(saved.amount)} gespart · <s>{formatEuro(offer.oldPrice!)}</s>
                </span>
              </span>
            </p>
          )}

          <span className={`valid${ending ? ' ending' : ''}${upcoming ? ' upcoming' : ''}`}>
            <ClockIcon />
            {validLabel}
          </span>

          {offer.url && (
            <a
              className="card-cta"
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
