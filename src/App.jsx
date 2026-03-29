import React, { useState, useMemo, useEffect } from 'react';
import { calculateNPV, findIRR, calculatePayback, calculateROI, calculatePI } from './lib/finance.js';
import { formatNumberWithCommas, sanitizeNumericDraft, parseNumericInput } from './lib/input.js';

const formatCompactCurrency = (value, currency = '$') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `${currency}0`;

  const absValue = Math.abs(numericValue);
  let divisor = 1;
  let suffix = '';

  if (absValue >= 1_000_000_000) {
    divisor = 1_000_000_000;
    suffix = 'b';
  } else if (absValue >= 1_000_000) {
    divisor = 1_000_000;
    suffix = 'm';
  } else if (absValue >= 1_000) {
    divisor = 1_000;
    suffix = 'k';
  }

  const shortValue = numericValue / divisor;
  const decimals = divisor === 1 ? 2 : absValue >= 100 * divisor ? 0 : absValue >= 10 * divisor ? 1 : 2;

  return `${currency}${shortValue.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9])0+$/u, '')}${suffix}`;
};

const getSentimentStatus = (npv, npvAtMinus10Cashflow, irr, discount, showHurdleRate, hurdleRate) => {
  if (npv <= 0) {
    return {
      label: 'Reject',
      tone: 'negative',
      detail: 'Negative NPV',
    };
  }

  if (showHurdleRate && irr > discount && irr < hurdleRate) {
    return {
      label: 'Reject',
      tone: 'negative',
      detail: 'Hurdle rate not met',
    };
  }

  if (npvAtMinus10Cashflow < 0) {
    return {
      label: 'Accept',
      tone: 'caution',
      detail: '-10% cash flow turns negative',
    };
  }

  return {
    label: 'Accept',
    tone: 'positive',
    detail: 'Still positive at -10% cash flow',
  };
};

const formatMobileNpv = (value, currency = '$') => {
  const roundedValue = Math.round(Number(value) || 0);
  return `${currency}${roundedValue.toLocaleString()}`;
};

const formatMobileIrr = (value) => `${Math.round(Number(value) || 0)}%`;

const formatPaybackDisplay = (value) => (typeof value === 'number' ? `${value.toFixed(1)}y` : value);

const getSliderBounds = (values, { minBase = -5000, maxBase = 10000 } = {}) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  const highestPositive = numericValues.length ? Math.max(0, ...numericValues) : 0;
  const lowestNegative = numericValues.length ? Math.min(0, ...numericValues) : 0;

  let max = maxBase;
  while (highestPositive > max) {
    max *= 10;
  }

  let min = minBase;
  while (lowestNegative < min) {
    min *= 10;
  }

  return { min, max };
};
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  BarChart,
  Bar,
  Cell,
  Label,
  Legend,
  Tooltip,
  Area,
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

const TornadoTooltip = ({ active, payload, label, currency, showSensitivity }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  const getImpactColor = (value, positiveShade, negativeShade) =>
    Number(value || 0) >= 0 ? positiveShade : negativeShade;

  return (
    <div style={tooltipShellStyle}>
      <div style={{ marginBottom: 4, color: '#d1d5db' }}>
        <strong>{label}</strong>
      </div>
      {showSensitivity && (
        <div style={{ color: getImpactColor(row.down5, '#54a24b', '#c03f2f') }}>
          -5%: {currency}{Number(row.down5 || 0).toFixed(2)}
        </div>
      )}
      <div style={{ color: getImpactColor(row.down10, '#69c35f', '#ef5a43') }}>
        -10%: {currency}{Number(row.down10 || 0).toFixed(2)}
      </div>
      {showSensitivity && (
        <div style={{ color: getImpactColor(row.down20, '#c8e6c9', '#f5c2bc') }}>
          -20%: {currency}{Number(row.down20 || 0).toFixed(2)}
        </div>
      )}
      {showSensitivity && (
        <div style={{ color: getImpactColor(row.up5, '#54a24b', '#c03f2f'), marginTop: 4 }}>
          +5%: {currency}{Number(row.up5 || 0).toFixed(2)}
        </div>
      )}
      <div style={{ color: getImpactColor(row.up10, '#69c35f', '#ef5a43'), marginTop: showSensitivity ? 0 : 4 }}>
        +10%: {currency}{Number(row.up10 || 0).toFixed(2)}
      </div>
      {showSensitivity && (
        <div style={{ color: getImpactColor(row.up20, '#c8e6c9', '#f5c2bc') }}>
          +20%: {currency}{Number(row.up20 || 0).toFixed(2)}
        </div>
      )}
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
  const [showHurdleRate, setShowHurdleRate] = useState(false);
  const [hurdleRate, setHurdleRate] = useState(12);
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState({});
  const [projectName, setProjectName] = useState('');
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);
  const [sliderBounds, setSliderBounds] = useState({ initial: { min: 0, max: 10000 }, cashflow: { min: -5000, max: 10000 } });
  const [copiedProjectLink, setCopiedProjectLink] = useState(false);
  const [initialInput, setInitialInput] = useState(formatNumberWithCommas(1000));
  const [cashflowInputs, setCashflowInputs] = useState([200, 300, 400, 500, 600].map(formatNumberWithCommas));


  useEffect(() => {
    const saved = localStorage.getItem('npvProjects');
    if (saved) setProjects(JSON.parse(saved));

    const params = new URLSearchParams(window.location.search);
    const initialValue = params.get('initial');
    const discountValue = params.get('discount');
    const cashflowsParam = params.get('cashflows');
    const currencyParam = params.get('currency');
    const projectParam = params.get('project');
    const hurdleEnabledParam = params.get('hurdleEnabled');
    const hurdleRateParam = params.get('hurdleRate');

    if (initialValue !== null) {
      const parsedInitial = Number(initialValue);
      if (Number.isFinite(parsedInitial)) {
        setInitial(parsedInitial);
        setInitialInput(formatNumberWithCommas(parsedInitial));
      }
    }
    if (discountValue !== null) {
      const parsedDiscount = Number(discountValue);
      if (Number.isFinite(parsedDiscount)) setDiscount(parsedDiscount);
    }
    if (cashflowsParam) {
      const parsedCashflows = cashflowsParam
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      if (parsedCashflows.length) {
        setCashflows(parsedCashflows);
        setCashflowInputs(parsedCashflows.map(formatNumberWithCommas));
      }
    }
    if (currencyParam && ['$', '€', '£'].includes(currencyParam)) {
      setCurrency(currencyParam);
    }
    if (hurdleEnabledParam !== null) {
      setShowHurdleRate(hurdleEnabledParam === 'true');
    }
    if (hurdleRateParam !== null) {
      const parsedHurdleRate = Number(hurdleRateParam);
      if (Number.isFinite(parsedHurdleRate)) setHurdleRate(parsedHurdleRate);
    }
    if (projectParam) {
      setProjectName(projectParam);
      setLoadedProjectName(projectParam);
    }

    if ([initialValue, discountValue, cashflowsParam, currencyParam, projectParam, hurdleEnabledParam, hurdleRateParam].some((value) => value !== null)) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setSliderBounds({
      initial: getSliderBounds([initial], { minBase: 0, maxBase: 10000 }),
      cashflow: getSliderBounds(cashflows, { minBase: -5000, maxBase: 10000 }),
    });
  }, [initial, cashflows]);

  const saveProject = (name) => {
    if (!name?.trim()) return;
    const trimmedName = name.trim();
    const newProjects = { ...projects, [trimmedName]: { initial, discount, cashflows } };
    setProjects(newProjects);
    localStorage.setItem('npvProjects', JSON.stringify(newProjects));
    setProjectName(trimmedName);
    setLoadedProjectName(trimmedName);
    setInitialInput(formatNumberWithCommas(initial));
    setCashflowInputs(cashflows.map(formatNumberWithCommas));
  };

  const loadProject = (name) => {
    const project = projects[name];
    if (project) {
      setInitial(project.initial);
      setDiscount(project.discount);
      setCashflows(project.cashflows);
      setInitialInput(formatNumberWithCommas(project.initial));
      setCashflowInputs(project.cashflows.map(formatNumberWithCommas));
      setProjectName(name);
      setLoadedProjectName(name);
    }
  };

  const deleteProject = (name) => {
    if (!name || name === 'Delete Project') return;
    const saved = localStorage.getItem('npvProjects');
    const parsed = JSON.parse(saved || '{}');
    delete parsed[name];
    setProjects(parsed);
    localStorage.setItem('npvProjects', JSON.stringify(parsed));
    if (loadedProjectName === name) {
      setLoadedProjectName('');
    }
  };

  const npv = useMemo(() => calculateNPV(initial, discount, cashflows), [initial, discount, cashflows]);
  const irr = useMemo(() => findIRR(initial, cashflows), [initial, cashflows]);
  const payback = useMemo(() => calculatePayback(initial, discount, cashflows), [initial, discount, cashflows]);
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
    let cumulativeLow = -initial;
    let cumulativeHigh = -initial;

    let pvCumulative = -initial;
    let pvCumulativeLow = -initial;
    let pvCumulativeHigh = -initial;

    const rate = discount / 100;

    return [
      {
        name: 'Initial',
        value: -initial,
        pvValue: -initial,
        pvLow: null,
        pvHigh: null,
        cumulative: -initial,
        cumulativeLow: -initial,
        cumulativeHigh: -initial,
        cumulativeBand: [-initial, -initial],
        cumulativeRange: 0,
        pvCumulative: -initial,
        pvCumulativeLow: -initial,
        pvCumulativeHigh: -initial,
        pvCumulativeBand: [-initial, -initial],
        pvCumulativeRange: 0,
      },
      ...cashflows.map((cf, i) => {
        const pvValue = cf / Math.pow(1 + rate, i + 1);
        const pvLow = (cf * 0.9) / Math.pow(1 + rate, i + 1);
        const pvHigh = (cf * 1.1) / Math.pow(1 + rate, i + 1);

        cumulative += cf;
        cumulativeLow += cf * 0.9;
        cumulativeHigh += cf * 1.1;

        pvCumulative += pvValue;
        pvCumulativeLow += pvLow;
        pvCumulativeHigh += pvHigh;

        return {
          name: `Year ${i + 1}`,
          value: cf,
          pvValue,
          pvLow,
          pvHigh,
          cumulative,
          cumulativeLow,
          cumulativeHigh,
          cumulativeBand: [cumulativeLow, cumulativeHigh],
          cumulativeRange: cumulativeHigh - cumulativeLow,
          pvCumulative,
          pvCumulativeLow,
          pvCumulativeHigh,
          pvCumulativeBand: [pvCumulativeLow, pvCumulativeHigh],
          pvCumulativeRange: pvCumulativeHigh - pvCumulativeLow,
        };
      }),
      {
        name: 'NPV',
        value: npv,
        pvValue: null,
        pvLow: null,
        pvHigh: null,
        cumulative: null,
        cumulativeLow: null,
        cumulativeHigh: null,
        cumulativeBand: null,
        cumulativeRange: null,
        pvCumulative: null,
        pvCumulativeLow: null,
        pvCumulativeHigh: null,
        pvCumulativeBand: null,
        pvCumulativeRange: null,
      },
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

  const tornadoRippleData = useMemo(() => {
    const levels = [0.05, 0.1, 0.2];

    const discountShocks = levels.reduce((acc, lvl) => {
      const pts = lvl * 10; // ±0.5, ±1.0, ±2.0 percentage points
      acc[`down${Math.round(lvl * 100)}`] = calculateNPV(initial, discount + pts, cashflows) - npv;
      acc[`up${Math.round(lvl * 100)}`] = calculateNPV(initial, Math.max(0, discount - pts), cashflows) - npv;
      return acc;
    }, {});

    const rows = [
      {
        name: 'Discount',
        ...discountShocks,
      },
      {
        name: 'Initial',
        ...levels.reduce((acc, lvl) => {
          acc[`down${Math.round(lvl * 100)}`] = calculateNPV(initial * (1 + lvl), discount, cashflows) - npv;
          acc[`up${Math.round(lvl * 100)}`] = calculateNPV(initial * (1 - lvl), discount, cashflows) - npv;
          return acc;
        }, {}),
      },
      ...cashflows.map((_, i) => {
        const row = { name: `Year ${i + 1}` };
        levels.forEach((lvl) => {
          const down = [...cashflows];
          down[i] = down[i] * (1 - lvl);
          const up = [...cashflows];
          up[i] = up[i] * (1 + lvl);
          row[`down${Math.round(lvl * 100)}`] = calculateNPV(initial, discount, down) - npv;
          row[`up${Math.round(lvl * 100)}`] = calculateNPV(initial, discount, up) - npv;
        });
        return row;
      }),
    ];

    return rows.sort((a, b) => {
      const aMax = Math.max(
        Math.abs(a.down20 || 0),
        Math.abs(a.up20 || 0),
        Math.abs(a.down10 || 0),
        Math.abs(a.up10 || 0),
        Math.abs(a.down5 || 0),
        Math.abs(a.up5 || 0)
      );
      const bMax = Math.max(
        Math.abs(b.down20 || 0),
        Math.abs(b.up20 || 0),
        Math.abs(b.down10 || 0),
        Math.abs(b.up10 || 0),
        Math.abs(b.down5 || 0),
        Math.abs(b.up5 || 0)
      );
      return bMax - aMax;
    });
  }, [initial, discount, cashflows, npv]);

  const tornadoMaxAbs = useMemo(() => {
    const source = tornadoRippleData.flatMap((d) => [d.down5, d.up5, d.down10, d.up10, d.down20, d.up20]);
    const maxAbs = Math.max(1, ...source.map((v) => Math.abs(v || 0)));
    return Math.ceil(maxAbs / 10) * 10;
  }, [tornadoRippleData]);

  const tornadoChartHeight = useMemo(() => {
    return Math.max(360, tornadoRippleData.length * 38);
  }, [tornadoRippleData]);

  const getGradient = (type, index = null) => {
    let minVal;
    let maxVal;
    switch (type) {
      case 'initial':
        minVal = sliderBounds.initial.min;
        maxVal = sliderBounds.initial.max;
        break;
      case 'discount':
        minVal = 0;
        maxVal = 30;
        break;
      case 'cashflow':
        minVal = sliderBounds.cashflow.min;
        maxVal = sliderBounds.cashflow.max;
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

  const addYear = () => {
    setCashflows([...cashflows, 0]);
    setCashflowInputs([...cashflowInputs, formatNumberWithCommas(0)]);
  };
  const removeYear = (index) => {
    setCashflows(cashflows.filter((_, i) => i !== index));
    setCashflowInputs(cashflowInputs.filter((_, i) => i !== index));
  };

  const exportToCSV = () => {
    const csvContent = `Initial,${initial}\nDiscount Rate,${discount}\nHurdle Rate Enabled,${showHurdleRate}\nHurdle Rate,${showHurdleRate ? hurdleRate : ''}\nCash Flows,${cashflows.join(',')}\nNPV,${npv}\nIRR,${irr}\nPayback,${payback}\nROI,${roi}\nPI,${pi}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'npv_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyProjectLink = async () => {
    const params = new URLSearchParams();
    params.set('initial', String(initial));
    params.set('discount', String(discount));
    params.set('cashflows', cashflows.join(','));
    params.set('currency', currency);
    params.set('hurdleEnabled', String(showHurdleRate));
    if (showHurdleRate) params.set('hurdleRate', String(hurdleRate));
    if (projectName.trim()) params.set('project', projectName.trim());

    const deepLink = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard.writeText(deepLink);
    setCopiedProjectLink(true);
    window.setTimeout(() => setCopiedProjectLink(false), 2000);
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
      ? showHurdleRate && irr > discount && irr < hurdleRate
        ? 'Reject Project: IRR exceeds the discount rate but does not clear the hurdle rate.'
        : npvAtMinus10Cashflow <= 0
          ? 'Consider Project: Positive NPV, but NPV at -10% cash flow turns negative—review downside risk.'
          : 'Accept Project: Positive NPV (robust to a 10% drop in cash flows)—profitable and relatively low risk.'
      : 'Reject/Reassess: Negative NPV—project may not add value. Consider improving cash flows or lowering discount rate assumptions.';

  const sentiment = useMemo(
    () => getSentimentStatus(npv, npvAtMinus10Cashflow, irr, discount, showHurdleRate, hurdleRate),
    [npv, npvAtMinus10Cashflow, irr, discount, showHurdleRate, hurdleRate]
  );
  const npvColor = npv >= 0 ? '#16a34a' : '#dc2626';
  const paybackYear = typeof payback === 'number' ? payback : null;

  const pvBreakEvenInfo = useMemo(() => {
    const yearlyRows = barData.filter((row) => row.name !== 'NPV' && row.pvCumulative !== null && row.pvCumulative !== undefined);
    const crossingIndex = yearlyRows.findIndex((row) => Number(row.pvCumulative) >= 0);

    if (crossingIndex === -1) {
      return {
        firstPositiveLabel: null,
        lastNegativeLabel: yearlyRows.length ? yearlyRows[yearlyRows.length - 1].name : null,
      };
    }

    return {
      firstPositiveLabel: yearlyRows[crossingIndex].name,
      lastNegativeLabel: crossingIndex > 0 ? yearlyRows[crossingIndex - 1].name : null,
    };
  }, [barData]);

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
      .project-toolbar {
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
      .project-toolbar input,
      .project-toolbar select,
      .project-toolbar button {
        height: 34px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        padding: 0 10px;
        font-size: 13px;
      }
      .project-toolbar button {
        background: #111827;
        color: #fff;
        border-color: #111827;
        cursor: pointer;
      }
      .project-toolbar button:hover {
        background: #1f2937;
      }
      .container { display: flex; gap: 12px; margin-top: 72px; }
      .left, .right { padding: 20px; }
      .metrics-dock {
        position: sticky;
        top: 86px;
        margin-top: 12px;
        padding: 14px;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(6px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        z-index: 20;
      }
      .metrics-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        align-items: stretch;
      }
      .metric-pill {
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.72);
      }
      .metric-pill-label {
        display: block;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6b7280;
        margin-bottom: 4px;
      }
      .metric-pill-value {
        display: block;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.15;
        color: #111827;
      }
      .metric-pill-value.compact {
        font-size: 20px;
      }
      .metric-pill-subtext {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #6b7280;
      }
      .metric-pill.sentiment-positive .metric-pill-value { color: #16a34a; }
      .metric-pill.sentiment-caution .metric-pill-value { color: #ca8a04; }
      .metric-pill.sentiment-negative .metric-pill-value { color: #dc2626; }
      .metrics-toggle {
        width: 100%;
        margin-top: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #d1d5db;
        background: rgba(255, 255, 255, 0.72);
        color: #111827;
        font-weight: 700;
        cursor: pointer;
      }
      .metrics-toggle-caret {
        font-size: 14px;
        line-height: 1;
      }
      .metrics-details {
        margin-top: 12px;
      }
      .metrics-dock .metrics h2 { margin: 5px 0; font-size: 26px; }
      .metrics-dock .metrics h2:not(:first-child) { font-size: 18px; font-weight: 600; }
      .metrics-dock .recommendation { margin-top: 10px; font-weight: 600; font-size: 14px; line-height: 1.35; }
      .metrics-dock .thresholds {
        margin-top: 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 10px;
        background: rgba(255, 255, 255, 0.75);
      }
      .metrics-dock .thresholds h3 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .metrics-dock .thresholds p {
        margin: 4px 0;
        font-size: 13px;
      }
      .mobile-metrics-header {
        display: none;
        color: #f9fafb;
      }
      .chart-section {
        margin-top: 20px;
      }
      .chart-section:first-of-type {
        margin-top: 0;
      }
      .chart-title {
        margin-bottom: 12px;
      }
      .chart-subtitle {
        margin-top: -4px;
        margin-bottom: 14px;
        font-size: 12px;
        opacity: 0.85;
      }
      .tornado-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        align-items: center;
        justify-content: center;
        margin-top: 12px;
        font-size: 12px;
        opacity: 0.9;
        text-align: center;
      }
      .tornado-legend-group {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 14px;
        align-items: center;
      }
      .tornado-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .tornado-legend-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
        background: #9ca3af;
      }
      .tornado-legend-swatch.level-5.positive { background: #54a24b; }
      .tornado-legend-swatch.level-10.positive { background: #69c35f; }
      .tornado-legend-swatch.level-20.positive { background: #c8e6c9; }
      .tornado-legend-swatch.level-5.negative { background: #c03f2f; }
      .tornado-legend-swatch.level-10.negative { background: #ef5a43; }
      .tornado-legend-swatch.level-20.negative { background: #f5c2bc; }
      .cashflow-chart-wrap {
        margin-bottom: 28px;
      }
      .factor-subheader {
        margin: 20px 0 12px;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.2;
      }
      .input-stack {
        margin-bottom: 12px;
      }
      .currency-picker {
        margin-bottom: 12px;
      }
      .discount-control {
        text-align: left;
      }
      .add-year-button {
        margin-bottom: 12px;
      }
      .cashflow-row {
        display: flex;
        align-items: stretch;
        gap: 10px;
        margin-bottom: 12px;
      }
      .cashflow-slider-wrap {
        flex: 1;
      }
      .cashflow-input-row {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr);
        align-items: center;
        gap: 0;
        width: 100%;
        margin-bottom: 8px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.9);
      }
      .cashflow-input-segment {
        height: 36px;
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        font-size: 14px;
        font-weight: 600;
        border-right: 1px solid #d1d5db;
        color: #374151;
        background: rgba(249, 250, 251, 0.95);
        white-space: nowrap;
      }
      .cashflow-input-segment.currency {
        min-width: 34px;
        padding: 0 8px;
        justify-content: center;
      }
      .cashflow-number-input {
        height: 36px;
        width: 100%;
        border: 0;
        padding: 0 12px;
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        background: transparent;
        outline: none;
      }
      .delete-btn {
        width: 38px;
        align-self: stretch;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        border: 1px solid #dc2626;
        background: #dc2626;
        color: #fff;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        flex-shrink: 0;
        min-height: 72px;
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
        .project-toolbar {
          background: rgba(17, 24, 39, 0.88);
          border-bottom-color: #374151;
        }
        .project-toolbar input,
        .project-toolbar select {
          background: #111827;
          color: #f9fafb;
          border-color: #4b5563;
        }
        .project-toolbar button {
          background: #6d28d9;
          border-color: #6d28d9;
        }
        .project-toolbar button:hover {
          background: #7c3aed;
        }
        .metrics-dock {
          background: rgba(17, 24, 39, 0.9);
          border-color: #374151;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
        }
        .metric-pill,
        .metrics-toggle,
        .metrics-dock .thresholds,
        .cashflow-input-row {
          background: rgba(17, 24, 39, 0.72);
          border-color: #4b5563;
        }
         .cashflow-input-segment {
          color: #e5e7eb;
          background: rgba(31, 41, 55, 0.96);
          border-right-color: #4b5563;
        }
        .cashflow-number-input {
          color: #f9fafb;
          background: rgba(17, 24, 39, 0.92);
        }
        .metric-pill-label,
        .metric-pill-subtext {
          color: #9ca3af;
        }
        .metric-pill-value,
        .metrics-toggle {
          color: #f9fafb;
        }
        .mobile-metrics-header {
          background: rgba(3, 7, 18, 0.96);
          border-color: #374151;
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
        .container { flex-direction: column; margin-top: 178px; }
        .left, .right { width: 100% !important; padding: 14px; }
        .metrics-dock {
          position: static;
          top: auto;
          margin-top: 10px;
        }
        .metrics-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .mobile-metrics-header {
          position: fixed;
          top: 88px;
          left: 0;
          right: 0;
          z-index: 1100;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #374151;
          background: rgba(17, 24, 39, 0.96);
          backdrop-filter: blur(6px);
          font-size: 12px;
          font-weight: 700;
        }
        .mobile-metrics-header span {
          min-width: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
      @media (max-width: 640px) {
        .project-toolbar {
          padding: 8px;
          gap: 6px;
        }
        .chart-section {
          margin-top: 24px;
        }
        .cashflow-chart-wrap {
          margin-bottom: 34px;
        }
        .project-toolbar input,
        .project-toolbar select,
        .project-toolbar button {
          width: 100%;
          min-width: 0 !important;
        }
        .metrics-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .metric-pill-value {
          font-size: 18px;
        }
        .mobile-metrics-header {
          top: 138px;
          padding: 7px 8px;
          font-size: 11px;
          gap: 4px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .container { margin-top: 232px; }
      }
      `}</style>

      <div className="project-toolbar">
        <input
          placeholder="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={{ minWidth: 170, flex: '1 1 180px' }}
        />
        <button onClick={() => saveProject(projectName)}>Save Project</button>

        <select
          onChange={(e) => loadProject(e.target.value)}
          value={loadedProjectName && !projects[loadedProjectName] ? '__unsaved__' : loadedProjectName || '__placeholder__'}
          style={{ minWidth: 150, flex: '1 1 160px' }}
        >
          <option value="__placeholder__" disabled>
            Load Project
          </option>
          {loadedProjectName && !projects[loadedProjectName] && (
            <option value="__unsaved__">{loadedProjectName} (Unsaved)</option>
          )}
          {Object.keys(projects).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select onChange={(e) => deleteProject(e.target.value)} defaultValue="Delete Project" style={{ minWidth: 155, flex: '1 1 160px' }}>
          <option disabled>Delete Project</option>
          {Object.keys(projects).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>


      </div>

      <div className="mobile-metrics-header">
        <span>
          <strong
            style={{
              color:
                sentiment.tone === 'positive'
                  ? '#16a34a'
                  : sentiment.tone === 'caution'
                    ? '#ca8a04'
                    : '#dc2626',
            }}
          >
            {sentiment.label}
          </strong>
        </span>
        <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
        <span>IRR <strong>{formatMobileIrr(irr)}</strong></span>
        <span>Payback <strong>{formatPaybackDisplay(payback)}</strong></span>
      </div>

      <div className="container">
        <div className="left" style={{ width: '50%' }}>
          <h1>NPV Calculator</h1>

          <select value={currency} onChange={(e) => setCurrency(e.target.value)} title="Display currency (calculations unchanged)" className="currency-picker">
            <option>$</option>
            <option>€</option>
            <option>£</option>
          </select>

          <div title="Initial Investment: Upfront cost of the project. Higher values reduce NPV." className="input-stack">
            <div className="cashflow-input-row">
              <div className="cashflow-input-segment">Initial</div>
              <div className="cashflow-input-segment currency">{currency}</div>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="cashflow-number-input"
                value={initialInput}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  setInitialInput(rawValue);
                  const parsed = parseNumericInput(rawValue);
                  if (parsed !== null) setInitial(parsed);
                }}
                onBlur={() => setInitialInput(formatNumberWithCommas(initial))}
                aria-label="Initial investment value"
              />
            </div>
            <input
              type="range"
              min={sliderBounds.initial.min}
              max={sliderBounds.initial.max}
              step={100}
              value={initial}
              onChange={(e) => {
                const nextInitial = Number(e.target.value);
                setInitial(nextInitial);
                setInitialInput(formatNumberWithCommas(nextInitial));
              }}
              className="slider-initial"
            />
          </div>

          <div className="discount-control">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Discount Rate: {discount}%</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={showHurdleRate}
                  onChange={(e) => setShowHurdleRate(e.target.checked)}
                />
                Hurdle Rate
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              step={0.1}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="slider-discount"
            />
            {showHurdleRate && (
              <div style={{ marginTop: 12 }}>
                <label>Hurdle Rate: {hurdleRate.toFixed(1)}%</label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={0.1}
                  value={hurdleRate}
                  onChange={(e) => setHurdleRate(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <h3 className="factor-subheader">Cash Flows</h3>
          <button onClick={addYear} className="add-year-button">Add Year</button>

          {cashflows.map((cf, index) => (
            <div key={index} className="cashflow-row">
              <div className="cashflow-slider-wrap input-stack">
                <div className="cashflow-input-row">
                  <div className="cashflow-input-segment">Year {index + 1}</div>
                  <div className="cashflow-input-segment currency">{currency}</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="cashflow-number-input"
                    value={cashflowInputs[index] ?? formatNumberWithCommas(cf)}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const newCashflowInputs = [...cashflowInputs];
                      newCashflowInputs[index] = rawValue;
                      setCashflowInputs(newCashflowInputs);

                      const parsed = parseNumericInput(rawValue);
                      if (parsed !== null) {
                        const newCashflows = [...cashflows];
                        newCashflows[index] = parsed;
                        setCashflows(newCashflows);
                      }
                    }}
                    onBlur={() => {
                      const newCashflowInputs = [...cashflowInputs];
                      newCashflowInputs[index] = formatNumberWithCommas(cashflows[index]);
                      setCashflowInputs(newCashflowInputs);
                    }}
                    aria-label={`Year ${index + 1} cash flow value`}
                  />
                </div>
                <input
                  type="range"
                  min={sliderBounds.cashflow.min}
                  max={sliderBounds.cashflow.max}
                  step={100}
                  value={cf}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value);
                    const newCashflows = [...cashflows];
                    newCashflows[index] = nextValue;
                    setCashflows(newCashflows);

                    const newCashflowInputs = [...cashflowInputs];
                    newCashflowInputs[index] = formatNumberWithCommas(nextValue);
                    setCashflowInputs(newCashflowInputs);
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

          <div className="metrics-dock">
            <div className="metrics-summary">
              <div className={`metric-pill sentiment-${sentiment.tone}`}>
                <span className="metric-pill-label">Sentiment</span>
                <span className="metric-pill-value">{sentiment.label}</span>
                <span className="metric-pill-subtext">{sentiment.detail}</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">NPV</span>
                <span className="metric-pill-value compact" style={{ color: npvColor }}>
                  {formatCompactCurrency(npv, currency)}
                </span>
                <span className="metric-pill-subtext">Discounted value</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">IRR</span>
                <span className="metric-pill-value">{irr.toFixed(2)}%</span>
                <span className="metric-pill-subtext">Break-even discount rate</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">Payback</span>
                <span className="metric-pill-value">{formatPaybackDisplay(payback)}</span>
                <span className="metric-pill-subtext">Years to recover investment</span>
              </div>
            </div>

            <button className="metrics-toggle" onClick={() => setShowMetricsDetails((current) => !current)}>
              <span>{showMetricsDetails ? 'Hide details' : 'Show details'}</span>
              <span className="metrics-toggle-caret">{showMetricsDetails ? '▴' : '▾'}</span>
            </button>

            {showMetricsDetails && (
              <div className="metrics-details">
                <div className="metrics">
                  <h2 title="ROI: Total return percentage.">ROI: {roi.toFixed(2)}%</h2>
                  <h2 title="PI: NPV efficiency (&gt;1 is good).">Profitability Index: {pi.toFixed(2)}</h2>
                  <h2 title="NPV at -10% cash flow sensitivity.">NPV at -10% CF: {currency}{npvAtMinus10Cashflow.toFixed(2)}</h2>
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
              </div>
            )}
          </div>

          <button onClick={() => setShowModal(true)}>Learn More (Educational Guide)</button>


          <label style={{ display: 'block', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={showSensitivity}
              onChange={(e) => setShowSensitivity(e.target.checked)}
            />{' '}
            Show Sensitivity Analysis
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <button onClick={exportToCSV}>Export CSV</button>
            <button onClick={copyProjectLink}>{copiedProjectLink ? 'Copied Project Link' : 'Copy Project Link'}</button>
          </div>

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
          <section className="chart-section">
            <h2 className="chart-title">NPV vs Discount Rate</h2>
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
                label={<Label value={`Discount Rate: ${discount.toFixed(1)}%`} position="insideBottom" fill="#c084fc" dy={-2} />}
              />
              {showHurdleRate && (
                <ReferenceLine
                  x={hurdleRate}
                  stroke="#22c55e"
                  strokeDasharray="6 4"
                  label={<Label value={`Hurdle Rate: ${hurdleRate.toFixed(1)}%`} position="insideTopLeft" fill="#22c55e" dx={10} dy={-8} />}
                />
              )}
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
          </section>

          <section className="chart-section cashflow-chart-wrap">
            <h2 className="chart-title">Cash Flows</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={barData} barGap={-22} barCategoryGap="30%">
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CashflowTooltip currency={currency} showSensitivity={showSensitivity} />} />
              <Legend
                payload={[
                  { value: 'PV Cumulative', type: 'line', color: '#a78bfa' },
                  { value: 'Cash Cumulative', type: 'line', color: '#60a5fa' },
                ]}
              />
              {cashflows.length > 0 && (
                <>
                  {pvBreakEvenInfo.firstPositiveLabel ? (
                    <>
                      <ReferenceArea
                        x1="Initial"
                        x2={pvBreakEvenInfo.lastNegativeLabel || 'Initial'}
                        fill="#ef4444"
                        fillOpacity={0.08}
                        ifOverflow="hidden"
                      />
                      <ReferenceArea
                        x1={pvBreakEvenInfo.firstPositiveLabel}
                        x2={`Year ${cashflows.length}`}
                        fill="#22c55e"
                        fillOpacity={0.08}
                        ifOverflow="hidden"
                      />
                    </>
                  ) : (
                    <ReferenceArea
                      x1="Initial"
                      x2={`Year ${cashflows.length}`}
                      fill="#ef4444"
                      fillOpacity={0.08}
                      ifOverflow="hidden"
                    />
                  )}
                </>
              )}
              <Bar dataKey="value" name="Cash Flow" legendType="none" fillOpacity={0.35} barSize={24}>
                {barData.map((entry, index) => {
                  const isNpv = entry.name === 'NPV';
                  const fill = isNpv ? (entry.value >= 0 ? '#22c55e' : '#ef4444') : '#3b82f6';
                  return <Cell key={`cash-cell-${index}`} fill={fill} />;
                })}
              </Bar>
              <Bar dataKey="pvValue" name="PV Cash Flow" legendType="none" barSize={14}>
                {barData.map((entry, index) => {
                  if (entry.pvValue === null || entry.pvValue === undefined) {
                    return <Cell key={`pv-cell-${index}`} fill="transparent" />;
                  }
                  const isNpv = entry.name === 'NPV';
                  const fill = isNpv ? (entry.value >= 0 ? '#16a34a' : '#dc2626') : '#8b5cf6';
                  return <Cell key={`pv-cell-${index}`} fill={fill} />;
                })}

              </Bar>
              {showSensitivity && (
                <>
                  <Area
                    type="monotone"
                    dataKey="cumulativeLow"
                    stackId="cashBand"
                    legendType="none"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeRange"
                    stackId="cashBand"
                    legendType="none"
                    stroke="none"
                    fill="#60a5fa"
                    fillOpacity={0.16}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="pvCumulativeLow"
                    stackId="pvBand"
                    legendType="none"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="pvCumulativeRange"
                    stackId="pvBand"
                    legendType="none"
                    stroke="none"
                    fill="#a78bfa"
                    fillOpacity={0.16}
                    isAnimationActive={false}
                  />
                </>
              )}
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cash Cumulative"
                stroke="#60a5fa"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              <Line
                type="monotone"
                dataKey="pvCumulative"
                name="PV Cumulative"
                stroke="#a78bfa"
                dot={false}
                strokeWidth={3}
              />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className="chart-section">
            <h2 className="chart-title">Top NPV Drivers (Tornado)</h2>
            <p className="chart-subtitle">
              Two-sided sensitivity: left of zero reduces NPV (risk), right of zero increases NPV (upside). Green helps NPV, red hurts NPV, and longer bars mean bigger impact.
            </p>
            <ResponsiveContainer width="100%" height={tornadoChartHeight}>
              <BarChart data={tornadoRippleData} layout="vertical" margin={{ top: 12, right: 18, left: 40, bottom: 5 }} barGap={-20}>
                <XAxis
                  type="number"
                  domain={[-tornadoMaxAbs, tornadoMaxAbs]}
                  tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`}
                />
                <YAxis type="category" dataKey="name" width={90} interval={0} />
                <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={2} />

              {showSensitivity && (
                <>
                  <Bar dataKey="down20" name="-20%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell
                        key={`down20-${index}`}
                        fill={(entry.down20 || 0) >= 0 ? '#c8e6c9' : '#f5c2bc'}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="down10" name="-10%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`down10-${index}`} fill={(entry.down10 || 0) >= 0 ? '#69c35f' : '#ef5a43'} />
                    ))}
                  </Bar>
                  <Bar dataKey="down5" name="-5%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`down5-${index}`} fill={(entry.down5 || 0) >= 0 ? '#54a24b' : '#c03f2f'} />
                    ))}
                  </Bar>
                  <Bar dataKey="up20" name="+20%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell
                        key={`up20-${index}`}
                        fill={(entry.up20 || 0) >= 0 ? '#c8e6c9' : '#f5c2bc'}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="up10" name="+10%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`up10-${index}`} fill={(entry.up10 || 0) >= 0 ? '#69c35f' : '#ef5a43'} />
                    ))}
                  </Bar>
                  <Bar dataKey="up5" name="+5%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`up5-${index}`} fill={(entry.up5 || 0) >= 0 ? '#54a24b' : '#c03f2f'} />
                    ))}
                  </Bar>
                </>
              )}
              {!showSensitivity && (
                <>
                  <Bar dataKey="down10" name="-10%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`down10-default-${index}`} fill={(entry.down10 || 0) >= 0 ? '#16a34a' : '#dc2626'} />
                    ))}
                  </Bar>
                  <Bar dataKey="up10" name="+10%" barSize={22} radius={[0, 0, 0, 0]}>
                    {tornadoRippleData.map((entry, index) => (
                      <Cell key={`up10-default-${index}`} fill={(entry.up10 || 0) >= 0 ? '#16a34a' : '#dc2626'} />
                    ))}
                  </Bar>
                </>
              )}
                <Tooltip content={<TornadoTooltip currency={currency} showSensitivity={showSensitivity} />} />
              </BarChart>
            </ResponsiveContainer>
            <div className="tornado-legend">
              {showSensitivity ? (
                <>
                  <div className="tornado-legend-group">
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-5 positive" />
                      <span>+ NPV · 5%</span>
                    </span>
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-10 positive" />
                      <span>+ NPV · 10%</span>
                    </span>
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-20 positive" />
                      <span>+ NPV · 20%</span>
                    </span>
                  </div>
                  <div className="tornado-legend-group">
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-5 negative" />
                      <span>- NPV · 5%</span>
                    </span>
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-10 negative" />
                      <span>- NPV · 10%</span>
                    </span>
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-20 negative" />
                      <span>- NPV · 20%</span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="tornado-legend-group">
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-10 positive" />
                      <span>+ NPV · 10%</span>
                    </span>
                  </div>
                  <div className="tornado-legend-group">
                    <span className="tornado-legend-item">
                      <span className="tornado-legend-swatch level-10 negative" />
                      <span>- NPV · 10%</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
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
