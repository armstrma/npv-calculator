import { formatNumberWithCommas, hasArithmeticOperator, parseNumericInput } from '../../lib/input.js';
import { formatMobileIrr, formatMobileNpv, formatPaybackDisplay, getAddPeriodLabel, getPeriodLabel, sanitizeFinancialValue, sanitizeRateValue } from '../../lib/calculation.js';
import { CurrencyExpressionInput } from '../input/CurrencyExpressionInput.jsx';
import { createFieldLocks } from '../../lib/linkSession.js';

const lockRowClass = (lock) => (lock.locked ? `locked-input-row locked-input-row-${lock.reason}` : '');

// Locked inputs show their reason ON the slider when hovered or focused.
const LockableSlider = ({ lock, children }) => (
  lock.locked ? (
    <div className={`locked-slider-wrap locked-control-tooltip locked-control-tooltip-${lock.reason}`} data-tooltip={lock.message} data-lock-reason={lock.reason}>
      {children}
    </div>
  ) : children
);

const LockIcon = ({ lock }) => (lock.locked ? (
  <span className={`field-lock-icon field-lock-icon-${lock.reason}`} role="img" aria-label={lock.message} title={lock.message}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  </span>
) : null);

export const QuickViewVariablePanel = ({
  sentiment,
  npvColor,
  npv,
  currency,
  irrAnalysis,
  payback,
  periodMode,
  rateBasisPrefix,
  appliedRateForAnalysis,
  appliedRateLabel,
  shouldShowAppliedRate,
  isDesktopViewport,
  initialInput,
  setInitialInput,
  initial,
  setInitial,
  insertQuickViewYearAfter,
  sliderBounds,
  showHurdleRate,
  rateInput,
  setRateInput,
  hurdleRate,
  setHurdleRate,
  discount,
  setDiscount,
  setShowHurdleRate,
  cashflows,
  cashflowInputs,
  setCashflowInputs,
  setCashflows,
  quickViewInputRefs,
  removeYear,
  addQuickViewYear,
  access,
  isFreeExamplePreview,
  resolveOperations,
  fieldLocks,
  canEditProjectStructure = true,
  periodStructureLock,
  isScenario = false,
  isFreeSharedView = false,
  onExitScenario,
}) => {
  const locks = fieldLocks || createFieldLocks({ isFreeExamplePreview, showHurdleRate });
  const initialLock = locks.initial();
  const rateLock = locks.rate();
  const hurdleToggleLock = locks.hurdleToggle();
  const structureLock = periodStructureLock || locks.periodStructure(cashflows.length);
  const shouldResolveInput = (value) => resolveOperations || !hasArithmeticOperator(value);

  return (
  <div className="quick-view-controls">
    <div className="mobile-metrics-header mobile-metrics-header-inline quick-view-metrics-header">
      <span className="mobile-sentiment-dot-wrap quick-view-sentiment-dot-wrap">
        <span className={`mobile-sentiment-dot sentiment-${sentiment.tone}`} aria-label={sentiment.label} title={sentiment.label} />
      </span>
      <span className={`quick-view-sentiment-word sentiment-${sentiment.tone}`}>{sentiment.label}</span>
      <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
      <span>IRR <strong>{formatMobileIrr(irrAnalysis)}</strong></span>
      <span>Payback <strong>{formatPaybackDisplay(payback, periodMode)}</strong></span>
    </div>
    {(isScenario || isFreeSharedView) && (
      <div className="scenario-banner" role="status">
        <span>
          {isScenario ? 'Scenario link: fields with a lock were set by the author.' : 'Shared model: Pro settings are read-only on the free plan.'}
        </span>
        {isScenario && onExitScenario && (
          <button type="button" className="scenario-banner-exit" onClick={onExitScenario}>Exit scenario</button>
        )}
      </div>
    )}
    <div className={`quick-view-row ${lockRowClass(initialLock)}`} data-lock-field="initial">
      <div className="quick-view-row-top quick-view-row-top-static">
        <span>Initial <LockIcon lock={initialLock} /></span>
        <span>{currency}</span>
        <CurrencyExpressionInput
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={initialInput}
          disabled={initialLock.locked}
          title={initialLock.locked ? initialLock.message : undefined}
          onChange={(e) => {
            const rawValue = e.target.value;
            setInitialInput(rawValue);
            const parsed = parseNumericInput(rawValue);
            if (parsed !== null) setInitial(sanitizeFinancialValue(parsed));
          }}
          onBlur={(e) => {
            const parsed = parseNumericInput(e.target.value);
            if (shouldResolveInput(e.target.value)) {
              setInitialInput(formatNumberWithCommas(parsed ?? initial));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (hasArithmeticOperator(e.currentTarget.value)) {
                if (resolveOperations) {
                  const parsed = parseNumericInput(e.currentTarget.value);
                  setInitialInput(formatNumberWithCommas(parsed ?? initial));
                  e.currentTarget.focus();
                }
                return;
              }

              insertQuickViewYearAfter(-1);
            }
          }}
        />
      </div>
      <LockableSlider lock={initialLock}>
        <input type="range" min={sliderBounds.initial.min} max={sliderBounds.initial.max} step={100} value={initial} disabled={initialLock.locked} onChange={(e) => {
          const nextInitial = Number(e.target.value);
          setInitial(nextInitial);
          setInitialInput(formatNumberWithCommas(nextInitial));
        }} className="slider-initial" />
      </LockableSlider>
    </div>
    <div className={`quick-view-row quick-view-row-compact ${lockRowClass(rateLock)}`} data-lock-field="rate">
      <div className="quick-view-row-top quick-view-row-top-discount quick-view-row-top-static">
        <span>{showHurdleRate ? `${rateBasisPrefix}Hurdle Rate` : `${rateBasisPrefix}Discount Rate`} <LockIcon lock={rateLock} /></span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={rateInput}
          disabled={rateLock.locked}
          title={rateLock.locked ? rateLock.message : undefined}
          onChange={(e) => {
            const rawValue = e.target.value;
            setRateInput(rawValue);
            const parsed = Number.parseFloat(rawValue.replace(/[^0-9.-]/g, ''));
            if (Number.isFinite(parsed)) {
              const sanitizedRate = sanitizeRateValue(parsed);
              if (showHurdleRate) setHurdleRate(sanitizedRate);
              else setDiscount(sanitizedRate);
            }
          }}
          onBlur={() => setRateInput((showHurdleRate ? hurdleRate : discount).toFixed(1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              insertQuickViewYearAfter(-1);
            }
          }}
        />
        <span>%</span>
        {access?.features?.hurdleRate && (
          <label className="quick-view-toggle" title={hurdleToggleLock.locked ? hurdleToggleLock.message : undefined}><input type="checkbox" checked={showHurdleRate} disabled={hurdleToggleLock.locked} onChange={(e) => setShowHurdleRate(e.target.checked)} /> Hurdle</label>
        )}
      </div>
      <LockableSlider lock={rateLock}>
        <input type="range" min={0} max={30} step={0.1} value={showHurdleRate ? hurdleRate : discount} disabled={rateLock.locked} onChange={(e) => {
          const nextRate = Number(e.target.value);
          if (showHurdleRate) setHurdleRate(nextRate);
          else setDiscount(nextRate);
          setRateInput(nextRate.toFixed(1));
        }} className={showHurdleRate ? 'slider-hurdle' : 'slider-discount'} />
      </LockableSlider>
      {shouldShowAppliedRate && (
        <div className="rate-derived-line">
          {appliedRateLabel}: {appliedRateForAnalysis.toFixed(2)}%
        </div>
      )}
    </div>
    {cashflows.map((cf, index) => {
      const cashflowLock = locks.cashflow(index);
      return (
      <div key={index} className={`quick-view-row quick-view-row-compact ${lockRowClass(cashflowLock)}`} data-lock-field={`cf${index}`}>
        <div className="quick-view-row-top">
          <span>{getPeriodLabel(periodMode, index + 1)} <LockIcon lock={cashflowLock} /></span>
          <span>{currency}</span>
          <CurrencyExpressionInput
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={cashflowInputs[index] ?? formatNumberWithCommas(cf)}
            disabled={cashflowLock.locked}
            title={cashflowLock.locked ? cashflowLock.message : undefined}
            onChange={(e) => {
              const nextInputs = [...cashflowInputs];
              nextInputs[index] = e.target.value;
              setCashflowInputs(nextInputs);
              const parsed = parseNumericInput(e.target.value);
              if (parsed !== null) {
                const updated = [...cashflows];
                updated[index] = sanitizeFinancialValue(parsed);
                setCashflows(updated);
              }
            }}
            onBlur={(e) => {
              const parsed = parseNumericInput(e.target.value);
              if (shouldResolveInput(e.target.value)) {
                setCashflowInputs((currentInputs) => {
                  const nextInputs = [...currentInputs];
                  nextInputs[index] = formatNumberWithCommas(parsed ?? cashflows[index] ?? 0);
                  return nextInputs;
                });
              }
            }}
            inputRef={(node) => {
              quickViewInputRefs.current[index] = node;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (hasArithmeticOperator(e.currentTarget.value)) {
                  if (resolveOperations) {
                    const parsed = parseNumericInput(e.currentTarget.value);
                    setCashflowInputs((currentInputs) => {
                      const nextInputs = [...currentInputs];
                      nextInputs[index] = formatNumberWithCommas(parsed ?? cashflows[index] ?? 0);
                      return nextInputs;
                    });
                    e.currentTarget.focus();
                  }
                  return;
                }

                insertQuickViewYearAfter(index);
              }
            }}
          />
          {!isFreeExamplePreview && canEditProjectStructure && <button type="button" aria-label={`Remove ${getPeriodLabel(periodMode, index + 1)}`} onClick={() => removeYear(index)}>×</button>}
        </div>
        <LockableSlider lock={cashflowLock}>
          <input type="range" min={sliderBounds.cashflow.min} max={sliderBounds.cashflow.max} step={100} value={cf} disabled={cashflowLock.locked} onChange={(e) => {
            const updated = [...cashflows];
            updated[index] = Number(e.target.value);
            setCashflows(updated);
            setCashflowInputs(updated.map(formatNumberWithCommas));
          }} className={`slider-cashflow-${index}`} />
        </LockableSlider>
      </div>
      );
    })}
    {structureLock.reason !== 'author' && (
      <button type="button" className="quick-view-add-space" onClick={addQuickViewYear}>
        {getAddPeriodLabel(periodMode, isDesktopViewport)}{(isFreeExamplePreview || structureLock.locked || cashflows.length >= access?.limits?.maxCashflowPeriods) && <span className="pro-texture-badge">PRO</span>}
      </button>
    )}
  </div>
  );
};
