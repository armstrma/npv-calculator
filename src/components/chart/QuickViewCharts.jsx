import { useState } from 'react';
import { Area, Bar, BarChart, Cell, ComposedChart, Label, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipMotionProps, formatCompactCurrency, formatPaybackDisplay, getIrrDisplay, getIrrIssueDetail, getIrrIssueLabel, getPeriodLabel, getPeriodMeta, tooltipShellStyle } from '../../lib/calculation.js';

const formatTableCurrencyValue = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const NpvTooltip = ({ active, payload, label, currency, showSensitivity, sensitivityPercent, periodMode, rateBasis }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  const baseNpv = typeof row.npv === 'number' ? row.npv : null;
  const highNpv = typeof row.high_npv === 'number' ? row.high_npv : null;
  const lowNpv = typeof row.low_npv === 'number' ? row.low_npv : null;
  const periodMeta = getPeriodMeta(periodMode);
  const shouldShowAppliedRate = periodMode !== 'years';

  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        {rateBasis === 'annual' && shouldShowAppliedRate ? 'Annual discount' : 'Discount'}: <strong>{Number(label).toFixed(1)}%</strong>
      </div>
      {shouldShowAppliedRate && typeof row.appliedRate === 'number' && <div>{rateBasis === 'annual' ? `Applied ${periodMeta.appliedLabel}: ${row.appliedRate.toFixed(2)}%` : `Cash flows: ${periodMeta.appliedLabel}`}</div>}
      {baseNpv !== null && <div style={{ color: baseNpv >= 0 ? '#86efac' : '#fca5a5' }}>NPV: {currency}{baseNpv.toFixed(2)}</div>}
      {showSensitivity && highNpv !== null && <div style={{ color: '#c4b5fd' }}>High (+{sensitivityPercent}% CF): {currency}{highNpv.toFixed(2)}</div>}
      {showSensitivity && lowNpv !== null && <div style={{ color: '#f9a8d4' }}>Low (-{sensitivityPercent}% CF): {currency}{lowNpv.toFixed(2)}</div>}
    </div>
  );
};

export const CashflowTooltip = ({ active, payload, label, currency, showSensitivity, sensitivityPercent }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};

  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        <strong>{label}</strong>
      </div>
      <div style={{ color: Number(row.value) >= 0 ? '#93c5fd' : '#fca5a5' }}>Cash Flow: {currency}{Number(row.value || 0).toFixed(2)}</div>
      {row.pvValue !== null && row.pvValue !== undefined && <div style={{ color: '#c4b5fd' }}>PV Cash Flow: {currency}{Number(row.pvValue).toFixed(2)}</div>}
      {showSensitivity && row.pvLow !== null && row.pvLow !== undefined && row.pvHigh !== null && row.pvHigh !== undefined && (
        <div style={{ color: '#ddd6fe' }}>
          PV Sensitivity Range (±{sensitivityPercent}%): {currency}{Number(row.pvLow).toFixed(2)} → {currency}{Number(row.pvHigh).toFixed(2)}
        </div>
      )}
      {row.cumulative !== null && row.cumulative !== undefined && <div style={{ color: '#60a5fa' }}>Cash Cumulative: {currency}{Number(row.cumulative).toFixed(2)}</div>}
      {row.pvCumulative !== null && row.pvCumulative !== undefined && <div style={{ color: '#a78bfa' }}>PV Cumulative: {currency}{Number(row.pvCumulative).toFixed(2)}</div>}
    </div>
  );
};

export const MarginalSensitivityTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};

  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        <strong>{label}</strong>
      </div>
      <div style={{ color: Number(row.impactPerDollar) >= 0 ? '#86efac' : '#fca5a5' }}>
        NPV impact per $1: {currency}{Number(row.impactPerDollar || 0).toFixed(2)}
      </div>
      {row.note && <div style={{ color: '#d1d5db', marginTop: 4 }}>{row.note}</div>}
    </div>
  );
};

const LockedValue = () => <span className="locked-value-blur" aria-label="Locked value" />;

export const QuickViewCharts = ({
  currency,
  showSensitivity,
  sensitivityPercent,
  setShowSensitivity,
  setSensitivityPercent,
  discountData,
  barData,
  marginalSensitivityData,
  sensitivityData,
  irrAnalysis,
  discount,
  appliedDiscountRate,
  showHurdleRate,
  hurdleRate,
  appliedHurdleRate,
  rateBasis,
  rateBasisLabel,
  shouldShowAppliedRate,
  cashflows,
  pvBreakEvenInfo,
  sentiment,
  npv,
  viabilityPass,
  spread,
  spreadStatus,
  downsideIrr,
  fragilityPass,
  discountRateForAnalysis,
  payback,
  breakEvenCashflowUpliftPct,
  maxInitialAtNpvZero,
  periodMode,
  isDesktopViewport,
  access,
  canViewAdvancedExample,
  onRequestUpgrade,
}) => {
  const [activeChart, setActiveChart] = useState('npv');
  const [activeAnalysisCard, setActiveAnalysisCard] = useState('viability');
  const activeView = activeChart === 'cashflows' && cashflows.length === 0 ? 'npv' : activeChart;
  const irrIssueLabel = getIrrIssueLabel(irrAnalysis);
  const irrIssueDetail = getIrrIssueDetail(irrAnalysis);
  const hasNonNumericIrr = irrAnalysis.status !== 'valid';
  const downsideIrrIssueDetail = getIrrIssueDetail(downsideIrr);
  const hasNonNumericDownsideIrr = downsideIrr.status !== 'valid';
  const downsideSpread = downsideIrr.status === 'valid' ? downsideIrr.value - discountRateForAnalysis : Number.NaN;
  const formatSignedPercent = (value) => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A';
  const viabilityFactor = `NPV: ${formatCompactCurrency(npv, currency)}`;
  const spreadFactor = `Spread: ${formatSignedPercent(spread)}`;
  const durabilityFactor = `Downside: ${formatSignedPercent(downsideSpread)}`;
  const activeAnalysisFactor = activeAnalysisCard === 'standard'
    ? spreadFactor
    : activeAnalysisCard === 'fragility'
      ? durabilityFactor
      : viabilityFactor;
  const sensitivityLocked = !access?.features?.sensitivityAnalysis && !canViewAdvancedExample;
  const deeperAnalysisLocked = !access?.features?.sensitivityAnalysis && !canViewAdvancedExample;
  const cashflowsLocked = !access?.hasPro && !canViewAdvancedExample;
  const shouldShowAnalysisSensitivity = access?.features?.sensitivityAnalysis || canViewAdvancedExample || sensitivityLocked;
  const handleLockedFeature = (reason) => {
    if (onRequestUpgrade) onRequestUpgrade(reason);
  };
  const handleSensitivityCardKeyDown = (event) => {
    if (!sensitivityLocked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleLockedFeature('Sensitivity analysis is locked on the free tier. Upgrade to see how NPV moves across cash-flow swings.');
    }
  };

  return (
    <>
      <div className="quick-view-stage-toolbar" role="tablist" aria-label="Quick view charts">
        <button type="button" className={`quick-view-stage-tab ${activeView === 'npv' ? 'active' : ''}`} onClick={() => setActiveChart('npv')}>
          NPV Curve
        </button>
        <button type="button" className={`quick-view-stage-tab ${activeView === 'cashflows' ? 'active' : ''}`} onClick={() => {
          if (cashflowsLocked) {
            handleLockedFeature('The cash-flow recovery chart is locked on the free tier. Upgrade to see raw versus discounted recovery over the full horizon.');
            return;
          }
          setActiveChart('cashflows');
        }}>
          Cash Flows{cashflowsLocked && <span className="pro-texture-badge">PRO</span>}
        </button>
        <button type="button" className={`quick-view-stage-tab ${activeView === 'impact' ? 'active' : ''}`} onClick={() => {
          setActiveChart('impact');
        }}>
          $1 Impact
        </button>
        <button type="button" className={`quick-view-stage-tab ${activeView === 'analysis' ? 'active' : ''}`} onClick={() => setActiveChart('analysis')}>
          Analyze
        </button>
      </div>

      <div className={`quick-view-stage-chart ${activeView === 'analysis' ? 'quick-view-stage-chart-scrollable' : ''}`}>
        {activeView === 'npv' && (
          <>
            <div className="quick-view-stage-heading quick-view-stage-heading-with-control">
              <h2>NPV vs {rateBasis === 'annual' && shouldShowAppliedRate ? 'Annual ' : ''}Discount Rate</h2>
              <label className="quick-view-stage-control">
                <span>Sensitivity</span>
                <select className={sensitivityLocked ? 'locked-select-blur' : ''} value={showSensitivity ? String(sensitivityPercent) : sensitivityLocked ? 'locked' : 'off'} onChange={(e) => {
                  if (sensitivityLocked) {
                    handleLockedFeature('Sensitivity analysis is locked on the free tier. Upgrade to see downside and upside cash-flow swings.');
                    return;
                  }
                  const value = e.target.value;
                  if (value === 'off') {
                    return;
                  }
                  if (setShowSensitivity) setShowSensitivity(true);
                  setSensitivityPercent(Number(value));
                }}>
                  {sensitivityLocked && <option value="locked">••••</option>}
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </label>
            </div>
            <div className="quick-view-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={discountData} margin={{ top: 14, right: 12, left: 0, bottom: 18 }}>
                  <XAxis dataKey="discount" type="number" domain={[0, 30]} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip {...chartTooltipMotionProps} cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }} content={<NpvTooltip currency={currency} showSensitivity={showSensitivity} sensitivityPercent={sensitivityPercent} periodMode={periodMode} rateBasis={rateBasis} />} />
                  <Line type="monotone" dataKey="npv_pos" stroke="green" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="npv_neg" stroke="red" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                  {irrAnalysis.roots.map((root) => (
                    <ReferenceLine key={root} x={root} stroke="#7dd3fc" strokeDasharray="3 3" label={<Label value={`IRR ${root.toFixed(2)}%`} position="insideTopRight" fill="#7dd3fc" dx={-6} dy={-4} fontSize={11} />} />
                  ))}
                  {!showHurdleRate && (
                    <ReferenceLine x={discount} stroke="#c084fc" strokeDasharray="3 3" label={<Label value={`Disc ${discount.toFixed(1)}%`} position="insideBottom" fill="#c084fc" dy={-2} fontSize={11} />} />
                  )}
                  {showHurdleRate && (
                    <ReferenceLine x={hurdleRate} stroke="#22c55e" strokeDasharray="6 4" label={<Label value={`Hurdle ${hurdleRate.toFixed(1)}%`} position="insideBottom" fill="#22c55e" dy={-2} fontSize={11} />} />
                  )}
                  {showSensitivity && (
                    <>
                      <Line type="monotone" dataKey="high_npv_pos" stroke="#a78bfa" dot={false} activeDot={{ r: 3 }} strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} />
                      <Line type="monotone" dataKey="high_npv_neg" stroke="#ef4444" dot={false} activeDot={{ r: 3 }} strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} />
                      <Line type="monotone" dataKey="low_npv_pos" stroke="#f9a8d4" dot={false} activeDot={{ r: 3 }} strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} />
                      <Line type="monotone" dataKey="low_npv_neg" stroke="#dc2626" dot={false} activeDot={{ r: 3 }} strokeWidth={3} strokeDasharray="4 3" isAnimationActive={false} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeView === 'cashflows' && (
          <>
            <div className="quick-view-stage-heading quick-view-stage-heading-with-control">
              <h2>Cash Flows</h2>
              <label className="quick-view-stage-control">
                <span>Sensitivity</span>
                <select className={sensitivityLocked ? 'locked-select-blur' : ''} value={showSensitivity ? String(sensitivityPercent) : sensitivityLocked ? 'locked' : 'off'} onChange={(e) => {
                  if (sensitivityLocked) {
                    handleLockedFeature('Sensitivity analysis is locked on the free tier. Upgrade to see downside and upside cash-flow swings.');
                    return;
                  }
                  const value = e.target.value;
                  if (value === 'off') {
                    return;
                  }
                  if (setShowSensitivity) setShowSensitivity(true);
                  setSensitivityPercent(Number(value));
                }}>
                  {sensitivityLocked && <option value="locked">••••</option>}
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </label>
            </div>
            <div className="quick-view-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={barData} barGap={-18} barCategoryGap="24%">
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={2} />
                  <Tooltip {...chartTooltipMotionProps} content={<CashflowTooltip currency={currency} showSensitivity={showSensitivity} sensitivityPercent={sensitivityPercent} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} payload={[{ value: 'PV Cumulative', type: 'line', color: '#a78bfa' }, { value: 'Cash Cumulative', type: 'line', color: '#60a5fa' }]} />
                  {cashflows.length > 0 && (
                    <>
                      {pvBreakEvenInfo.firstPositiveLabel ? (
                        <>
                          <ReferenceArea x1="Initial" x2={pvBreakEvenInfo.lastNegativeLabel || 'Initial'} fill="#ef4444" fillOpacity={0.08} ifOverflow="hidden" />
                          <ReferenceArea x1={pvBreakEvenInfo.firstPositiveLabel} x2={getPeriodLabel(periodMode, cashflows.length)} fill="#22c55e" fillOpacity={0.08} ifOverflow="hidden" />
                        </>
                      ) : (
                        <ReferenceArea x1="Initial" x2={getPeriodLabel(periodMode, cashflows.length)} fill="#ef4444" fillOpacity={0.08} ifOverflow="hidden" />
                      )}
                    </>
                  )}
                  <Bar dataKey="value" name="Cash Flow" legendType="none" fillOpacity={0.35} barSize={18}>
                    {barData.map((entry, index) => {
                      const isNpv = entry.name === 'NPV';
                      const fill = isNpv ? (entry.value >= 0 ? '#22c55e' : '#ef4444') : '#3b82f6';
                      return <Cell key={`quick-cash-cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                  <Bar dataKey="pvValue" name="PV Cash Flow" legendType="none" barSize={10}>
                    {barData.map((entry, index) => {
                      if (entry.pvValue === null || entry.pvValue === undefined) return <Cell key={`quick-pv-cell-${index}`} fill="transparent" />;
                      const isNpv = entry.name === 'NPV';
                      const fill = isNpv ? (entry.value >= 0 ? '#16a34a' : '#dc2626') : '#8b5cf6';
                      return <Cell key={`quick-pv-cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                  {showSensitivity && (
                    <>
                      <Area type="monotone" dataKey="cumulativeLow" stackId="cashBand" legendType="none" stroke="none" fill="transparent" isAnimationActive={false} />
                      <Area type="monotone" dataKey="cumulativeRange" stackId="cashBand" legendType="none" stroke="none" fill="#60a5fa" fillOpacity={0.16} isAnimationActive={false} />
                      <Area type="monotone" dataKey="pvCumulativeLow" stackId="pvBand" legendType="none" stroke="none" fill="transparent" isAnimationActive={false} />
                      <Area type="monotone" dataKey="pvCumulativeRange" stackId="pvBand" legendType="none" stroke="none" fill="#a78bfa" fillOpacity={0.16} isAnimationActive={false} />
                    </>
                  )}
                  <Line type="monotone" dataKey="cumulative" name="Cash Cumulative" stroke="#60a5fa" dot={false} strokeWidth={2} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="pvCumulative" name="PV Cumulative" stroke="#a78bfa" dot={false} strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeView === 'impact' && (
          <>
            <div className="quick-view-stage-heading">
              <h2>NPV Impact per $1 Change</h2>
            </div>
            <div className="quick-view-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginalSensitivityData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${currency}${Number(v).toFixed(2)}`} tick={{ fontSize: 11 }} width={60} />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={2} />
                  <Tooltip {...chartTooltipMotionProps} content={<MarginalSensitivityTooltip currency={currency} />} />
                  <Bar dataKey="impactPerDollar" barSize={22} radius={[4, 4, 0, 0]}>
                    {marginalSensitivityData.map((entry, index) => (
                      <Cell key={`quick-marginal-${index}`} fill={entry.impactPerDollar >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeView === 'analysis' && (
          <>
            <div className="quick-view-stage-heading quick-view-stage-heading-with-control">
              <h2>Analyze</h2>
              <label className="quick-view-stage-control">
                <span>Sensitivity</span>
                <select className={sensitivityLocked ? 'locked-select-blur' : ''} value={showSensitivity ? String(sensitivityPercent) : sensitivityLocked ? 'locked' : 'off'} onChange={(e) => {
                  if (sensitivityLocked) {
                    handleLockedFeature('Sensitivity analysis is locked on the free tier. Upgrade to see downside and upside cash-flow swings.');
                    return;
                  }
                  const value = e.target.value;
                  if (value === 'off') {
                    return;
                  }
                  if (setShowSensitivity) setShowSensitivity(true);
                  setSensitivityPercent(Number(value));
                }}>
                  {sensitivityLocked && <option value="locked">••••</option>}
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </label>
            </div>
            <div className="quick-view-analysis-panel quick-view-analysis-two-column quick-view-analysis-panel-compact">
              <section className="quick-view-analysis-column quick-view-analysis-summary">
                <div className="quick-view-analysis-headline">
                  <span className="details-metric-label">Decision Summary</span>
                  <strong className={`quick-view-analysis-decision sentiment-${sentiment.tone}`}>{sentiment.label}</strong>
                </div>
                <div className="quick-view-analysis-rules-list">
                  <button type="button" className={`quick-view-analysis-rule ${activeAnalysisCard === 'viability' ? 'active' : ''} ${viabilityPass ? 'pass' : 'fail'}`} onClick={() => setActiveAnalysisCard('viability')}>
                    <span>Creates Value</span>
                    <span className="quick-view-analysis-rule-result">{isDesktopViewport && <span className="quick-view-analysis-rule-factor">{viabilityFactor}</span>}<strong>{viabilityPass ? 'Pass' : 'Fail'}</strong></span>
                  </button>
                  <button type="button" className={`quick-view-analysis-rule ${activeAnalysisCard === 'standard' ? 'active' : ''} ${spreadStatus.tone === 'positive' ? 'pass' : spreadStatus.tone === 'negative' ? 'fail' : ''}`} onClick={() => {
                    if (deeperAnalysisLocked) {
                      handleLockedFeature('Spread diagnostics are locked on the free tier. Upgrade to see return spread against the active rate.');
                      return;
                    }
                    setActiveAnalysisCard('standard');
                  }}>
                    <span>Spread {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span>
                    <span className="quick-view-analysis-rule-result">{isDesktopViewport && <span className="quick-view-analysis-rule-factor">{deeperAnalysisLocked ? <LockedValue /> : spreadFactor}</span>}<strong>{deeperAnalysisLocked ? <LockedValue /> : spreadStatus.label}</strong></span>
                  </button>
                  <button type="button" className={`quick-view-analysis-rule ${activeAnalysisCard === 'fragility' ? 'active' : ''} ${fragilityPass ? 'pass' : 'fail'}`} onClick={() => {
                    if (deeperAnalysisLocked) {
                      handleLockedFeature('Durability diagnostics are locked on the free tier. Upgrade to see whether the result holds up under downside assumptions.');
                      return;
                    }
                    setActiveAnalysisCard('fragility');
                  }}>
                    <span>Durability {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span>
                    <span className="quick-view-analysis-rule-result">{isDesktopViewport && <span className="quick-view-analysis-rule-factor">{deeperAnalysisLocked ? <LockedValue /> : durabilityFactor}</span>}<strong>{deeperAnalysisLocked ? <LockedValue /> : fragilityPass ? 'Pass' : 'Fail'}</strong></span>
                  </button>
                </div>
                <div className="quick-view-analysis-detail quick-view-analysis-inline-detail">
                  {!isDesktopViewport && <span className="quick-view-analysis-detail-factor">{activeAnalysisFactor}</span>}
                  {activeAnalysisCard === 'viability' && <p>{viabilityPass ? (isDesktopViewport ? `NPV stays above zero at the active ${discountRateForAnalysis.toFixed(1)}% ${rateBasis} rate${shouldShowAppliedRate ? ` (${rateBasisLabel.toLowerCase()} as ${(showHurdleRate ? appliedHurdleRate : appliedDiscountRate).toFixed(2)}%)` : ''}, so the project is still creating net value after discounting.` : `NPV > 0 at ${discountRateForAnalysis.toFixed(1)}% ${rateBasis}`) : (isDesktopViewport ? `NPV is below zero at the active ${discountRateForAnalysis.toFixed(1)}% ${rateBasis} rate${shouldShowAppliedRate ? ` (${rateBasisLabel.toLowerCase()} as ${(showHurdleRate ? appliedHurdleRate : appliedDiscountRate).toFixed(2)}%)` : ''}, so the project is not creating value after discounting.` : `NPV < 0 at ${discountRateForAnalysis.toFixed(1)}% ${rateBasis}`)}</p>}
                  {activeAnalysisCard === 'standard' && <p>{hasNonNumericIrr ? irrIssueDetail : isDesktopViewport ? `IRR is ${spread >= 0 ? '+' : ''}${spread.toFixed(2)} points versus the active rate, which grades this spread as ${spreadStatus.label.toLowerCase()}.` : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)} pts vs active rate`}</p>}
                  {activeAnalysisCard === 'fragility' && <p>{hasNonNumericDownsideIrr ? downsideIrrIssueDetail : fragilityPass ? (isDesktopViewport ? (showHurdleRate ? `Even the downside case keeps IRR above the ${hurdleRate.toFixed(1)}% annual hurdle, which makes the result more resilient.` : `Even the downside case keeps IRR above the ${discount.toFixed(1)}% annual discount rate, which suggests the outcome is holding up under pressure.`) : (showHurdleRate ? `Downside IRR ≥ hurdle ${hurdleRate.toFixed(1)}%` : `Downside IRR ≥ discount ${discount.toFixed(1)}%`)) : (isDesktopViewport ? (showHurdleRate ? `The downside case falls below the ${hurdleRate.toFixed(1)}% annual hurdle, so the result is more fragile under pressure.` : `The downside case falls below the ${discount.toFixed(1)}% annual discount rate, so the outcome is not holding up under pressure.`) : (showHurdleRate ? `Downside IRR < hurdle ${hurdleRate.toFixed(1)}%` : `Downside IRR < discount ${discount.toFixed(1)}%`))}</p>}
                </div>
              </section>

              <section className="quick-view-analysis-column quick-view-analysis-facts">
                <span className="details-metric-label">Breakeven Analysis</span>
                <div className="quick-view-analysis-facts-list">
                  <div className="quick-view-analysis-fact-pill quick-view-analysis-fact-pill-inline"><span>IRR {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span><strong>{getIrrDisplay(irrAnalysis)}</strong></div>
                  <div className="quick-view-analysis-fact-pill quick-view-analysis-fact-pill-inline"><span>Payback</span><strong>{formatPaybackDisplay(payback, periodMode)}</strong></div>
                  <button type="button" className="quick-view-analysis-fact-pill quick-view-analysis-fact-pill-inline" onClick={() => {
                    if (deeperAnalysisLocked) handleLockedFeature('Uplift analysis is locked on the free tier. Upgrade to see the cash-flow improvement needed to break even.');
                  }}><span>Uplift</span><strong>{deeperAnalysisLocked ? <LockedValue /> : breakEvenCashflowUpliftPct === null ? 'N/A' : `${breakEvenCashflowUpliftPct >= 0 ? '+' : ''}${breakEvenCashflowUpliftPct.toFixed(1)}%`}</strong></button>
                  <button type="button" className="quick-view-analysis-fact-pill quick-view-analysis-fact-pill-inline" onClick={() => {
                    if (deeperAnalysisLocked) handleLockedFeature('Max initial investment is locked on the free tier. Upgrade to see the highest upfront cost this project can support.');
                  }}><span>Max Initial</span><strong>{deeperAnalysisLocked ? <LockedValue /> : `${currency}${maxInitialAtNpvZero.toFixed(2)}`}</strong></button>
                </div>
                {shouldShowAnalysisSensitivity && (
                  <div
                    className={`quick-view-analysis-sensitivity-card ${sensitivityLocked ? 'locked-sensitivity-card' : ''}`}
                    role={sensitivityLocked ? 'button' : undefined}
                    tabIndex={sensitivityLocked ? 0 : undefined}
                    onClick={sensitivityLocked ? () => handleLockedFeature('Sensitivity analysis is locked on the free tier. Upgrade to see how NPV moves across cash-flow swings.') : undefined}
                    onKeyDown={handleSensitivityCardKeyDown}
                  >
                    <div className="quick-view-analysis-sensitivity-header">
                      <span className="details-metric-label">Sensitivity Snapshot</span>
                      <strong>NPV by cash flow swing</strong>
                    </div>
                    <div className={`quick-view-analysis-sensitivity-table-wrap ${sensitivityLocked ? 'locked-sensitivity-content' : ''}`}>
                      <table className="quick-view-analysis-sensitivity-table">
                        <thead>
                          <tr><th><span className="sensitivity-heading-desktop">Variation</span><span className="sensitivity-heading-mobile">%</span></th><th>NPV</th></tr>
                        </thead>
                        <tbody>
                          {sensitivityData.map((d) => (
                            <tr key={d.variation}>
                              <td>{d.variation > 0 ? '+' : ''}{d.variation}%</td>
                              <td className={d.npv >= 0 ? 'positive' : 'negative'}>{currency}{formatTableCurrencyValue(d.npv)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
};
