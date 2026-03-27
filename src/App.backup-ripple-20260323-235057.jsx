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
  ErrorBar,
} from 'recharts';

const tooltipShellStyle = {
  background: 'rgba(17, 24, 39, 0.92)',
  color: '#f9fafb',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  minWidth: 150,
};

const NpvTooltip = ({ active, payload, label, currency, showSensitivity }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  const baseNpv = typeof row.npv === 'number' ? row.npv : null;
  const highNpv = typeof row.high_npv === 'number' ? row.high_npv : null;
  const lowNpv = typeof row.low_npv === 'number' ? row.low_npv : null;

  return (
    <div style={tooltipShellStyle}>
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

const TornadoTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        <strong>{label}</strong>
      </div>
      <div style={{ color: '#fca5a5' }}>
        Downside ΔNPV: {currency}{Number(row.downside || 0).toFixed(2)}
      </div>
      <div style={{ color: '#86efac' }}>
        Upside ΔNPV: {currency}{Number(row.upside || 0).toFixed(2)}
      </div>
    </div>
  );
};

const CashflowTooltip = ({ active, payload, label, currency, showSensitivity }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};

  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        <strong>{label}</strong>
      </div>
      <div style={{ color: Number(row.value) >= 0 ? '#93c5fd' : '#fca5a5' }}>
        Cash Flow: {currency}{Number(row.value || 0).toFixed(2)}
      </div>
      {row.pvValue !== null && row.pvValue !== undefined && (
        <div style={{ color: '#c4b5fd' }}>
          PV Cash Flow: {currency}{Number(row.pvValue).toFixed(2)}
        </div>
      )}
      {showSensitivity && row.pvLow !== null && row.pvLow !== undefined && row.pvHigh !== null && row.pvHigh !== undefined && (
        <div style={{ color: '#ddd6fe' }}>
          PV Sensitivity Range: {currency}{Number(row.pvLow).toFixed(2)} → {currency}{Number(row.pvHigh).toFixed(2)}
        </div>
      )}
      {row.cumulative !== null && row.cumulative !== undefined && (
        <div style={{ color: '#60a5fa' }}>
          Cash Cumulative: {currency}{Number(row.cumulative).toFixed(2)}
        </div>
      )}
      {row.pvCumulative !== null && row.pvCumulative !== undefined && (
        <div style={{ color: '#a78bfa' }}>
          PV Cumulative: {currency}{Number(row.pvCumulative).toFixed(2)}
        </div>
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
    let pvCumulative = -initial;
    const rate = discount / 100;

    return [
      {
        name: 'Initial',
        value: -initial,
        pvValue: -initial,
        pvLow: null,
        pvHigh: null,
        pvError: null,
        cumulative: -initial,
        pvCumulative: -initial,
      },
      ...cashflows.map((cf, i) => {
        const pvValue = cf / Math.pow(1 + rate, i + 1);
        const pvLow = (cf * 0.9) / Math.pow(1 + rate, i + 1);
        const pvHigh = (cf * 1.1) / Math.pow(1 + rate, i + 1);
        cumulative += cf;
        pvCumulative += pvValue;
        return {
          name: `Year ${i + 1}`,
          value: cf,
          pvValue,
          pvLow,
          pvHigh,
          pvError: [Math.abs(pvValue - pvLow), Math.abs(pvHigh - pvValue)],
          cumulative,
          pvCumulative,
        };
      }),
      { name: 'NPV', value: npv, pvValue: null, pvLow: null, pvHigh: null, pvError: null, cumulative: null, pvCumulative: null },
    ];
  }, [initial, cashflows, npv, discount]);

  const sensitivityData = useMemo(() => {
    const variations = [-10, 0, 10];
    return variations.map((varPct) => {
      const variedCashflows = cashflows.map((cf) => cf * (1 + varPct / 100));
      return { variation: varPct, npv: calculateNPV(initial, discount, variedCashflows) };
    });
  }, [initial, discount, cashflows]);

  const npvAtMinus10Cashflow = useMemo(() => {
    const lowCashflows = cashflows.map((cf) => cf * 0.9);
    return calculateNPV(initial, discount, lowCashflows);
  }, [initial, discount, cashflows]);

  const breakEvenCashflowUpliftPct = useMemo(() => {
    const pvOfCashflows = cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discount / 100, i + 1), 0);
    if (pvOfCashflows <= 0) return null;
    const multiplier = initial / pvOfCashflows;
    return (multiplier - 1) * 100;
  }, [initial, discount, cashflows]);

  const maxInitialAtNpvZero = useMemo(() => {
    const pvOfCashflows = cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discount / 100, i + 1), 0);
    return pvOfCashflows;
  }, [discount, cashflows]);

  const tornadoPairedData = useMemo(() => {
    const rows = [
      {
        name: 'Discount Rate (±1%)',
        downside: calculateNPV(initial, discount + 1, cashflows) - npv,
        upside: calculateNPV(initial, Math.max(0, discount - 1), cashflows) - npv,
      },
      {
        name: 'Initial Investment (±10%)',
        downside: calculateNPV(initial * 1.1, discount, cashflows) - npv,
        upside: calculateNPV(initial * 0.9, discount, cashflows) - npv,
      },
      ...cashflows.map((_, i) => {
        const down = [...cashflows];
        down[i] = down[i] * 0.9;
        const up = [...cashflows];
        up[i] = up[i] * 1.1;
        return {
          name: `Year ${i + 1} Cash Flow (±10%)`,
          downside: calculateNPV(initial, discount, down) - npv,
          upside: calculateNPV(initial, discount, up) - npv,
        };
      }),
    ];

    return rows.sort(
      (a, b) => Math.max(Math.abs(b.downside), Math.abs(b.upside)) - Math.max(Math.abs(a.downside), Math.abs(a.upside))
    );
  }, [initial, discount, cashflows, npv]);

  const tornadoMaxAbs = useMemo(() => {
    const maxAbs = Math.max(
      1,
      ...tornadoPairedData.map((d) => Math.max(Math.abs(d.downside), Math.abs(d.upside)))
    );
    return Math.ceil(maxAbs / 10) * 10;
  }, [tornadoPairedData]);

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
      ? npvAtMinus10Cashflow <= 0
        ? 'Consider Project: Positive NPV, but NPV at -10% cash flow turns negative—review downside risk.'
        : 'Accept Project: Positive NPV (robust to a 10% drop in cash flows)—profitable and relatively low risk.'
      : 'Reject/Reassess: Negative NPV—project may not add value. Consider improving cash flows or lowering discount rate assumptions.';

  return (
    <>
      <style>{`
      *, *::before, *::after { box-sizing: border-box; }
      html, body { max-width: 100%; overflow-x: hidden; }
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
      .scenario-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1200;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        padding: 10px 14px;
        backdrop-filter: blur(8px);
        background: rgba(255, 255, 255, 0.9);
        border-bottom: 1px solid #e5e7eb;
      }
      .scenario-toolbar input,
      .scenario-toolbar select,
      .scenario-toolbar button {
        height: 34px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        padding: 0 10px;
        font-size: 13px;
      }
      .scenario-toolbar button {
        background: #111827;
        color: #fff;
        border-color: #111827;
        cursor: pointer;
      }
      .scenario-toolbar button:hover {
        background: #1f2937;
      }
      .container { display: flex; gap: 12px; margin-top: 72px; }
      .left, .right { padding: 20px; }
      .metrics h2 { margin: 6px 0; }
      .recommendation { margin-top: 10px; font-weight: 600; }
      .thresholds {
        margin-top: 10px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 10px;
      }
      .thresholds h3 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .thresholds p {
        margin: 4px 0;
        font-size: 13px;
      }
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
        .scenario-toolbar {
          background: rgba(17, 24, 39, 0.88);
          border-bottom-color: #374151;
        }
        .scenario-toolbar input,
        .scenario-toolbar select {
          background: #111827;
          color: #f9fafb;
          border-color: #4b5563;
        }
        .scenario-toolbar button {
          background: #6d28d9;
          border-color: #6d28d9;
        }
        .scenario-toolbar button:hover {
          background: #7c3aed;
        }
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
        .container { flex-direction: column; margin-top: 132px; }
        .left, .right { width: 100% !important; padding: 14px; }
      }
      @media (max-width: 640px) {
        .scenario-toolbar {
          padding: 8px;
          gap: 6px;
        }
        .scenario-toolbar input,
        .scenario-toolbar select,
        .scenario-toolbar button {
          width: 100%;
          min-width: 0 !important;
        }
        .container { margin-top: 182px; }
      }
      `}</style>

      <div className="scenario-toolbar">
        <input
          placeholder="Scenario Name"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          style={{ minWidth: 170, flex: '1 1 180px' }}
        />
        <button onClick={() => saveScenario(scenarioName)}>Save Scenario</button>

        <select onChange={(e) => loadScenario(e.target.value)} defaultValue="Load Scenario" style={{ minWidth: 150, flex: '1 1 160px' }}>
          <option disabled>Load Scenario</option>
          {Object.keys(scenarios).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>

        <select onChange={(e) => deleteScenario(e.target.value)} defaultValue="Delete Scenario" style={{ minWidth: 155, flex: '1 1 160px' }}>
          <option disabled>Delete Scenario</option>
          {Object.keys(scenarios).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>


      </div>

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

          <div className="thresholds">
            <h3>Break-even Thresholds (NPV = 0)</h3>
            <p>Break-even discount rate (IRR): <strong>{irr.toFixed(2)}%</strong></p>
            <p>
              Required cash flow uplift:{' '}
              <strong>
                {breakEvenCashflowUpliftPct === null
                  ? 'N/A'
                  : `${breakEvenCashflowUpliftPct >= 0 ? '+' : ''}${breakEvenCashflowUpliftPct.toFixed(1)}%`}
              </strong>
            </p>
            <p>Max initial investment at current rate: <strong>{currency}{maxInitialAtNpvZero.toFixed(2)}</strong></p>
          </div>

          <button onClick={() => setShowModal(true)}>Learn More (Educational Guide)</button>


          <label style={{ display: 'block', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={showSensitivity}
              onChange={(e) => setShowSensitivity(e.target.checked)}
            />{' '}
            Show Sensitivity Analysis (±10% cash flows)
          </label>

          <button onClick={exportToCSV} style={{ marginTop: 10 }}>Export CSV</button>

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
                stroke="#c084fc"
                strokeDasharray="3 3"
                label={<Label value={`Current Rate: ${discount.toFixed(1)}%`} position="insideBottom" fill="#c084fc" dy={-2} />}
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

          <h2>Cash Flows</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} barGap={-22} barCategoryGap="30%">
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CashflowTooltip currency={currency} showSensitivity={showSensitivity} />} />
              <Legend
                payload={[
                  { value: 'Cash Flow', type: 'square', color: '#3b82f6' },
                  { value: 'PV Cash Flow', type: 'square', color: '#8b5cf6' },
                  { value: 'Cash Cumulative', type: 'line', color: '#60a5fa' },
                  { value: 'PV Cumulative', type: 'line', color: '#a78bfa' },
                ]}
              />
              <Bar dataKey="value" name="Cash Flow" fillOpacity={0.35} barSize={24}>
                {barData.map((entry, index) => {
                  const isNpv = entry.name === 'NPV';
                  const fill = isNpv ? (entry.value >= 0 ? '#22c55e' : '#ef4444') : '#3b82f6';
                  return <Cell key={`cash-cell-${index}`} fill={fill} />;
                })}
              </Bar>
              <Bar dataKey="pvValue" name="PV Cash Flow" barSize={14}>
                {barData.map((entry, index) => {
                  if (entry.pvValue === null || entry.pvValue === undefined) {
                    return <Cell key={`pv-cell-${index}`} fill="transparent" />;
                  }
                  const isNpv = entry.name === 'NPV';
                  const fill = isNpv ? (entry.value >= 0 ? '#16a34a' : '#dc2626') : '#8b5cf6';
                  return <Cell key={`pv-cell-${index}`} fill={fill} />;
                })}
                {showSensitivity && (
                  <ErrorBar dataKey="pvError" direction="y" stroke="#c4b5fd" strokeWidth={1.5} width={8} />
                )}
              </Bar>
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cash Cumulative"
                stroke="#60a5fa"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="pvCumulative"
                name="PV Cumulative"
                stroke="#a78bfa"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 3"
              />
            </BarChart>
          </ResponsiveContainer>

          <h2>Top NPV Drivers (Tornado)</h2>
          <p style={{ marginTop: -6, marginBottom: 8, fontSize: 12, opacity: 0.85 }}>
            Two-sided sensitivity: left of zero reduces NPV (risk), right of zero increases NPV (upside). Longer bars = bigger impact.
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={tornadoPairedData} layout="vertical" margin={{ top: 5, right: 18, left: 40, bottom: 5 }}>
              <XAxis
                type="number"
                domain={[-tornadoMaxAbs, tornadoMaxAbs]}
                tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`}
              />
              <YAxis type="category" dataKey="name" width={170} />
              <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={2} label={<Label value="Base" position="top" fill="#9ca3af" />} />
              <Legend
                payload={[
                  { value: 'Downside (Δ NPV < 0)', type: 'square', color: '#dc2626' },
                  { value: 'Upside (Δ NPV > 0)', type: 'square', color: '#16a34a' },
                ]}
              />
              <Bar dataKey="downside" name="Downside ΔNPV" fill="#dc2626" />
              <Bar dataKey="upside" name="Upside ΔNPV" fill="#16a34a" />
              <Tooltip content={<TornadoTooltip currency={currency} />} />
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
