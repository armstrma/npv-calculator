import { formatNumberWithCommas, parseNumericInput } from '../../lib/input.js';
import { formatMobileIrr, formatMobileNpv, formatPaybackDisplay, getAddPeriodLabel, getPeriodLabel, sanitizeFinancialValue, sanitizeRateValue } from '../../lib/calculation.js';

export const QuickViewVariablePanel = ({
  sentiment,
  npvColor,
  npv,
  currency,
  irrAnalysis,
  payback,
  periodMode,
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
}) => (
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
    <div className="quick-view-row">
      <div className="quick-view-row-top quick-view-row-top-static">
        <span>Initial</span>
        <span>{currency}</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={initialInput}
          onChange={(e) => {
            const rawValue = e.target.value;
            setInitialInput(rawValue);
            const parsed = parseNumericInput(rawValue);
            if (parsed !== null) setInitial(sanitizeFinancialValue(parsed));
          }}
          onBlur={() => setInitialInput(formatNumberWithCommas(initial))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              insertQuickViewYearAfter(-1);
            }
          }}
        />
      </div>
      <input type="range" min={sliderBounds.initial.min} max={sliderBounds.initial.max} step={100} value={initial} onChange={(e) => {
        const nextInitial = Number(e.target.value);
        setInitial(nextInitial);
        setInitialInput(formatNumberWithCommas(nextInitial));
      }} className="slider-initial" />
    </div>
    <div className="quick-view-row quick-view-row-compact">
      <div className="quick-view-row-top quick-view-row-top-discount quick-view-row-top-static">
        <span>{showHurdleRate ? 'Hurdle Rate' : 'Discount Rate'}</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={rateInput}
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
        <label className="quick-view-toggle"><input type="checkbox" checked={showHurdleRate} onChange={(e) => setShowHurdleRate(e.target.checked)} /> Hurdle</label>
      </div>
      <input type="range" min={0} max={30} step={0.1} value={showHurdleRate ? hurdleRate : discount} onChange={(e) => {
        const nextRate = Number(e.target.value);
        if (showHurdleRate) setHurdleRate(nextRate);
        else setDiscount(nextRate);
        setRateInput(nextRate.toFixed(1));
      }} className={showHurdleRate ? 'slider-hurdle' : 'slider-discount'} />
    </div>
    {cashflows.map((cf, index) => (
      <div key={index} className="quick-view-row quick-view-row-compact">
        <div className="quick-view-row-top">
          <span>{getPeriodLabel(periodMode, index + 1)}</span>
          <span>{currency}</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={cashflowInputs[index] ?? formatNumberWithCommas(cf)}
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
            onBlur={() => {
              const nextInputs = [...cashflowInputs];
              nextInputs[index] = formatNumberWithCommas(cashflows[index] ?? 0);
              setCashflowInputs(nextInputs);
            }}
            ref={(node) => {
              quickViewInputRefs.current[index] = node;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertQuickViewYearAfter(index);
              }
            }}
          />
          <button type="button" onClick={() => removeYear(index)}>×</button>
        </div>
        <input type="range" min={sliderBounds.cashflow.min} max={sliderBounds.cashflow.max} step={100} value={cf} onChange={(e) => {
          const updated = [...cashflows];
          updated[index] = Number(e.target.value);
          setCashflows(updated);
          setCashflowInputs(updated.map(formatNumberWithCommas));
        }} className={`slider-cashflow-${index}`} />
      </div>
    ))}
    <button type="button" className="quick-view-add-space" onClick={addQuickViewYear}>
      {getAddPeriodLabel(periodMode, isDesktopViewport)}
    </button>
  </div>
);
