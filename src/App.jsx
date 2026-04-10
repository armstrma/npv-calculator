import React, { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import './App.css';
import { calculateNPV, findIRR, calculatePayback, calculateROI, calculatePI } from './lib/finance.js';
import { formatNumberWithCommas, parseNumericInput } from './lib/input.js';
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

const GuideModal = lazy(() => import('./GuideModal.jsx'));

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

const getSentimentStatus = ({ viabilityPass, standardPass, fragilityPass }) => {
  if (!viabilityPass) {
    return {
      label: 'Reject',
      tone: 'negative',
      detail: 'Base NPV is below zero',
    };
  }

  if (!standardPass) {
    return {
      label: 'Borderline',
      tone: 'caution',
      detail: 'Base case fails the required standard',
    };
  }

  if (!fragilityPass) {
    return {
      label: 'Cautious',
      tone: 'caution',
      detail: 'Downside case fails the fragility check',
    };
  }

  return {
    label: 'Accept',
    tone: 'positive',
    detail: 'Base case and downside case both pass',
  };
};

const formatMobileNpv = (value, currency = '$') => {
  const roundedValue = Math.round(Number(value) || 0);
  return `${currency}${roundedValue.toLocaleString()}`;
};

const formatMobileIrr = (value) => `${Math.round(Number(value) || 0)}%`;

const formatPaybackDisplay = (value) => (typeof value === 'number' ? `${value.toFixed(1)}y` : value);

const getSliderBounds = (values, { minBase = -5000, maxBase = 10000 } = {}) => {
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));

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

const tooltipShellStyle = {
  background: 'rgba(17, 24, 39, 0.92)',
  color: '#f9fafb',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  minWidth: 150,
};

const upgradeFeatures = [
  'Save and organize projects',
  'Share polished project links',
  'Unlock guided decision support',
  'Use hurdle-rate-driven analysis',
  'Get upcoming comparison and presentation workflows',
];

const productHighlights = [
  {
    title: 'Built for learning finance',
    body: 'Go beyond a plain calculator with visual reasoning, decision framing, and storytelling.',
  },
  {
    title: 'Fast enough for live use',
    body: 'Run scenarios in seconds, explain the on-screen, and understand results immediately.',
  },
  {
    title: 'Premium path is ready',
    body: 'Use the free calculator now, but upgrade when you want to save, share, compare, and more.',
  },
];

const pricingPlan = {
  name: 'NPV Lab Pro',
  price: '$4.99/month',
  annual: '$50/year',
  cta: 'Start checkout in app',
};

const exampleProjectCards = [
  { title: 'Office Solar Retrofit', subtitle: 'Sample premium case study', meta: 'Placeholder example' },
  { title: 'New Product Launch', subtitle: 'Pricing and rollout scenario', meta: 'Placeholder example' },
  { title: 'Warehouse Automation', subtitle: 'Capex efficiency model', meta: 'Placeholder example' },
  { title: 'Campus EV Chargers', subtitle: 'Infrastructure decision', meta: 'Placeholder example' },
];

const MobileLibraryPanel = ({ open, onClose, activeTab, setActiveTab, isAuthenticated, onRequireAuth }) => {
  if (!open) return null;

  return (
    <div className="mobile-library-overlay" onClick={onClose}>
      <div className="mobile-library-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-library-topbar">
          <button type="button" className="mobile-library-close" onClick={onClose}>×</button>
        </div>

        <div className="mobile-library-toolbar">
          <button type="button" className="mobile-library-new button-secondary">New Project ▾</button>
        </div>

        <div className="mobile-library-tabs">
          <button type="button" className={`mobile-library-tab ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
            Saved
          </button>
          <button type="button" className={`mobile-library-tab ${activeTab === 'examples' ? 'active' : ''}`} onClick={() => setActiveTab('examples')}>
            Examples
          </button>
        </div>

        {activeTab === 'saved' ? (
          <div className="mobile-library-empty-state">
            <h3>{isAuthenticated ? 'Your saved projects will live here' : 'Create your free account'}</h3>
            <p>
              {isAuthenticated
                ? 'Project organization, recent work, and saved scenarios are coming here next.'
                : 'Log in to save, share, and organize your NPV Lab projects.'}
            </p>
            <div className="mobile-library-auth-actions">
              <button type="button" className="button-secondary" onClick={() => onRequireAuth('signin')}>Log In</button>
              <button type="button" className="button-primary" onClick={() => onRequireAuth('register')}>Sign Up</button>
            </div>
          </div>
        ) : (
          <div className="mobile-library-grid">
            {exampleProjectCards.map((card) => (
              <article key={card.title} className="mobile-library-card">
                <div className="mobile-library-card-thumb" />
                <h4>{card.title}</h4>
                <p>{card.subtitle}</p>
                <span>{card.meta}</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AuthModal = ({ open, onClose, authMode, setAuthMode, authEmail, setAuthEmail, onAuthSuccess }) => {
  if (!open) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2>{authMode === 'signin' ? 'Sign in to continue' : 'Create your account'}</h2>
            <p>Use a lightweight account so projects, purchases, and premium access stay attached to you.</p>
          </div>
          <button type="button" className="button-secondary upgrade-modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="auth-mode-tabs">
          <button type="button" className={`button-secondary auth-mode-tab ${authMode === 'signin' ? 'active' : ''}`} onClick={() => setAuthMode('signin')}>
            Sign in
          </button>
          <button type="button" className={`button-secondary auth-mode-tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => setAuthMode('register')}>
            Register
          </button>
        </div>

        <div className="auth-card">
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <div className="auth-actions">
            <button type="button" className="button-primary" onClick={onAuthSuccess}>
              {authMode === 'signin' ? 'Email me a sign-in link' : 'Create account with email'}
            </button>
            <button type="button" className="button-secondary" onClick={onAuthSuccess}>
              Continue with Google
            </button>
          </div>

          <p className="auth-footnote">
            Recommended eventual stack: Supabase Auth with magic links plus Google OAuth.
          </p>
        </div>
      </div>
    </div>
  );
};

const ProductModal = ({ open, onClose, title = 'Upgrade to Pro', isAuthenticated, userLabel, onStartCheckout, onRequireAuth }) => {
  if (!open) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2>{title}</h2>
            <p>
              Unlock the premium workflow without leaving the calculator.
            </p>
          </div>
        </div>

        <div className="upgrade-account-state">
          <span className="upgrade-account-label">Account</span>
          <strong>{isAuthenticated ? userLabel : 'Not signed in yet'}</strong>
        </div>

        <div className="upgrade-pricing-card">
          <span className="upgrade-plan-name">{pricingPlan.name}</span>
          <div className="upgrade-price-row">
            <strong>{pricingPlan.price}</strong>
            <span>or {pricingPlan.annual}</span>
          </div>
          <p className="upgrade-price-note">Premium tools for saving, sharing, and guided decision-making.</p>
        </div>

        <div className="upgrade-grid single-column">
          <section>
            <h3>What you get</h3>
            <ul className="upgrade-feature-list">
              {upgradeFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="upgrade-actions">
          <button type="button" className="button-primary" onClick={isAuthenticated ? onStartCheckout : onRequireAuth}>
            {isAuthenticated ? pricingPlan.cta : 'Sign in to continue'}
          </button>
          <button type="button" className="button-secondary" onClick={isAuthenticated ? onStartCheckout : onRequireAuth}>
            {isAuthenticated ? 'Open embedded checkout next' : 'Create free account'}
          </button>
          <button type="button" className="button-secondary upgrade-modal-close-bottom" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
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
      {baseNpv !== null && <div style={{ color: baseNpv >= 0 ? '#86efac' : '#fca5a5' }}>NPV: {currency}{baseNpv.toFixed(2)}</div>}
      {showSensitivity && highNpv !== null && <div style={{ color: '#c4b5fd' }}>High (+10% CF): {currency}{highNpv.toFixed(2)}</div>}
      {showSensitivity && lowNpv !== null && <div style={{ color: '#f9a8d4' }}>Low (-10% CF): {currency}{lowNpv.toFixed(2)}</div>}
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
      <div style={{ color: Number(row.value) >= 0 ? '#93c5fd' : '#fca5a5' }}>Cash Flow: {currency}{Number(row.value || 0).toFixed(2)}</div>
      {row.pvValue !== null && row.pvValue !== undefined && <div style={{ color: '#c4b5fd' }}>PV Cash Flow: {currency}{Number(row.pvValue).toFixed(2)}</div>}
      {showSensitivity && row.pvLow !== null && row.pvLow !== undefined && row.pvHigh !== null && row.pvHigh !== undefined && (
        <div style={{ color: '#ddd6fe' }}>
          PV Sensitivity Range: {currency}{Number(row.pvLow).toFixed(2)} → {currency}{Number(row.pvHigh).toFixed(2)}
        </div>
      )}
      {row.cumulative !== null && row.cumulative !== undefined && <div style={{ color: '#60a5fa' }}>Cash Cumulative: {currency}{Number(row.cumulative).toFixed(2)}</div>}
      {row.pvCumulative !== null && row.pvCumulative !== undefined && <div style={{ color: '#a78bfa' }}>PV Cumulative: {currency}{Number(row.pvCumulative).toFixed(2)}</div>}
    </div>
  );
};

const MarginalSensitivityTooltip = ({ active, payload, label, currency }) => {
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

const App = () => {
  const [initial, setInitial] = useState(1000);
  const [discount, setDiscount] = useState(10);
  const [cashflows, setCashflows] = useState([200, 300, 400, 500, 600]);
  const [currency, setCurrency] = useState('$');
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showHurdleRate, setShowHurdleRate] = useState(false);
  const [hurdleRate, setHurdleRate] = useState(12);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProductHero, setShowProductHero] = useState(true);
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [mobileLibraryTab, setMobileLibraryTab] = useState('saved');
  const [mobileMetricsPinned, setMobileMetricsPinned] = useState(false);
  const [showQuickViewMenu, setShowQuickViewMenu] = useState(false);
  const [quickViewEnabled, setQuickViewEnabled] = useState(false);
  const [returnToUpgradeAfterAuth, setReturnToUpgradeAfterAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [showHurdleWarning, setShowHurdleWarning] = useState(false);
  const [projects, setProjects] = useState({});
  const [projectName, setProjectName] = useState('');
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);
  const [sliderBounds, setSliderBounds] = useState({ initial: { min: 0, max: 10000 }, cashflow: { min: -5000, max: 10000 } });
  const [copiedProjectLink, setCopiedProjectLink] = useState(false);
  const [initialInput, setInitialInput] = useState(formatNumberWithCommas(1000));
  const [cashflowInputs, setCashflowInputs] = useState([200, 300, 400, 500, 600].map(formatNumberWithCommas));
  const discountRateForAnalysis = showHurdleRate ? hurdleRate : discount;

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
      const parsedCashflows = cashflowsParam.split(',').map((value) => Number(value)).filter((value) => Number.isFinite(value));
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

  useEffect(() => {
    const syncPinnedMetrics = () => {
      if (window.innerWidth > 640) {
        setMobileMetricsPinned(false);
        return;
      }

      const banner = document.querySelector('.mobile-metrics-header-inline');
      if (!banner) return;

      const topBarOffset = 62;
      const { top } = banner.getBoundingClientRect();
      setMobileMetricsPinned(top <= topBarOffset);
    };

    syncPinnedMetrics();
    window.addEventListener('scroll', syncPinnedMetrics, { passive: true });
    window.addEventListener('resize', syncPinnedMetrics);
    return () => {
      window.removeEventListener('scroll', syncPinnedMetrics);
      window.removeEventListener('resize', syncPinnedMetrics);
    };
  }, [showProductHero]);

  const handleRequireAuth = (mode = 'signin') => {
    setAuthMode(mode);
    setReturnToUpgradeAfterAuth(showUpgradeModal);
    setShowUpgradeModal(false);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    const normalizedEmail = authEmail.trim() || 'goose@example.com';
    setAuthUser({ email: normalizedEmail });
    setShowAuthModal(false);
    if (returnToUpgradeAfterAuth) {
      setShowUpgradeModal(true);
      setReturnToUpgradeAfterAuth(false);
    }
  };

  const handleStartCheckout = () => {
    window.alert('Next step: mount Stripe Embedded Checkout here once the backend session endpoint is wired.');
  };

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

  const npv = useMemo(() => calculateNPV(initial, discountRateForAnalysis, cashflows), [initial, discountRateForAnalysis, cashflows]);
  const irr = useMemo(() => findIRR(initial, cashflows), [initial, cashflows]);
  const payback = useMemo(() => calculatePayback(initial, discountRateForAnalysis, cashflows), [initial, discountRateForAnalysis, cashflows]);
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
    const rate = discountRateForAnalysis / 100;

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
  }, [initial, cashflows, npv, discountRateForAnalysis]);

  const sensitivityData = useMemo(() => {
    const variations = [-10, 0, 10];
    return variations.map((varPct) => {
      const variedCashflows = cashflows.map((cf) => cf * (1 + varPct / 100));
      return { variation: varPct, npv: calculateNPV(initial, discountRateForAnalysis, variedCashflows) };
    });
  }, [initial, discountRateForAnalysis, cashflows]);

  const marginalSensitivityData = useMemo(() => {
    const rows = [
      {
        name: 'Initial',
        impactPerDollar: -1,
        note: 'Every extra $1 of upfront cost reduces NPV by $1.00.',
      },
      ...cashflows.map((_, i) => {
        const impact = 1 / Math.pow(1 + discountRateForAnalysis / 100, i + 1);
        return {
          name: `Year ${i + 1}`,
          impactPerDollar: impact,
          note: `A $1 change in Year ${i + 1} cash flow changes NPV by about ${currency}${impact.toFixed(2)}.`,
        };
      }),
    ];

    return rows;
  }, [cashflows, discountRateForAnalysis, currency]);

  const downsideIrr = useMemo(() => {
    const lowCashflows = cashflows.map((cf) => cf * 0.9);
    return findIRR(initial, lowCashflows);
  }, [initial, cashflows]);

  const viabilityPass = npv > 0;
  const standardPass = showHurdleRate ? irr >= hurdleRate : irr >= discount;
  const fragilityPass = showHurdleRate ? downsideIrr >= hurdleRate : downsideIrr >= discount;

  const breakEvenCashflowUpliftPct = useMemo(() => {
    const pvOfCashflows = cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRateForAnalysis / 100, i + 1), 0);
    if (pvOfCashflows <= 0) return null;
    const multiplier = initial / pvOfCashflows;
    return (multiplier - 1) * 100;
  }, [initial, discountRateForAnalysis, cashflows]);

  const maxInitialAtNpvZero = useMemo(() => {
    return cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRateForAnalysis / 100, i + 1), 0);
  }, [discountRateForAnalysis, cashflows]);

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
      const tempDiscount = type === 'discount' ? val : discountRateForAnalysis;
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

  const activeRateGradient = getGradient('discount');
  const inactiveRateGradient = 'linear-gradient(to right, #525252, #525252)';

  let sliderCss = `
  .slider-initial::-webkit-slider-runnable-track { background: ${getGradient('initial')}; }
  .slider-initial::-moz-range-track { background: ${getGradient('initial')}; }
  .slider-discount::-webkit-slider-runnable-track { background: ${showHurdleRate ? inactiveRateGradient : activeRateGradient}; }
  .slider-discount::-moz-range-track { background: ${showHurdleRate ? inactiveRateGradient : activeRateGradient}; }
  .slider-hurdle::-webkit-slider-runnable-track { background: ${showHurdleRate ? activeRateGradient : inactiveRateGradient}; }
  .slider-hurdle::-moz-range-track { background: ${showHurdleRate ? activeRateGradient : inactiveRateGradient}; }
  `;

  cashflows.forEach((_, index) => {
    sliderCss += `
    .slider-cashflow-${index}::-webkit-slider-runnable-track { background: ${getGradient('cashflow', index)}; }
    .slider-cashflow-${index}::-moz-range-track { background: ${getGradient('cashflow', index)}; }
    `;
  });

  const recommendation =
    !viabilityPass
      ? 'Reject Project: Base NPV is below zero, so the project does not create value under the current assumptions.'
      : !standardPass
        ? 'Borderline Project: The base case is positive, but it does not meet the required standard rate.'
        : !fragilityPass
          ? 'Cautious Project: The base case passes, but the downside scenario fails the fragility check.'
          : 'Accept Project: The base case and downside case both pass the required checks.';

  const sentiment = useMemo(() => getSentimentStatus({ viabilityPass, standardPass, fragilityPass }), [viabilityPass, standardPass, fragilityPass]);
  const npvColor = npv >= 0 ? '#16a34a' : '#dc2626';

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
      <style>{`${sliderCss}`}</style>

      {showProductHero && !quickViewEnabled && (
      <section className="product-page-hero">
        <div className="product-page-copy">
          <div className="product-page-copy-top">
            <h1 className="product-page-title">Learn capital budgeting with a calculator that actually explains the decision.</h1>
            <p className="product-page-subtitle">
              NPV Lab Pro combines fast scenario analysis, visual reasoning, and a growing premium workflow for students, instructors, and finance learners.
            </p>
            <div className="product-page-actions product-page-actions-top desktop-hero-actions">
              <button type="button" className="button-primary hero-pricing-button" onClick={() => setShowUpgradeModal(true)}>
                See Pricing
              </button>
            </div>
          </div>
        </div>
        <div className="product-page-grid-wrap">
          <div className="product-page-grid">
            {productHighlights.map((highlight) => (
              <article key={highlight.title} className="product-highlight-card">
                <h3>{highlight.title}</h3>
                <p>{highlight.body}</p>
              </article>
            ))}
          </div>
          <div className="product-page-actions product-page-actions-bottom mobile-only-hero-actions">
            <button type="button" className="button-primary hero-upgrade-button" onClick={() => setShowUpgradeModal(true)}>
              Upgrade Now
            </button>
            <button
              type="button"
              className="button-secondary hero-dismiss-button"
              onClick={() => {
                setShowProductHero(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </section>
      )}

      <div className="mobile-topbar-shell">
        <button
          type="button"
          className="mobile-topbar-action mobile-topbar-action-left"
          onClick={() => {
            setMobileLibraryTab('saved');
            setShowMobileLibrary(true);
          }}
          aria-label="Open project library"
        >
          <span className="mobile-topbar-icon-glyph">☰</span>
        </button>
        <button type="button" className="mobile-topbar-action mobile-topbar-action-left mobile-topbar-save" onClick={() => saveProject(projectName)}>
          <span>Save</span>
        </button>
        <div className="mobile-topbar-brand">
          <span className="mobile-topbar-title">NPV Lab</span>
          <span className="mobile-topbar-pro-badge">PRO</span>
        </div>
        <div className="mobile-topbar-menu-wrap">
          <button type="button" className="mobile-topbar-action mobile-topbar-action-right" onClick={() => setShowQuickViewMenu((value) => !value)} aria-label="More options">
            <span className="mobile-topbar-icon-glyph">…</span>
          </button>
          {showQuickViewMenu && (
            <div className="mobile-topbar-menu">
              <button
                type="button"
                className="mobile-topbar-menu-item"
                onClick={() => {
                  setQuickViewEnabled((value) => !value);
                  setShowQuickViewMenu(false);
                }}
              >
                {quickViewEnabled ? 'Exit Quick View' : 'Enter Quick View'}
              </button>
            </div>
          )}
        </div>
        <button type="button" className="mobile-topbar-action mobile-topbar-action-right" onClick={copyProjectLink} aria-label="Share project link">
          <svg className="mobile-topbar-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V5" />
            <path d="m7 10 5-5 5 5" />
            <path d="M5 19h14" />
          </svg>
        </button>
      </div>

      <div className={`project-toolbar ${showProductHero ? '' : 'project-toolbar-condensed'}`}>
        <input placeholder="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ minWidth: 170, flex: '1 1 180px' }} />
        <button onClick={() => saveProject(projectName)} className="button-primary">Save Project</button>

        <select
          onChange={(e) => loadProject(e.target.value)}
          value={loadedProjectName && !projects[loadedProjectName] ? '__unsaved__' : loadedProjectName || '__placeholder__'}
          style={{ minWidth: 150, flex: '1 1 160px' }}
        >
          <option value="__placeholder__" disabled>Load Project</option>
          {loadedProjectName && !projects[loadedProjectName] && <option value="__unsaved__">{loadedProjectName} (Unsaved)</option>}
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

      {mobileMetricsPinned && (
        <div className="mobile-metrics-header mobile-metrics-header-pinned">
          <span>
            <strong style={{ color: sentiment.tone === 'positive' ? '#16a34a' : sentiment.tone === 'caution' ? '#ca8a04' : '#dc2626' }}>{sentiment.label}</strong>
          </span>
          <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
          <span>IRR <strong>{formatMobileIrr(irr)}</strong></span>
          <span>Payback <strong>{formatPaybackDisplay(payback)}</strong></span>
        </div>
      )}

      <div className={`app-shell-header ${(showProductHero && !quickViewEnabled) ? '' : 'app-shell-header-hidden-mobile'}`}>
        <div className="app-shell-brand">
          <h1 className="app-title">NPV Lab</h1>
          <span className="app-shell-pro-badge">PRO</span>
        </div>
      </div>

      {quickViewEnabled ? (
        <div className="quick-view-shell">
          <div className="quick-view-stage">
            <button type="button" className="quick-view-stage-nav quick-view-stage-nav-left">‹</button>
            <div className="quick-view-stage-title">Graphs</div>
            <button type="button" className="quick-view-stage-nav quick-view-stage-nav-right">›</button>
          </div>
          <div className="quick-view-controls">
            <div className="quick-view-row">
              <div className="quick-view-row-top">
                <span>Initial</span>
                <span>{currency}</span>
                <input type="text" value={initialInput} readOnly />
                <button type="button">×</button>
              </div>
              <input type="range" min={sliderBounds.initial.min} max={sliderBounds.initial.max} step={100} value={initial} onChange={(e) => {
                const nextInitial = Number(e.target.value);
                setInitial(nextInitial);
                setInitialInput(formatNumberWithCommas(nextInitial));
              }} className="slider-initial" />
            </div>
            <div className="quick-view-row quick-view-row-compact">
              <div className="quick-view-row-top quick-view-row-top-discount">
                <span>{showHurdleRate ? 'Hurdle Rate' : 'Discount Rate'}</span>
                <input type="text" value={(showHurdleRate ? hurdleRate : discount).toFixed(1)} readOnly />
                <span>%</span>
                <label className="quick-view-toggle"><input type="checkbox" checked={showHurdleRate} onChange={(e) => setShowHurdleRate(e.target.checked)} /> Hurdle</label>
                <button type="button">×</button>
              </div>
              <input type="range" min={0} max={30} step={0.1} value={showHurdleRate ? hurdleRate : discount} onChange={(e) => showHurdleRate ? setHurdleRate(Number(e.target.value)) : setDiscount(Number(e.target.value))} className={showHurdleRate ? 'slider-hurdle' : 'slider-discount'} />
            </div>
            {cashflows.slice(0, 2).map((cf, index) => (
              <div key={index} className="quick-view-row quick-view-row-compact">
                <div className="quick-view-row-top">
                  <span>{`Year ${index + 1}`}</span>
                  <span>{currency}</span>
                  <input type="text" value={cashflowInputs[index] ?? formatNumberWithCommas(cf)} readOnly />
                  <button type="button">×</button>
                </div>
                <input type="range" min={sliderBounds.cashflow.min} max={sliderBounds.cashflow.max} step={100} value={cf} onChange={(e) => {
                  const updated = [...cashflows];
                  updated[index] = Number(e.target.value);
                  setCashflows(updated);
                  setCashflowInputs(updated.map(formatNumberWithCommas));
                }} className={`slider-cashflow-${index}`} />
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="container">
        <div className="mobile-metrics-header mobile-metrics-header-inline">
          <span>
            <strong style={{ color: sentiment.tone === 'positive' ? '#16a34a' : sentiment.tone === 'caution' ? '#ca8a04' : '#dc2626' }}>{sentiment.label}</strong>
          </span>
          <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
          <span>IRR <strong>{formatMobileIrr(irr)}</strong></span>
          <span>Payback <strong>{formatPaybackDisplay(payback)}</strong></span>
        </div>
        <div className="left" style={{ width: '50%' }}>

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
            <div className="rate-toggle-row">
              <label className="rate-toggle-label">Discount Rate: {discount.toFixed(1)}%</label>
              <span className="rate-checkbox-label">
                <input type="checkbox" checked={showHurdleRate} onChange={(e) => setShowHurdleRate(e.target.checked)} />
                Hurdle Rate
              </span>
            </div>
            <input type="range" min={0} max={30} step={0.1} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="slider-discount" />
            {showHurdleRate && (
              <div className="hurdle-rate-control">
                <div className="hurdle-rate-label-row">
                  <span>Hurdle Rate: {hurdleRate.toFixed(1)}%</span>
                  {hurdleRate < discount && (
                    <div className="hurdle-warning-wrap">
                      <button
                        type="button"
                        className="hurdle-warning-icon"
                        onClick={() => setShowHurdleWarning((current) => !current)}
                        onMouseEnter={() => setShowHurdleWarning(true)}
                        onMouseLeave={() => setShowHurdleWarning(false)}
                        aria-expanded={showHurdleWarning}
                        aria-label="Show hurdle rate warning"
                      >
                        ⚠️
                      </button>
                      {showHurdleWarning && (
                        <div className="hurdle-warning-tooltip" role="tooltip">
                          Hurdle rates are typically equal to or higher than the discount rate. A hurdle rate below the discount rate may indicate inconsistent assumptions.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input type="range" min={0} max={30} step={0.1} value={hurdleRate} onChange={(e) => setHurdleRate(Number(e.target.value))} className="slider-hurdle" />
              </div>
            )}
          </div>

          <h3 className="factor-subheader">Cash Flows</h3>
          <button onClick={addYear} className="button-secondary add-year-button">Add Year</button>

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
              <button onClick={() => removeYear(index)} className="delete-btn" title={`Delete Year ${index + 1}`} aria-label={`Delete Year ${index + 1}`}>
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
                <span className="metric-pill-value compact" style={{ color: npvColor }}>{formatCompactCurrency(npv, currency)}</span>
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

            <button className="metrics-toggle button-secondary" onClick={() => setShowMetricsDetails((current) => !current)}>
              <span>{showMetricsDetails ? 'Hide details' : 'Show details'}</span>
              <span className="metrics-toggle-caret">{showMetricsDetails ? '▴' : '▾'}</span>
            </button>

            {showMetricsDetails && (
              <div className="metrics-details">
                <section className="details-panel">
                  <h3 className="details-panel-title">Decision Summary</h3>
                  <div className="details-sentiment-header">
                    <div>
                      <span className="details-metric-label">Overall Sentiment</span>
                      <span className={`details-metric-value sentiment-${sentiment.tone}`}>{sentiment.label}</span>
                      <span className="details-metric-subtext">{sentiment.detail}</span>
                    </div>
                  </div>
                  <div className="details-discount-source-badge" role="status">
                    Discounting source: {showHurdleRate ? `Hurdle rate (${hurdleRate.toFixed(1)}%)` : `Discount rate (${discount.toFixed(1)}%)`}
                  </div>
                  <div className="details-rule-list">
                    <div className={`details-rule ${viabilityPass ? 'pass' : 'fail'}`}>
                      <span className="details-rule-name">Viability</span>
                      <span className="details-rule-status">{viabilityPass ? 'Pass' : 'Fail'}</span>
                      <span className="details-rule-subtext">NPV &gt; 0 using {discountRateForAnalysis.toFixed(1)}%</span>
                    </div>
                    <div className={`details-rule ${standardPass ? 'pass' : 'fail'}`}>
                      <span className="details-rule-name">Standard</span>
                      <span className="details-rule-status">{standardPass ? 'Pass' : 'Fail'}</span>
                      <span className="details-rule-subtext">{showHurdleRate ? `IRR ≥ hurdle (${hurdleRate.toFixed(1)}%)` : `IRR ≥ discount (${discount.toFixed(1)}%)`}</span>
                    </div>
                    <div className={`details-rule ${fragilityPass ? 'pass' : 'fail'}`}>
                      <span className="details-rule-name">Fragility</span>
                      <span className="details-rule-status">{fragilityPass ? 'Pass' : 'Fail'}</span>
                      <span className="details-rule-subtext">
                        {showHurdleRate ? `Downside IRR (${downsideIrr.toFixed(2)}%) ≥ hurdle (${hurdleRate.toFixed(1)}%)` : `Downside IRR (${downsideIrr.toFixed(2)}%) ≥ discount (${discount.toFixed(1)}%)`}
                      </span>
                    </div>
                  </div>
                  <p className="recommendation">{recommendation}</p>
                </section>

                <section className="details-panel thresholds">
                  <h3 className="details-panel-title">Breakeven Analysis</h3>
                  <div className="details-list">
                    <p>Break-even discount rate (IRR): <strong>{irr.toFixed(2)}%</strong></p>
                    <p>Discounted payback period at {discountRateForAnalysis.toFixed(1)}%: <strong>{formatPaybackDisplay(payback)}</strong></p>
                    <p>
                      Required cash flow uplift:{' '}
                      <strong>{breakEvenCashflowUpliftPct === null ? 'N/A' : `${breakEvenCashflowUpliftPct >= 0 ? '+' : ''}${breakEvenCashflowUpliftPct.toFixed(1)}%`}</strong>
                    </p>
                    <p>Max initial investment at current rate: <strong>{currency}{maxInitialAtNpvZero.toFixed(2)}</strong></p>
                  </div>
                </section>
              </div>
            )}
          </div>

          <button onClick={() => setShowGuideModal(true)} className="button-secondary button-full">Learn More (Educational Guide)</button>

          <label style={{ display: 'block', marginTop: 10 }}>
            <input type="checkbox" checked={showSensitivity} onChange={(e) => setShowSensitivity(e.target.checked)} /> Show Sensitivity Analysis
          </label>

          <div className="action-button-row">
            <button onClick={exportToCSV} className="button-secondary">Export CSV</button>
            <button onClick={copyProjectLink} className="button-secondary">{copiedProjectLink ? 'Copied Project Link' : 'Copy Project Link'}</button>
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
            <p className="chart-subtitle">See how the project’s discounted value changes as the required rate rises, and where it crosses into unattractive territory.</p>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={discountData} margin={{ top: 22, right: 18, left: 0, bottom: 28 }}>
                <XAxis dataKey="discount" type="number" domain={[0, 30]} />
                <YAxis />
                <Tooltip cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }} content={<NpvTooltip currency={currency} showSensitivity={showSensitivity} />} />
                <Line type="monotone" dataKey="npv_pos" stroke="green" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                <Line type="monotone" dataKey="npv_neg" stroke="red" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                {!Number.isNaN(irr) && (
                  <ReferenceLine x={irr} stroke="#7dd3fc" strokeDasharray="3 3" label={<Label value={`IRR: ${irr.toFixed(2)}%`} position="insideTopRight" fill="#7dd3fc" dx={-10} dy={-8} />} />
                )}
                {!showHurdleRate && (
                  <ReferenceLine x={discount} stroke="#c084fc" strokeDasharray="3 3" label={<Label value={`Discount Rate: ${discount.toFixed(1)}%`} position="insideBottom" fill="#c084fc" dy={-2} />} />
                )}
                {showHurdleRate && (
                  <ReferenceLine x={hurdleRate} stroke="#22c55e" strokeDasharray="6 4" label={<Label value={`Hurdle Rate: ${hurdleRate.toFixed(1)}%`} position="insideBottom" fill="#22c55e" dy={-2} />} />
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
          </section>

          <section className="chart-section cashflow-chart-wrap">
            <h2 className="chart-title">Cash Flows</h2>
            <p className="chart-subtitle">Compare raw cash recovery to discounted recovery so it is clear when time value changes the investment story.</p>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={barData} barGap={-22} barCategoryGap="30%">
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CashflowTooltip currency={currency} showSensitivity={showSensitivity} />} />
                <Legend payload={[{ value: 'PV Cumulative', type: 'line', color: '#a78bfa' }, { value: 'Cash Cumulative', type: 'line', color: '#60a5fa' }]} />
                {cashflows.length > 0 && (
                  <>
                    {pvBreakEvenInfo.firstPositiveLabel ? (
                      <>
                        <ReferenceArea x1="Initial" x2={pvBreakEvenInfo.lastNegativeLabel || 'Initial'} fill="#ef4444" fillOpacity={0.08} ifOverflow="hidden" />
                        <ReferenceArea x1={pvBreakEvenInfo.firstPositiveLabel} x2={`Year ${cashflows.length}`} fill="#22c55e" fillOpacity={0.08} ifOverflow="hidden" />
                      </>
                    ) : (
                      <ReferenceArea x1="Initial" x2={`Year ${cashflows.length}`} fill="#ef4444" fillOpacity={0.08} ifOverflow="hidden" />
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
                    if (entry.pvValue === null || entry.pvValue === undefined) return <Cell key={`pv-cell-${index}`} fill="transparent" />;
                    const isNpv = entry.name === 'NPV';
                    const fill = isNpv ? (entry.value >= 0 ? '#16a34a' : '#dc2626') : '#8b5cf6';
                    return <Cell key={`pv-cell-${index}`} fill={fill} />;
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
          </section>

          <section className="chart-section">
            <h2 className="chart-title">NPV Impact per $1 Change</h2>
            <p className="chart-subtitle">A simple teaching view: how much NPV changes when a factor moves by $1. Earlier cash flows should matter more than later ones.</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={marginalSensitivityData} margin={{ top: 10, right: 18, left: 40, bottom: 5 }}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${currency}${Number(v).toFixed(2)}`} />
                <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={2} />
                <Tooltip content={<MarginalSensitivityTooltip currency={currency} />} />
                <Bar dataKey="impactPerDollar" barSize={26} radius={[4, 4, 0, 0]}>
                  {marginalSensitivityData.map((entry, index) => (
                    <Cell key={`marginal-${index}`} fill={entry.impactPerDollar >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>
      )}

      <button type="button" className="floating-upgrade-button button-primary" onClick={() => setShowUpgradeModal(true)}>
        Upgrade to Pro
      </button>

      {showGuideModal && (
        <Suspense
          fallback={(
            <div className="modal" onClick={() => setShowGuideModal(false)}>
              <div className="modal-content guide-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Educational Guide</h2>
                <p>Loading formulas...</p>
              </div>
            </div>
          )}
        >
          <GuideModal onClose={() => setShowGuideModal(false)} />
        </Suspense>
      )}

      <MobileLibraryPanel
        open={showMobileLibrary}
        onClose={() => setShowMobileLibrary(false)}
        activeTab={mobileLibraryTab}
        setActiveTab={setMobileLibraryTab}
        isAuthenticated={Boolean(authUser)}
        onRequireAuth={(mode) => {
          setShowMobileLibrary(false);
          handleRequireAuth(mode);
        }}
      />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        onAuthSuccess={handleAuthSuccess}
      />

      <ProductModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade without leaving the page"
        isAuthenticated={Boolean(authUser)}
        userLabel={authUser ? authUser.email : 'Not signed in'}
        onStartCheckout={handleStartCheckout}
        onRequireAuth={() => handleRequireAuth('register')}
      />
    </>
  );
};

export default App;
