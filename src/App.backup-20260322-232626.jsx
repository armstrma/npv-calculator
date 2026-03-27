import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  Label,
  Legend,
  Tooltip,
} from 'recharts';

const NpvTooltip = ({ active, payload, label, currency, showSensitivity }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  const baseNpv = typeof row.npv === 'number' ? row.npv : null;
  const highNpv = typeof row.high_npv === 'number' ? row.high_npv : null;
  const lowNpv = typeof row.low_npv === 'number' ? row.low_npv : null;

  return (
    <div
      style={{
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#f9fafb',
        border: '1px solid #374151',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        minWidth: 150,
      }}
    >
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        Discount: <strong>{Number(label).toFixed(1)}%</strong>
      </div>
      {baseNpv !== null && (
        <div style={{ color: baseNpv >= 0 ? '#86efac' : '#fca5a5' }}>
          NPV: {currency}{baseNpv.toFixed(2)}
        </div>
      )}
      {showSensitivity && highNpv !== null && (
        <div style={{ color: '#c4b5fd' }}>High (+10% CF): {currency}{highNpv.toFixed(2)}</div>
      )}
      {showSensitivity && lowNpv !== null && (
        <div style={{ color: '#f9a8d4' }}>Low (-10% CF): {currency}{lowNpv.toFixed(2)}</div>
      )}
    </div>
  );
};

const App = () => {
  const [initial, setInitial] = useState(1000);
  const [discount, setDiscount] = useState(10);
  const [cashflows, setCashflows] = useState([200, 300, 400, 500, 600]);
  const [currency, setCurrency] = useState('$');
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scenarios, setScenarios] = useState({});
  const [scenarioName, setScenarioName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('npvScenarios');
    if (saved) setScenarios(JSON.parse(saved));
  }, []);

  const saveScenario = (name) => {
    if (!name?.trim()) return;
    const newScenarios = { ...scenarios, [name.trim()]: { initial, discount, cashflows } };
    setScenarios(newScenarios);
    localStorage.setItem('npvScenarios', JSON.stringify(newScenarios));
    setScenarioName('');
  };

  const loadScenario = (name) => {
    const scenario = scenarios[name];
    if (scenario) {
      setInitial(scenario.initial);
      setDiscount(scenario.discount);
      setCashflows(scenario.cashflows);
    }
  };

  const deleteScenario = (name) => {
    if (!name || name === 'Delete Scenario') return;
    const saved = localStorage.getItem('npvScenarios');
    const parsed = JSON.parse(saved || '{}');
    delete parsed[name];
    setScenarios(parsed);
    localStorage.setItem('npvScenarios', JSON.stringify(parsed));
  };

  const calculateNPV = (init, disc, cfs) => {
    const rate = disc / 100;
    let npv = -init;
    cfs.forEach((cf, index) => {
      npv += cf / Math.pow(1 + rate, index + 1);
    });
    return npv;
  };

  const findIRR = (init, cfs) => {
    let low = -99.9;
    let high = 200;
    let mid = 0;
    let npvMid = 0;

    for (let i = 0; i < 120; i++) {
      mid = (low + high) / 2;
      npvMid = calculateNPV(init, mid, cfs);
      if (npvMid > 0) low = mid;
      else high = mid;
      if (Math.abs(npvMid) < 0.01) return mid;
    }

    return mid;
  };

  const calculatePayback = (init, cfs) => {
    let cumulative = -init;
    for (let i = 0; i < cfs.length; i++) {
      cumulative += cfs[i];
      if (cumulative >= 0) return i + 1;
    }
    return 'N/A';
  };

  const calculateROI = (init, cfs) => {
    if (init === 0) return 0;
    const totalGain = cfs.reduce((a, b) => a + b, 0) - init;
    return (totalGain / init) * 100;
  };

  const calculatePI = (npvVal, init) => {
    if (init === 0) return 0;
    return npvVal / init + 1;
  };

  const npv = useMemo(() => calculateNPV(initial, discount, cashflows), [initial, discount, cashflows]);
  const irr = useMemo(() => findIRR(initial, cashflows), [initial, cashflows]);
  const payback = useMemo(() => calculatePayback(initial, cashflows), [initial, cashflows]);
  const roi = useMemo(() => calculateROI(initial, cashflows), [initial, cashflows]);
  const pi = useMemo(() => calculatePI(npv, initial), [npv, initial]);

  const discountData = useMemo(() => {
    const data = [];
    for (let r = 0; r <= 30; r += 0.5) {
      const npvVal = calculateNPV(initial, r, cashflows);
      const entry = {
        discount: r,
        npv: npvVal,
        npv_pos: npvVal >= 0 ? npvVal : null,
        npv_neg: npvVal < 0 ? npvVal : null,
      };
      if (showSensitivity) {
        const lowCashflows = cashflows.map((cf) => cf * 0.9);
        const highCashflows = cashflows.map((cf) => cf * 1.1);
        const lowNpv = calculateNPV(initial, r, lowCashflows);
        const highNpv = calculateNPV(initial, r, highCashflows);

        entry.low_npv = lowNpv;
        entry.high_npv = highNpv;
        entry.low_npv_pos = lowNpv >= 0 ? lowNpv : null;
        entry.low_npv_neg = lowNpv < 0 ? lowNpv : null;
        entry.high_npv_pos = highNpv >= 0 ? highNpv : null;
        entry.high_npv_neg = highNpv < 0 ? highNpv : null;
      }
      data.push(entry);
    }
    return data;
  }, [initial, cashflows, showSensitivity]);

  const barData = useMemo(() => {
    let cumulative = -initial;
    return [
      { name: 'Initial', value: -initial, color: 'red', cumulative: -initial },
      ...cashflows.map((cf, i) => {
        cumulative += cf;
        return { name: `Year ${i + 1}`, value: cf, color: cf < 0 ? 'goldenrod' : 'royalblue', cumulative };
      }),
      { name: 'NPV', value: npv, color: npv > 0 ? 'green' : 'red', cumulative: null },
    ];
  }, [initial, cashflows, npv]);

  const sensitivityData = useMemo(() => {
    const variations = [-10, 0, 10];
    return variations.map((varPct) => {
      const variedCashflows = cashflows.map((cf) => cf * (1 + varPct / 100));
      return { variation: varPct, npv: calculateNPV(initial, discount, variedCashflows) };
    });
  }, [initial, discount, cashflows]);

  const getGradient = (type, index = null) => {
    let minVal;
    let maxVal;
    switch (type) {
      case 'initial':
        minVal = 0;
        maxVal = 10000;
        break;
      case 'discount':
        minVal = 0;
        maxVal = 30;
        break;
      case 'cashflow':
        minVal = -5000;
        maxVal = 10000;
        break;
      default:
        return 'gray';
    }

    const steps = 20;
    const npvs = [];
    for (let i = 0; i <= steps; i++) {
      const val = minVal + (maxVal - minVal) * (i / steps);
      const tempInitial = type === 'initial' ? val : initial;
      const tempDiscount = type === 'discount' ? val : discount;
      const tempCashflows = [...cashflows];
      if (type === 'cashflow' && index !== null) tempCashflows[index] = val;
      npvs.push(calculateNPV(tempInitial, tempDiscount, tempCashflows));
    }

    const minNPV = Math.min(...npvs);
    const maxNPV = Math.max(...npvs);
    if (minNPV === maxNPV) return 'gray';

    const negMin = Math.min(minNPV, 0);
    const posMax = Math.max(maxNPV, 0);

    const stops = npvs.map((npvVal, i) => {
      let hue;
      if (npvVal <= 0) {
        if (negMin === 0) hue = 60;
        else hue = ((npvVal - negMin) / (0 - negMin)) * 60;
      } else {
        if (posMax === 0) hue = 60;
        else hue = 60 + (npvVal / posMax) * 60;
      }
      const color = `hsl(${hue}, 100%, 50%)`;
      const percent = (i / steps) * 100;
      return `${color} ${percent}%`;
    });

    return `linear-gradient(to right, ${stops.join(', ')})`;
  };

  const addYear = () => setCashflows([...cashflows, 0]);
  const removeYear = (index) => setCashflows(cashflows.filter((_, i) => i !== index));

  const exportToCSV = () => {
    const csvContent = `Initial,${initial}\nDiscount Rate,${discount}\nCash Flows,${cashflows.join(',')}\nNPV,${npv}\nIRR,${irr}\nPayback,${payback}\nROI,${roi}\nPI,${pi}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'npv_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  let sliderCss = `
  .slider-initial::-webkit-slider-runnable-track { background: ${getGradient('initial')}; }
  .slider-initial::-moz-range-track { background: ${getGradient('initial')}; }
  .slider-discount::-webkit-slider-runnable-track { background: ${getGradient('discount')}; }
  .slider-discount::-moz-range-track { background: ${getGradient('discount')}; }
  `;

  cashflows.forEach((_, index) => {
    sliderCss += `
    .slider-cashflow-${index}::-webkit-slider-runnable-track { background: ${getGradient('cashflow', index)}; }
    .slider-cashflow-${index}::-moz-range-track { background: ${getGradient('cashflow', index)}; }
    `;
  });

  const recommendation =
    npv > 0
      ? showSensitivity && sensitivityData[0]?.npv <= 0
        ? 'Consider Project: Positive NPV, but NPV at -10% cash flow turns negative—review downside risk.'
        : 'Accept Project: Positive NPV (robust to a 10% drop in cash flows)—profitable and relatively low risk.'
      : 'Reject/Reassess: Negative NPV—project may not add value. Consider improving cash flows or lowering discount rate assumptions.';

  return (
    <>
      <style>{`
      input[type="range"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 100%;
        height: 10px;
        border-radius: 5px;
        outline: none;
      }
      input[type="range"]::-webkit-slider-runnable-track { height: 10px; border-radius: 5px; }
      input[type="range"]::-moz-range-track { height: 10px; border-radius: 5px; }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: white;
        border: 1px solid #ccc;
        cursor: pointer;
        margin-top: -5px;
      }
      input[type="range"]::-moz-range-thumb {
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: white;
        border: 1px solid #ccc;
        cursor: pointer;
      }
      ${sliderCss}
      .container { display: flex; gap: 12px; }
      .left, .right { padding: 20px; }
      .metrics h2 { margin: 6px 0; }
      .recommendation { margin-top: 10px; font-weight: 600; }
      .cashflow-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .cashflow-slider-wrap {
        flex: 1;
      }
      .delete-btn {
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: 1px solid #dc2626;
        background: #dc2626;
        color: #fff;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        flex-shrink: 0;
        margin-top: 18px;
      }
      .delete-btn:hover {
        background: #b91c1c;
        border-color: #b91c1c;
      }
      .delete-btn svg {
        width: 16px;
        height: 16px;
        stroke: #ffffff;
      }
      .modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: #ffffff;
        color: #111827;
        border-radius: 10px;
        max-width: 640px;
        width: 90%;
        padding: 20px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        border: 1px solid #e5e7eb;
      }
      .modal-content button {
        margin-top: 10px;
        background: #111827;
        color: #ffffff;
        border: 1px solid #111827;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
      }
      @media (prefers-color-scheme: dark) {
        .modal-content {
          background: #111827;
          color: #f3f4f6;
          border-color: #374151;
          box-shadow: 0 10px 35px rgba(0,0,0,0.45);
        }
        .modal-content button {
          background: #374151;
          border-color: #4b5563;
          color: #f9fafb;
        }
      }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      @media (max-width: 900px) {
        .container { flex-direction: column; }
        .left, .right { width: 100% !important; }
      }
      `}</style>

      <div className="container">
        <div className="left" style={{ width: '50%' }}>
          <h1>NPV Calculator</h1>

          <select value={currency} onChange={(e) => setCurrency(e.target.value)} title="Display currency (calculations unchanged)">
            <option>$</option>
            <option>€</option>
            <option>£</option>
          </select>

          <div title="Initial Investment: Upfront cost of the project. Higher values reduce NPV.">
            <label>Initial Investment: {currency}{initial}</label>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
              className="slider-initial"
            />
          </div>

          <div>
            <label>Discount Rate: {discount}%</label>
            <input
              type="range"
              min={0}
              max={30}
              step={0.1}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="slider-discount"
            />
          </div>

          <button onClick={addYear}>Add Year</button>

          {cashflows.map((cf, index) => (
            <div key={index} className="cashflow-row">
              <div className="cashflow-slider-wrap">
                <label>Year {index + 1} Cash Flow: {currency}{cf}</label>
                <input
                  type="range"
                  min={-5000}
                  max={10000}
                  step={100}
                  value={cf}
                  onChange={(e) => {
                    const newCashflows = [...cashflows];
                    newCashflows[index] = Number(e.target.value);
                    setCashflows(newCashflows);
                  }}
                  className={`slider-cashflow-${index}`}
                />
              </div>
              <button
                onClick={() => removeYear(index)}
                className="delete-btn"
                title={`Delete Year ${index + 1}`}
                aria-label={`Delete Year ${index + 1}`}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          ))}

          <div className="metrics">
            <h2>Current NPV: {currency}{npv.toFixed(2)}</h2>
            <h2 title="IRR: Rate where NPV = 0. Higher is generally better.">IRR: {irr.toFixed(2)}%</h2>
            <h2 title="Payback: Years to recover investment.">Payback Period: {payback} years</h2>
            <h2 title="ROI: Total return percentage.">ROI: {roi.toFixed(2)}%</h2>
            <h2 title="PI: NPV efficiency (&gt;1 is good).">Profitability Index: {pi.toFixed(2)}</h2>
            <p className="recommendation">{recommendation}</p>
          </div>

          <button onClick={() => setShowModal(true)}>Learn More (Educational Guide)</button>

          <div style={{ marginTop: 10 }}>
            <input
              placeholder="Scenario Name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
            />
            <button onClick={() => saveScenario(scenarioName)}>Save Scenario</button>
          </div>

          <select onChange={(e) => loadScenario(e.target.value)}>
            <option>Load Scenario</option>
            {Object.keys(scenarios).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>

          <select onChange={(e) => deleteScenario(e.target.value)}>
            <option>Delete Scenario</option>
            {Object.keys(scenarios).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>

          <button onClick={exportToCSV}>Export to CSV</button>

          <label style={{ display: 'block', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={showSensitivity}
              onChange={(e) => setShowSensitivity(e.target.checked)}
            />{' '}
            Show Sensitivity Analysis (±10% cash flows)
          </label>

          {showSensitivity && (
            <table>
              <thead>
                <tr><th>Variation</th><th>NPV</th></tr>
              </thead>
              <tbody>
                {sensitivityData.map((d) => (
                  <tr key={d.variation}><td>{d.variation}%</td><td>{currency}{d.npv.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="right" style={{ width: '50%' }}>
          <h2>NPV vs Discount Rate</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={discountData} margin={{ top: 22, right: 18, left: 0, bottom: 28 }}>
              <XAxis dataKey="discount" type="number" domain={[0, 30]} />
              <YAxis />
              <Tooltip
                cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
                content={<NpvTooltip currency={currency} showSensitivity={showSensitivity} />}
              />
              <Line type="monotone" dataKey="npv_pos" stroke="green" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
              <Line type="monotone" dataKey="npv_neg" stroke="red" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
              {!Number.isNaN(irr) && (
                <ReferenceLine
                  x={irr}
                  stroke="#7dd3fc"
                  strokeDasharray="3 3"
                  label={<Label value={`IRR: ${irr.toFixed(2)}%`} position="insideTopRight" fill="#7dd3fc" dx={-10} dy={-8} />}
                />
              )}
              <ReferenceLine
                x={discount}
                stroke="purple"
                strokeDasharray="3 3"
                label={<Label value={`Current Rate: ${discount.toFixed(1)}%`} position="insideBottom" fill="purple" dy={-2} />}
              />
              {showSensitivity && (
                <>
                  <Line
                    type="monotone"
                    dataKey="high_npv_pos"
                    stroke="#a78bfa"
                    dot={false}
                    activeDot={{ r: 3 }}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="high_npv_neg"
                    stroke="#ef4444"
                    dot={false}
                    activeDot={{ r: 3 }}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="low_npv_pos"
                    stroke="#f9a8d4"
                    dot={false}
                    activeDot={{ r: 3 }}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="low_npv_neg"
                    stroke="#dc2626"
                    dot={false}
                    activeDot={{ r: 3 }}
                    strokeWidth={3}
                    strokeDasharray="4 3"
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>

          <h2>Cash Flow Bar Chart</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Legend payload={[{ value: 'Cumulative Cash Value', type: 'line', color: 'purple' }]} />
              <Bar dataKey="value" legendType="none">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Cash Value"
                stroke="purple"
                dot={false}
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Educational Guide</h2>
            <p><strong>NPV (Net Present Value)</strong>: Measures project profitability by discounting future cash flows. Formula: Σ(CF_t / (1+r)^t) - Initial. Positive means value added.</p>
            <p><strong>IRR (Internal Rate of Return)</strong>: Discount rate making NPV = 0. Compare to cost of capital.</p>
            <p><strong>Payback Period</strong>: Time to recover investment—shorter is generally less risky.</p>
            <p><strong>ROI</strong>: (Net Gain / Cost) × 100—simple return metric.</p>
            <p><strong>PI</strong>: (NPV + Initial) / Initial; &gt;1 means profitable.</p>
            <p>Story flow: set assumptions → analyze metrics/charts → make go/no-go decision.</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
