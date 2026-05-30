import React, { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { analyzeIRR, calculateNPV, calculatePayback, calculateROI, calculatePI } from './lib/finance.js';
import { formatNumberWithCommas, parseNumericInput } from './lib/input.js';
import { clearStoredSession, consumeMagicLinkSession, fetchCurrentUser, getActiveSession, getStoredSession, isCloudAuthConfigured, requestMagicLink } from './lib/cloudAuth.js';
import { fetchUserEntitlement } from './lib/cloudEntitlements.js';
import { deleteCloudProject, listCloudProjects, upsertCloudProject } from './lib/cloudProjects.js';
import { canSaveProject, FREE_TIER_LIMITS, resolveAccess } from './lib/entitlementAccess.js';
import { startShopifyCheckout } from './lib/shopifyCheckout.js';
import {
  MAX_CASHFLOW_PERIODS,
  PROJECT_NAME_MAX_LENGTH,
  convertIrrAnalysisRateBasis,
  chartTooltipMotionProps,
  formatCompactCurrency,
  formatMobileIrr,
  formatMobileNpv,
  formatPaybackDisplay,
  getAppliedRate,
  getPeriodCollectionLabel,
  getPeriodLabel,
  getPeriodMeta,
  getRateBasisLabel,
  getIrrDisplay,
  getIrrIssueDetail,
  getIrrIssueLabel,
  getSentimentStatus,
  getSliderBounds,
  getSpreadStatus,
  productHighlights,
  sanitizeCashflows,
  sanitizeFinancialValue,
  sanitizeProjectName,
  sanitizeProjectSnapshot,
  sanitizeRateValue,
} from './lib/calculation.js';
import { AuthModal } from './components/auth/AuthModal.jsx';
import { CashflowTooltip, MarginalSensitivityTooltip, NpvTooltip, QuickViewCharts } from './components/chart/QuickViewCharts.jsx';
import { QuickViewVariablePanel } from './components/layout/QuickViewVariablePanel.jsx';
import { ProductModal } from './components/modal/ProductModal.jsx';
import { MobileLibraryPanel } from './components/project/MobileLibraryPanel.jsx';
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
const localProEntitlementEnabled = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PRO_ENTITLEMENT === 'true';
const applyLocalProEntitlement = (loadedEntitlement = { hasPro: false, source: null }) => (
  localProEntitlementEnabled
    ? { ...loadedEntitlement, hasPro: true, source: loadedEntitlement.source || 'local-dev' }
    : loadedEntitlement
);

const App = () => {
  const [initial, setInitial] = useState(1000);
  const [discount, setDiscount] = useState(10);
  const [cashflows, setCashflows] = useState([200, 300, 400, 500, 600]);
  const [currency, setCurrency] = useState('$');
  const [periodMode, setPeriodMode] = useState('years');
  const [rateBasis, setRateBasis] = useState('annual');
  const [showSensitivity, setShowSensitivity] = useState(true);
  const [sensitivityPercent, setSensitivityPercent] = useState(10);
  const [showHurdleRate, setShowHurdleRate] = useState(false);
  const [hurdleRate, setHurdleRate] = useState(12);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [sliderGradientsEnabled, setSliderGradientsEnabled] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProductHero, setShowProductHero] = useState(true);
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [mobileLibraryTab, setMobileLibraryTab] = useState('saved');
  const [mobileMetricsPinned, setMobileMetricsPinned] = useState(false);
  const [showQuickViewMenu, setShowQuickViewMenu] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [quickViewEnabled, setQuickViewEnabled] = useState(true);
  const mobileTopbarRef = useRef(null);
  const projectToolbarRef = useRef(null);
  const [returnToUpgradeAfterAuth, setReturnToUpgradeAfterAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authStatus, setAuthStatus] = useState('idle');
  const [authNotice, setAuthNotice] = useState('');
  const [authSession, setAuthSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [entitlement, setEntitlement] = useState(applyLocalProEntitlement());
  const [checkoutStatus, setCheckoutStatus] = useState('idle');
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [cloudProjects, setCloudProjects] = useState({});
  const [cloudStatus, setCloudStatus] = useState('');
  const [showHurdleWarning, setShowHurdleWarning] = useState(false);
  const [projects, setProjects] = useState({});
  const [projectName, setProjectName] = useState('');
  const [loadedProjectName, setLoadedProjectName] = useState('');
  const [loadedProjectSource, setLoadedProjectSource] = useState('scratch');
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);
  const [sliderBounds, setSliderBounds] = useState({ initial: { min: 0, max: 10000 }, cashflow: { min: -5000, max: 10000 } });
  const [copiedProjectLink, setCopiedProjectLink] = useState(false);
  const [showSaveLocalModal, setShowSaveLocalModal] = useState(false);
  const [saveLocalName, setSaveLocalName] = useState('');
  const [saveTarget, setSaveTarget] = useState('local');
  const [pendingDeleteProjectName, setPendingDeleteProjectName] = useState('');
  const [projectPreviews, setProjectPreviews] = useState({});
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [initialInput, setInitialInput] = useState(formatNumberWithCommas(1000));
  const [rateInput, setRateInput] = useState('10.0');
  const [cashflowInputs, setCashflowInputs] = useState([200, 300, 400, 500, 600].map(formatNumberWithCommas));
  const quickViewInputRefs = useRef([]);
  const pendingQuickViewFocusIndex = useRef(null);
  const discountRateForAnalysis = showHurdleRate ? hurdleRate : discount;
  const appliedDiscountRate = getAppliedRate(discount, periodMode, rateBasis);
  const appliedHurdleRate = getAppliedRate(hurdleRate, periodMode, rateBasis);
  const appliedRateForAnalysis = showHurdleRate ? appliedHurdleRate : appliedDiscountRate;
  const shouldShowAppliedRate = periodMode !== 'years';
  const rateBasisPrefix = rateBasis === 'annual' && shouldShowAppliedRate ? 'Annual ' : '';
  const appliedRateLabel = getRateBasisLabel(periodMode);
  const access = useMemo(() => resolveAccess(entitlement), [entitlement]);
  const isPro = access.hasPro;
  const isFreeExamplePreview = !isPro && loadedProjectSource === 'example';
  const canViewAdvancedExample = isPro || isFreeExamplePreview;
  const effectiveShowSensitivity = showSensitivity && (access.features.sensitivityAnalysis || isFreeExamplePreview);
  const cashflowPeriodLimit = isFreeExamplePreview ? cashflows.length : access.limits.maxCashflowPeriods;
  const canEditProjectStructure = isPro || !isFreeExamplePreview;
  const canAddCashflowPeriod = canEditProjectStructure && cashflows.length < cashflowPeriodLimit;
  const localSaveLimitReached = !isPro && Object.keys(projects || {}).length >= access.limits.maxLocalProjects;
  const cloudSaveLimitReached = !isPro && Object.keys(cloudProjects || {}).length >= access.limits.maxCloudProjects;
  useEffect(() => {
    const saved = localStorage.getItem('npvProjects');
    if (saved) setProjects(JSON.parse(saved));

    const sessionFromUrl = consumeMagicLinkSession();
    const session = sessionFromUrl || getStoredSession();
    if (session) {
      getActiveSession(session).then((activeSession) => {
        if (!activeSession) return null;
        setAuthSession(activeSession);
        return fetchCurrentUser(activeSession);
      }).then((user) => {
        if (!user) return;
        setAuthUser(user);
        setAuthEmail(user.email || '');
        setAuthNotice(sessionFromUrl ? 'You are signed in. Cloud saves are available now.' : '');
      }).catch(() => {
        clearStoredSession();
      });
    }

    const params = new URLSearchParams(window.location.search);
    const initialValue = params.get('initial');
    const discountValue = params.get('discount');
    const cashflowsParam = params.get('cashflows');
    const currencyParam = params.get('currency');
    const periodParam = params.get('period');
    const rateBasisParam = params.get('rateBasis');
    const projectParam = params.get('project');
    const hurdleEnabledParam = params.get('hurdleEnabled');
    const hurdleRateParam = params.get('hurdleRate');

    if (initialValue !== null) {
      const parsedInitial = sanitizeFinancialValue(initialValue);
      if (Number.isFinite(parsedInitial)) {
        setInitial(parsedInitial);
        setInitialInput(formatNumberWithCommas(parsedInitial));
      }
    }
    if (discountValue !== null) {
      const parsedDiscount = sanitizeRateValue(discountValue);
      if (Number.isFinite(parsedDiscount)) {
        setDiscount(parsedDiscount);
        if (hurdleEnabledParam !== 'true') setRateInput(parsedDiscount.toFixed(1));
      }
    }
    if (cashflowsParam) {
      const parsedCashflows = sanitizeCashflows(cashflowsParam.split(','));
      if (parsedCashflows.length) {
        setCashflows(parsedCashflows);
        setCashflowInputs(parsedCashflows.map(formatNumberWithCommas));
      }
    }
    if (currencyParam && ['$', '€', '£'].includes(currencyParam)) {
      setCurrency(currencyParam);
    }
    if (periodParam && ['months', 'quarters', 'years'].includes(periodParam)) {
      setPeriodMode(periodParam);
    }
    if (rateBasisParam && ['annual', 'per-period'].includes(rateBasisParam)) {
      setRateBasis(rateBasisParam);
    }
    if (hurdleEnabledParam !== null) {
      setShowHurdleRate(hurdleEnabledParam === 'true');
    }
    if (hurdleRateParam !== null) {
      const parsedHurdleRate = sanitizeRateValue(hurdleRateParam);
      if (Number.isFinite(parsedHurdleRate)) {
        setHurdleRate(parsedHurdleRate);
        if (hurdleEnabledParam === 'true') setRateInput(parsedHurdleRate.toFixed(1));
      }
    }
    if (projectParam) {
      const sanitizedName = sanitizeProjectName(projectParam);
      setProjectName(sanitizedName);
      setLoadedProjectName(sanitizedName);
    }

    if ([initialValue, discountValue, cashflowsParam, currencyParam, periodParam, rateBasisParam, projectParam, hurdleEnabledParam, hurdleRateParam].some((value) => value !== null)) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!authUser || !authSession) return;

    let cancelled = false;
    getActiveSession(authSession)
      .then((activeSession) => {
        if (!activeSession) {
          throw new Error('Sign in before using cloud project storage.');
        }
        if (cancelled) return null;
        if (activeSession.accessToken !== authSession.accessToken || activeSession.expiresAt !== authSession.expiresAt) {
          setAuthSession(activeSession);
        }
        fetchUserEntitlement(activeSession)
          .then((loadedEntitlement) => {
            if (cancelled) return;
            setEntitlement(applyLocalProEntitlement(loadedEntitlement));
          })
          .catch(() => {
            if (cancelled) return;
            setEntitlement(applyLocalProEntitlement());
          });
        return listCloudProjects(activeSession);
      })
      .then((loadedProjects) => {
        if (cancelled || !loadedProjects) return;
        setCloudProjects(loadedProjects);
        setCloudStatus('Cloud projects are synced.');
      })
      .catch((error) => {
        if (cancelled) return;
        setCloudStatus(error.message || 'Cloud projects could not be loaded.');
      });

    setCloudStatus('Loading cloud projects...');

    return () => {
      cancelled = true;
    };
  }, [authUser, authSession]);

  useEffect(() => {
    setRateInput((showHurdleRate ? hurdleRate : discount).toFixed(1));
  }, [showHurdleRate, hurdleRate, discount]);

  useEffect(() => {
    if (access.hasPro) return;
    if (showSensitivity && !isFreeExamplePreview) setShowSensitivity(false);
    if (showHurdleRate) setShowHurdleRate(false);
    if (!isFreeExamplePreview && periodMode !== 'years') setPeriodMode('years');
    if (!isFreeExamplePreview && rateBasis !== 'annual') setRateBasis('annual');
    if (!isFreeExamplePreview && cashflows.length > FREE_TIER_LIMITS.maxCashflowPeriods) {
      const nextCashflows = cashflows.slice(0, FREE_TIER_LIMITS.maxCashflowPeriods);
      setCashflows(nextCashflows);
      setCashflowInputs(nextCashflows.map(formatNumberWithCommas));
    }
  }, [access.hasPro, isFreeExamplePreview, showSensitivity, showHurdleRate, periodMode, rateBasis, cashflows]);

  useEffect(() => {
    const activeProjectName = loadedProjectName?.trim() || projectName?.trim();
    document.title = activeProjectName ? `NPV Lab | ${activeProjectName}` : 'NPV Lab';
  }, [projectName, loadedProjectName]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previousHtmlOverflowX = root.style.overflowX;
    const previousBodyOverflowX = body.style.overflowX;

    root.style.overflowX = 'hidden';
    body.style.overflowX = 'hidden';

    return () => {
      root.style.overflowX = previousHtmlOverflowX;
      body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  useEffect(() => {
    setSliderBounds({
      initial: getSliderBounds([initial], { minBase: 0, maxBase: 10000 }),
      cashflow: getSliderBounds(cashflows, { minBase: -5000, maxBase: 10000 }),
    });
  }, [initial, cashflows]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewportState = () => {
      const mobileViewport = window.innerWidth <= 640;
      setIsDesktopViewport(window.innerWidth > 640);
      if (mobileViewport) {
        setQuickViewEnabled(true);
        setShowProductHero(false);
      }
    };

    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    return () => window.removeEventListener('resize', syncViewportState);
  }, []);

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

  useEffect(() => {
    const handlePointerDown = (event) => {
      const insideMobileTopbar = mobileTopbarRef.current?.contains(event.target);
      const insideProjectToolbar = projectToolbarRef.current?.contains(event.target);

      if (!insideMobileTopbar && !insideProjectToolbar) {
        setShowQuickViewMenu(false);
        setShowSaveMenu(false);
        setShowShareMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const handleRequireAuth = (mode = 'signin') => {
    setAuthMode(mode);
    setAuthNotice(isCloudAuthConfigured() ? '' : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable magic links.');
    setReturnToUpgradeAfterAuth(showUpgradeModal);
    setShowUpgradeModal(false);
    setShowAuthModal(true);
  };

  const openUpgradeModal = (reason = '') => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  };

  const handleRequestMagicLink = async () => {
    const normalizedEmail = authEmail.trim();
    if (!normalizedEmail) {
      setAuthStatus('error');
      setAuthNotice('Enter an email address so we know where to send the sign-in link.');
      return;
    }

    setAuthStatus('sending');
    setAuthNotice('');

    try {
      await requestMagicLink({
        email: normalizedEmail,
        redirectTo: window.location.href.split('#')[0],
      });
      setAuthStatus('sent');
      setAuthNotice('Check your email for a magic link. It will bring you back here signed in.');
      if (returnToUpgradeAfterAuth) {
        setReturnToUpgradeAfterAuth(false);
      }
    } catch (error) {
      setAuthStatus('error');
      setAuthNotice(error.message || 'Unable to send a magic link right now.');
    }
  };

  const handleSignOut = () => {
    clearStoredSession();
    setAuthSession(null);
    setAuthUser(null);
    setEntitlement(applyLocalProEntitlement());
    setCloudProjects({});
    setCloudStatus('');
  };

  const handleStartCheckout = async (plan) => {
    if (!authSession) {
      handleRequireAuth('register');
      return;
    }

    setCheckoutStatus('starting');
    setCheckoutNotice('');

    try {
      const activeSession = await getActiveSession(authSession);
      if (!activeSession) {
        throw new Error('Sign in before starting checkout.');
      }
      if (activeSession.accessToken !== authSession.accessToken || activeSession.expiresAt !== authSession.expiresAt) {
        setAuthSession(activeSession);
      }
      await startShopifyCheckout({ session: activeSession, plan });
    } catch (error) {
      setCheckoutStatus('error');
      setCheckoutNotice(error.message || 'Unable to start Shopify checkout.');
    }
  };

  const getCurrentProjectSnapshot = () => ({
    initial: sanitizeFinancialValue(initial),
    discount: sanitizeRateValue(discount),
    cashflows: sanitizeCashflows(cashflows, [0]),
    periodMode,
    rateBasis,
    showHurdleRate,
    hurdleRate: sanitizeRateValue(hurdleRate, 12),
  });

  const saveProject = (name) => {
    const trimmedName = sanitizeProjectName(name);
    if (!trimmedName) return null;
    if (isFreeExamplePreview) {
      openUpgradeModal('Free example previews are view-only except for the first cash-flow period. Upgrade to save editable copies and build your own library.');
      return null;
    }
    const saveAccess = canSaveProject({ access, target: 'local', projectName: trimmedName, projects });
    if (!saveAccess.allowed) {
      openUpgradeModal("You've run out of projects you can save. Upgrade to unlock more local and cloud projects.");
      return null;
    }
    const project = getCurrentProjectSnapshot();
    const newProjects = {
      ...projects,
      [trimmedName]: project,
    };
    setProjects(newProjects);
    localStorage.setItem('npvProjects', JSON.stringify(newProjects));
    setProjectName(trimmedName);
    setLoadedProjectName(trimmedName);
    setLoadedProjectSource('local');
    setInitialInput(formatNumberWithCommas(initial));
    setCashflowInputs(cashflows.map(formatNumberWithCommas));
    return project;
  };

  const saveProjectToCloud = async (name) => {
    const trimmedName = sanitizeProjectName(name);
    if (!trimmedName || !authSession || !authUser?.id) return;
    if (isFreeExamplePreview) {
      openUpgradeModal('Free example previews are view-only except for the first cash-flow period. Upgrade to save editable copies and build your own library.');
      return;
    }
    const saveAccess = canSaveProject({ access, target: 'cloud', projectName: trimmedName, projects: cloudProjects });
    if (!saveAccess.allowed) {
      openUpgradeModal("You've run out of cloud projects you can save. Upgrade to unlock more local and cloud projects.");
      return;
    }
    const project = getCurrentProjectSnapshot();
    setCloudStatus('Saving cloud project...');
    const activeSession = await getActiveSession(authSession);
    if (!activeSession) {
      handleSignOut();
      handleRequireAuth('signin');
      throw new Error('Sign in before using cloud project storage.');
    }
    setAuthSession(activeSession);
    const savedProjects = await upsertCloudProject({
      session: activeSession,
      userId: authUser.id,
      name: trimmedName,
      project,
    });
    setCloudProjects((current) => ({
      ...current,
      ...savedProjects,
      [trimmedName]: project,
    }));
    setProjectName(trimmedName);
    setLoadedProjectName(trimmedName);
    setLoadedProjectSource('cloud');
    setInitialInput(formatNumberWithCommas(initial));
    setCashflowInputs(cashflows.map(formatNumberWithCommas));
    setCloudStatus('Cloud project saved.');
    return project;
  };

  const handleSaveLocally = () => {
    if (isFreeExamplePreview) {
      openUpgradeModal('Free example previews cannot be saved. Upgrade to save editable copies and compare your own projects.');
      setShowSaveMenu(false);
      return;
    }
    if (localSaveLimitReached) {
      openUpgradeModal("You've run out of projects you can save. Upgrade to unlock more local and cloud projects.");
      setShowSaveMenu(false);
      return;
    }
    setSaveTarget('local');
    setSaveLocalName(projectName?.trim() || loadedProjectName?.trim() || '');
    setShowSaveLocalModal(true);
    setShowSaveMenu(false);
  };

  const handleSaveToCloud = () => {
    if (isFreeExamplePreview) {
      openUpgradeModal('Free example previews cannot be saved. Upgrade to save editable copies and sync them across devices.');
      setShowSaveMenu(false);
      return;
    }
    if (authUser && cloudSaveLimitReached) {
      openUpgradeModal("You've run out of cloud projects you can save. Upgrade to unlock more local and cloud projects.");
      setShowSaveMenu(false);
      return;
    }
    if (!authUser) {
      handleRequireAuth('signin');
      setShowSaveMenu(false);
      return;
    }

    setSaveTarget('cloud');
    setSaveLocalName(projectName?.trim() || loadedProjectName?.trim() || '');
    setShowSaveLocalModal(true);
    setShowSaveMenu(false);
  };

  const handleConfirmSave = async () => {
    if (!saveLocalName?.trim()) return;
    try {
      if (saveTarget === 'cloud') {
        const savedProject = await saveProjectToCloud(saveLocalName);
        if (!savedProject) return;
      } else {
        const savedProject = saveProject(saveLocalName);
        if (!savedProject) return;
      }
      setShowSaveLocalModal(false);
    } catch (error) {
      setCloudStatus(error.message || 'Unable to save project.');
    }
  };

  const applyProject = (name, project, source = 'project') => {
    if (project) {
      const sanitizedProject = sanitizeProjectSnapshot(project);
      const sanitizedName = sanitizeProjectName(name);
      setInitial(sanitizedProject.initial);
      setDiscount(sanitizedProject.discount);
      setCashflows(sanitizedProject.cashflows);
      setShowHurdleRate(sanitizedProject.showHurdleRate);
      setHurdleRate(sanitizedProject.hurdleRate);
      setPeriodMode(sanitizedProject.periodMode);
      setRateBasis(sanitizedProject.rateBasis);
      setInitialInput(formatNumberWithCommas(sanitizedProject.initial));
      setCashflowInputs(sanitizedProject.cashflows.map(formatNumberWithCommas));
      setProjectName(sanitizedName);
      setLoadedProjectName(sanitizedName);
      setLoadedProjectSource(source);
    }
  };

  const loadProject = (name, source = 'local') => {
    applyProject(name, source === 'cloud' ? cloudProjects[name] : projects[name], source);
  };

  const loadExampleProject = (project) => {
    applyProject(project.name, project, 'example');
    setShowSensitivity(true);
  };

  const deleteProject = (name, source = 'local') => {
    if (!name || name === 'Delete Project') return;
    if (source === 'cloud' && cloudProjects[name] && authSession) {
      getActiveSession(authSession)
        .then((activeSession) => {
          if (!activeSession) {
            handleSignOut();
            handleRequireAuth('signin');
            throw new Error('Sign in before using cloud project storage.');
          }
          setAuthSession(activeSession);
          return deleteCloudProject({ session: activeSession, name });
        })
        .then(() => {
          setCloudProjects((current) => {
            const next = { ...current };
            delete next[name];
            return next;
          });
          setCloudStatus('Cloud project deleted.');
        })
        .catch((error) => setCloudStatus(error.message || 'Unable to delete cloud project.'));
      return;
    }
    const saved = localStorage.getItem('npvProjects');
    const parsed = JSON.parse(saved || '{}');
    delete parsed[name];
    setProjects(parsed);
    localStorage.setItem('npvProjects', JSON.stringify(parsed));
    if (loadedProjectName === name) {
      setLoadedProjectName('');
    }
  };

  const npv = useMemo(() => calculateNPV(initial, appliedRateForAnalysis, cashflows), [initial, appliedRateForAnalysis, cashflows]);
  const rawIrrAnalysis = useMemo(() => analyzeIRR(initial, cashflows), [initial, cashflows]);
  const irrAnalysis = useMemo(() => convertIrrAnalysisRateBasis(rawIrrAnalysis, periodMode, rateBasis), [rawIrrAnalysis, periodMode, rateBasis]);
  const irr = irrAnalysis.value;
  const payback = useMemo(() => calculatePayback(initial, appliedRateForAnalysis, cashflows), [initial, appliedRateForAnalysis, cashflows]);
  const roi = useMemo(() => calculateROI(initial, cashflows), [initial, cashflows]);
  const pi = useMemo(() => calculatePI(npv, initial), [npv, initial]);

  const discountData = useMemo(() => {
    const data = [];
    for (let r = 0; r <= 30; r += 0.5) {
      const appliedRate = getAppliedRate(r, periodMode, rateBasis);
      const npvVal = calculateNPV(initial, appliedRate, cashflows);
      const entry = {
        discount: r,
        appliedRate,
        npv: npvVal,
        npv_pos: npvVal >= 0 ? npvVal : null,
        npv_neg: npvVal < 0 ? npvVal : null,
      };
      if (effectiveShowSensitivity) {
        const sensitivityFactor = sensitivityPercent / 100;
        const lowCashflows = cashflows.map((cf) => cf * (1 - sensitivityFactor));
        const highCashflows = cashflows.map((cf) => cf * (1 + sensitivityFactor));
        const lowNpv = calculateNPV(initial, appliedRate, lowCashflows);
        const highNpv = calculateNPV(initial, appliedRate, highCashflows);

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
  }, [initial, cashflows, effectiveShowSensitivity, sensitivityPercent, periodMode, rateBasis]);

  const barData = useMemo(() => {
    let cumulative = -initial;
    let cumulativeLow = -initial;
    let cumulativeHigh = -initial;
    let pvCumulative = -initial;
    let pvCumulativeLow = -initial;
    let pvCumulativeHigh = -initial;
    const rate = appliedRateForAnalysis / 100;

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
        const sensitivityFactor = sensitivityPercent / 100;
        const pvLow = (cf * (1 - sensitivityFactor)) / Math.pow(1 + rate, i + 1);
        const pvHigh = (cf * (1 + sensitivityFactor)) / Math.pow(1 + rate, i + 1);
        cumulative += cf;
        cumulativeLow += cf * (1 - sensitivityFactor);
        cumulativeHigh += cf * (1 + sensitivityFactor);
        pvCumulative += pvValue;
        pvCumulativeLow += pvLow;
        pvCumulativeHigh += pvHigh;

        return {
          name: getPeriodLabel(periodMode, i + 1),
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
  }, [initial, cashflows, npv, appliedRateForAnalysis, sensitivityPercent, periodMode]);

  const sensitivityData = useMemo(() => {
    const variations = [-sensitivityPercent, 0, sensitivityPercent];
    return variations.map((varPct) => {
      const variedCashflows = cashflows.map((cf) => cf * (1 + varPct / 100));
      return { variation: varPct, npv: calculateNPV(initial, appliedRateForAnalysis, variedCashflows) };
    });
  }, [initial, appliedRateForAnalysis, cashflows, sensitivityPercent]);

  const marginalSensitivityData = useMemo(() => {
    const rows = [
      {
        name: 'Initial',
        impactPerDollar: -1,
        note: 'Every extra $1 of upfront cost reduces NPV by $1.00.',
      },
      ...cashflows.map((_, i) => {
        const impact = 1 / Math.pow(1 + appliedRateForAnalysis / 100, i + 1);
        return {
          name: getPeriodLabel(periodMode, i + 1),
          impactPerDollar: impact,
          note: `A $1 change in ${getPeriodLabel(periodMode, i + 1)} cash flow changes NPV by about ${currency}${impact.toFixed(2)}.`,
        };
      }),
    ];

    return rows;
  }, [cashflows, appliedRateForAnalysis, currency, periodMode]);

  const downsideIrr = useMemo(() => {
    const lowCashflows = cashflows.map((cf) => cf * (1 - sensitivityPercent / 100));
    return convertIrrAnalysisRateBasis(analyzeIRR(initial, lowCashflows), periodMode, rateBasis);
  }, [initial, cashflows, sensitivityPercent, periodMode, rateBasis]);

  const viabilityPass = npv > 0;
  const irrIssueDetail = getIrrIssueDetail(irrAnalysis);
  const irrIssueLabel = getIrrIssueLabel(irrAnalysis);
  const irrSupportsPositiveDecision = ['above-range', 'not-applicable'].includes(irrAnalysis.status);
  const downsideIrrSupportsPositiveDecision = ['above-range', 'not-applicable'].includes(downsideIrr.status);
  const irrClearsActiveRate = irrSupportsPositiveDecision || (irrAnalysis.status === 'valid' && irr >= discountRateForAnalysis);
  const downsideIrrClearsActiveRate = downsideIrrSupportsPositiveDecision || (downsideIrr.status === 'valid' && downsideIrr.value >= discountRateForAnalysis);
  const spread = irrAnalysis.status === 'valid' ? irr - discountRateForAnalysis : Number.NaN;
  const spreadStatus = useMemo(() => (
    irrAnalysis.status === 'valid'
      ? getSpreadStatus(spread)
      : irrSupportsPositiveDecision
        ? { label: irrAnalysis.status === 'not-applicable' ? 'N/A' : 'Strong', tone: 'positive', detail: irrIssueDetail }
        : { label: 'N/A', tone: 'caution', detail: irrIssueDetail }
  ), [irrAnalysis.status, spread, irrIssueDetail, irrSupportsPositiveDecision]);
  const spreadPass = irrClearsActiveRate;
  const fragilityPass = downsideIrrClearsActiveRate;

  const breakEvenCashflowUpliftPct = useMemo(() => {
    const pvOfCashflows = cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + appliedRateForAnalysis / 100, i + 1), 0);
    if (pvOfCashflows <= 0) return null;
    const multiplier = initial / pvOfCashflows;
    return (multiplier - 1) * 100;
  }, [initial, appliedRateForAnalysis, cashflows]);

  const maxInitialAtNpvZero = useMemo(() => {
    return cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + appliedRateForAnalysis / 100, i + 1), 0);
  }, [appliedRateForAnalysis, cashflows]);

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
    const stops = [];
    for (let i = 0; i <= steps; i++) {
      const val = minVal + (maxVal - minVal) * (i / steps);
      const tempInitial = type === 'initial' ? val : initial;
      const tempDiscount = type === 'discount' ? getAppliedRate(val, periodMode, rateBasis) : appliedRateForAnalysis;
      const tempCashflows = [...cashflows];
      if (type === 'cashflow' && index !== null) tempCashflows[index] = val;
      const tempNpv = calculateNPV(tempInitial, tempDiscount, tempCashflows);
      const color = getSliderSegmentColor({
        npvValue: tempNpv,
        activeRate: tempDiscount,
        scenarioInitial: tempInitial,
        scenarioCashflows: tempCashflows,
      });
      const percent = (i / steps) * 100;
      stops.push(`${color} ${percent}%`);
    }

    return `linear-gradient(to right, ${stops.join(', ')})`;
  };

  const addYear = () => {
    if (!canAddCashflowPeriod) {
      openUpgradeModal(isFreeExamplePreview ? 'Free example previews only let you edit the first cash-flow period. Upgrade to edit the full template.' : 'Free projects are limited to 5 cash-flow periods. Upgrade to unlock longer horizons.');
      return;
    }
    if (cashflows.length >= MAX_CASHFLOW_PERIODS) return;
    setCashflows([...cashflows, 0]);
    setCashflowInputs([...cashflowInputs, formatNumberWithCommas(0)]);
  };

  const removeYear = (index) => {
    setCashflows(cashflows.filter((_, i) => i !== index));
    setCashflowInputs(cashflowInputs.filter((_, i) => i !== index));
  };

  const exportToCSV = () => {
    const csvContent = `Initial,${initial}\nRate Basis,${rateBasis}\nAnnual Discount Rate,${discount}\nApplied Discount Rate,${appliedDiscountRate}\nHurdle Rate Enabled,${showHurdleRate}\nAnnual Hurdle Rate,${showHurdleRate ? hurdleRate : ''}\nApplied Hurdle Rate,${showHurdleRate ? appliedHurdleRate : ''}\nCash Flows,${cashflows.join(',')}\nNPV,${npv}\nIRR,${getIrrDisplay(irrAnalysis)}\nIRR Status,${irrAnalysis.status}\nPayback,${payback}\nROI,${roi}\nPI,${pi}`;
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
    const project = getCurrentProjectSnapshot();
    params.set('initial', String(project.initial));
    params.set('discount', String(project.discount));
    params.set('cashflows', project.cashflows.join(','));
    params.set('currency', currency);
    params.set('period', project.periodMode);
    params.set('rateBasis', project.rateBasis);
    params.set('hurdleEnabled', String(project.showHurdleRate));
    if (project.showHurdleRate) params.set('hurdleRate', String(project.hurdleRate));
    const sanitizedName = sanitizeProjectName(projectName);
    if (sanitizedName) params.set('project', sanitizedName);

    const deepLink = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard.writeText(deepLink);
    setCopiedProjectLink(true);
    window.setTimeout(() => setCopiedProjectLink(false), 2000);
  };

  useEffect(() => {
    if (!showMobileLibrary) return;

    const buildPreviews = (projectSet) => Object.entries(projectSet || {}).reduce((acc, [name, project]) => {
      const previewPeriodMode = ['months', 'quarters', 'years'].includes(project.periodMode) ? project.periodMode : 'years';
      const previewRateBasis = project.rateBasis === 'per-period' ? 'per-period' : 'annual';
      const previewRate = project.showHurdleRate ? (typeof project.hurdleRate === 'number' ? project.hurdleRate : project.discount) : project.discount;
      const previewAppliedRate = getAppliedRate(previewRate, previewPeriodMode, previewRateBasis);
      const previewNpv = calculateNPV(project.initial, previewAppliedRate, project.cashflows);
      const previewIrrAnalysis = convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows), previewPeriodMode, previewRateBasis);
      const previewPayback = calculatePayback(project.initial, previewAppliedRate, project.cashflows);
      const viability = previewNpv > 0;
      const previewDownsideIrr = convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows.map((cf) => cf * 0.9)), previewPeriodMode, previewRateBasis);
      const fragility = ['above-range', 'not-applicable'].includes(previewDownsideIrr.status) || (previewDownsideIrr.status === 'valid' && previewDownsideIrr.value >= previewRate);
      const previewSpread = previewIrrAnalysis.status === 'valid' ? previewIrrAnalysis.value - previewRate : Number.NaN;
      const previewSpreadStatus = previewIrrAnalysis.status === 'valid'
        ? getSpreadStatus(previewSpread)
        : ['above-range', 'not-applicable'].includes(previewIrrAnalysis.status)
          ? { label: previewIrrAnalysis.status === 'not-applicable' ? 'N/A' : 'Strong', tone: 'positive', detail: previewIrrAnalysis.reason }
          : { label: 'N/A', tone: 'caution', detail: previewIrrAnalysis.reason };
      const previewSentiment = getSentimentStatus({ viabilityPass: viability, spreadStatus: previewSpreadStatus, fragilityPass: fragility });

      acc[name] = {
        npv: previewNpv,
        irr: previewIrrAnalysis.value,
        irrAnalysis: previewIrrAnalysis,
        payback: previewPayback,
        periodMode: previewPeriodMode,
        label: previewSentiment.label,
        tone: previewSentiment.tone,
        currency,
      };
      return acc;
    }, {});

    setProjectPreviews({
      cloud: buildPreviews(cloudProjects),
      local: buildPreviews(projects),
    });
  }, [showMobileLibrary, cloudProjects, projects, currency]);

  const getSliderSegmentColor = ({ npvValue, activeRate, scenarioInitial, scenarioCashflows }) => {
    if (npvValue < 0) return '#ef4444';
    if (effectiveShowSensitivity) {
      const sensitivityFactor = sensitivityPercent / 100;
      const downsideCashflows = scenarioCashflows.map((cf) => cf * (1 - sensitivityFactor));
      const downsideNpv = calculateNPV(scenarioInitial, activeRate, downsideCashflows);
      if (downsideNpv < 0) return '#eab308';
    }
    return '#22c55e';
  };

  const getSegmentedSliderTrack = (type, index = null) => {
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
        return '#525252';
    }

    const steps = 28;
    const segments = [];
    for (let i = 0; i < steps; i++) {
      const startPercent = (i / steps) * 100;
      const endPercent = ((i + 1) / steps) * 100;
      const val = minVal + (maxVal - minVal) * ((i + 0.5) / steps);
      const tempInitial = type === 'initial' ? val : initial;
      const tempRate = type === 'discount' ? getAppliedRate(val, periodMode, rateBasis) : appliedRateForAnalysis;
      const tempCashflows = [...cashflows];
      if (type === 'cashflow' && index !== null) tempCashflows[index] = val;
      const tempNpv = calculateNPV(tempInitial, tempRate, tempCashflows);
      const color = getSliderSegmentColor({
        npvValue: tempNpv,
        activeRate: tempRate,
        scenarioInitial: tempInitial,
        scenarioCashflows: tempCashflows,
      });
      segments.push(`${color} ${startPercent}%`, `${color} ${endPercent}%`);
    }

    return `linear-gradient(to right, ${segments.join(', ')})`;
  };

  const activeRateGradient = sliderGradientsEnabled ? getGradient('discount') : getSegmentedSliderTrack('discount');
  const inactiveRateGradient = 'linear-gradient(to right, #525252, #525252)';

  let sliderCss = `
  .slider-initial::-webkit-slider-runnable-track { background: ${sliderGradientsEnabled ? getGradient('initial') : getSegmentedSliderTrack('initial')}; }
  .slider-initial::-moz-range-track { background: ${sliderGradientsEnabled ? getGradient('initial') : getSegmentedSliderTrack('initial')}; }
  .slider-discount::-webkit-slider-runnable-track { background: ${showHurdleRate ? inactiveRateGradient : activeRateGradient}; }
  .slider-discount::-moz-range-track { background: ${showHurdleRate ? inactiveRateGradient : activeRateGradient}; }
  .slider-hurdle::-webkit-slider-runnable-track { background: ${showHurdleRate ? activeRateGradient : inactiveRateGradient}; }
  .slider-hurdle::-moz-range-track { background: ${showHurdleRate ? activeRateGradient : inactiveRateGradient}; }
  `;

  cashflows.forEach((_, index) => {
    sliderCss += `
    .slider-cashflow-${index}::-webkit-slider-runnable-track { background: ${sliderGradientsEnabled ? getGradient('cashflow', index) : getSegmentedSliderTrack('cashflow', index)}; }
    .slider-cashflow-${index}::-moz-range-track { background: ${sliderGradientsEnabled ? getGradient('cashflow', index) : getSegmentedSliderTrack('cashflow', index)}; }
    `;
  });

  const recommendation =
    !viabilityPass
      ? 'Reject Project: Base NPV is below zero, so the project does not create value under the current assumptions.'
      : !['valid', 'above-range', 'not-applicable'].includes(irrAnalysis.status)
        ? `${irrIssueLabel}: ${irrIssueDetail}`
      : !spreadPass
        ? 'Borderline Project: IRR does not clear the active rate, so the return spread is not sufficient yet.'
        : !fragilityPass
          ? 'Cautious Project: The base case passes, but the downside scenario fails the fragility check.'
          : spreadStatus.label === 'Thin'
            ? 'Cautious Project: The project passes, but the spread above the active rate is still thin.'
            : spreadStatus.label === 'Good'
              ? 'Promising Project: The project clears the active rate with a decent spread and holds up reasonably well.'
              : 'Accept Project: The base case, spread, and downside case all pass strongly.';

  const addQuickViewYear = () => {
    if (!canAddCashflowPeriod) {
      openUpgradeModal(isFreeExamplePreview ? 'Free example previews only let you edit the first cash-flow period. Upgrade to edit the full template.' : 'Free projects are limited to 5 cash-flow periods. Upgrade to unlock longer horizons.');
      return;
    }
    if (cashflows.length >= MAX_CASHFLOW_PERIODS) return;
    setCashflows((current) => [...current, 0]);
    setCashflowInputs((current) => [...current, formatNumberWithCommas(0)]);
  };

  const insertQuickViewYearAfter = (index) => {
    if (!canAddCashflowPeriod) {
      openUpgradeModal(isFreeExamplePreview ? 'Free example previews only let you edit the first cash-flow period. Upgrade to edit the full template.' : 'Free projects are limited to 5 cash-flow periods. Upgrade to unlock longer horizons.');
      return;
    }
    if (cashflows.length >= MAX_CASHFLOW_PERIODS) return;
    const insertAt = index + 1;
    pendingQuickViewFocusIndex.current = insertAt;
    setCashflows((current) => {
      const next = [...current];
      next.splice(insertAt, 0, 0);
      return next;
    });
    setCashflowInputs((current) => {
      const next = [...current];
      next.splice(insertAt, 0, '');
      return next;
    });
  };

  const sentiment = useMemo(() => getSentimentStatus({ viabilityPass, spreadStatus, fragilityPass }), [viabilityPass, spreadStatus, fragilityPass]);
  const npvColor = npv >= 0 ? '#16a34a' : '#dc2626';

  useEffect(() => {
    const focusIndex = pendingQuickViewFocusIndex.current;
    if (focusIndex === null) return;

    const nextInput = quickViewInputRefs.current[focusIndex];
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
      pendingQuickViewFocusIndex.current = null;
    }
  }, [cashflows.length]);

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
              NPV Lab combines fast scenario analysis, visual reasoning, and a growing premium workflow for students, instructors, and finance learners.
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

      {[
        { key: 'mobile', className: 'mobile-topbar-shell', ref: mobileTopbarRef },
        { key: 'desktop', className: 'mobile-topbar-shell mobile-topbar-shell-desktop', ref: projectToolbarRef },
      ].map(({ key, className, ref }) => (
        <div key={key} className={className} ref={ref}>
          <button
            type="button"
            className="mobile-topbar-action mobile-topbar-action-left"
            onClick={() => {
              setMobileLibraryTab('saved');
              setShowMobileLibrary(true);
              setShowSaveMenu(false);
              setShowQuickViewMenu(false);
              setShowShareMenu(false);
            }}
            aria-label="Open project library"
          >
            <svg className="mobile-topbar-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.379a1.5 1.5 0 0 1 1.06.44l1.242 1.242A1.5 1.5 0 0 0 12.242 8h7.258A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
            </svg>
          </button>
          <div className="mobile-topbar-menu-wrap">
            <button type="button" className={`mobile-topbar-action mobile-topbar-action-left mobile-topbar-save ${isFreeExamplePreview ? 'is-disabled' : ''}`} onClick={() => {
              if (isFreeExamplePreview) {
                openUpgradeModal('Free example previews cannot be saved. Upgrade to save editable copies and build your own project library.');
                return;
              }
              setShowSaveMenu((value) => !value);
              setShowQuickViewMenu(false);
              setShowShareMenu(false);
            }} aria-label="Save options" aria-disabled={isFreeExamplePreview} title={isFreeExamplePreview ? 'Saving is locked for free example previews.' : 'Save options'}>
              <svg className="mobile-topbar-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4.75h11.5l2.75 2.75v11A1.5 1.5 0 0 1 17.75 20h-11.5A1.5 1.5 0 0 1 4.75 18.5v-12A1.75 1.75 0 0 1 6.5 4.75Z" />
                <path d="M8 4.75v5.5h7v-4" />
                <path d="M8.25 20v-5.5h7.5V20" />
              </svg>
            </button>
            {showSaveMenu && (
              <div className="mobile-topbar-menu mobile-topbar-menu-left">
                <button
                  type="button"
                  className="mobile-topbar-menu-item"
                  onClick={handleSaveToCloud}
                >
                  {authUser ? 'Save to Cloud' : 'Sign In to Save to Cloud'}
                  {cloudSaveLimitReached && <span className="pro-texture-badge">PRO</span>}
                </button>
                <button
                  type="button"
                  className="mobile-topbar-menu-item"
                  onClick={() => {
                    handleSaveLocally();
                    setShowSaveMenu(false);
                  }}
                >
                  Save Locally
                  {localSaveLimitReached && <span className="pro-texture-badge">PRO</span>}
                </button>
              </div>
            )}
          </div>
          <div className="mobile-topbar-brand">
            <span className="mobile-topbar-title">NPV Lab</span>
            {entitlement.hasPro && <span className="mobile-topbar-pro-badge" aria-label="Upgraded account">Pro</span>}
          </div>
          <div className="mobile-topbar-menu-wrap">
            <button type="button" className="mobile-topbar-action mobile-topbar-action-right" onClick={() => {
              setShowQuickViewMenu((value) => !value);
              setShowSaveMenu(false);
              setShowShareMenu(false);
            }} aria-label="More options">
              <svg className="mobile-topbar-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5.5a1.25 1.25 0 1 0 0 .01" />
                <path d="M12 12a1.25 1.25 0 1 0 0 .01" />
                <path d="M12 18.5a1.25 1.25 0 1 0 0 .01" />
              </svg>
            </button>
            {showQuickViewMenu && (
              <div className="mobile-topbar-menu">
                {authUser ? (
                  <div className="mobile-topbar-account-block">
                    <div className="mobile-topbar-account-header">
                      <span>Signed in:</span>
                      <strong>{authUser.email}</strong>
                    </div>
                    <button type="button" className="mobile-topbar-menu-item" onClick={handleSignOut}>
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mobile-topbar-menu-item"
                    onClick={() => {
                      handleRequireAuth('signin');
                      setShowQuickViewMenu(false);
                    }}
                  >
                    Sign In
                  </button>
                )}
                <label className="mobile-topbar-menu-item mobile-topbar-menu-item-select">
                  <span>Currency</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} title="Display currency (calculations unchanged)">
                    <option>$</option>
                    <option>€</option>
                    <option>£</option>
                  </select>
                </label>
                <label className="mobile-topbar-menu-item mobile-topbar-menu-item-select">
                  <span>Periods</span>
                  <select value={periodMode} onChange={(e) => {
                    if (!access.features.dynamicPeriods && e.target.value !== 'years') {
                      openUpgradeModal('Dynamic monthly and quarterly period calculations are unlocked with an upgraded account.');
                      setShowQuickViewMenu(false);
                      return;
                    }
                    setPeriodMode(e.target.value);
                    setShowQuickViewMenu(false);
                  }}>
                    <option value="months">Months</option>
                    <option value="quarters">Quarters</option>
                    <option value="years">Years</option>
                  </select>
                </label>
                <label className="mobile-topbar-menu-item mobile-topbar-menu-item-select">
                  <span>Sensitivity</span>
                  <select className={!access.features.sensitivityAnalysis && !isFreeExamplePreview ? 'locked-select-blur' : ''} value={effectiveShowSensitivity ? String(sensitivityPercent) : 'locked'} onChange={(e) => {
                    if (!access.features.sensitivityAnalysis && !isFreeExamplePreview) {
                      openUpgradeModal('Sensitivity analysis is locked on the free tier. Upgrade to see downside and upside cash-flow swings.');
                      setShowQuickViewMenu(false);
                      return;
                    }
                    setShowSensitivity(true);
                    setSensitivityPercent(Number(e.target.value));
                    setShowQuickViewMenu(false);
                  }}>
                    {!access.features.sensitivityAnalysis && !isFreeExamplePreview && <option value="locked">••••</option>}
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="20">20%</option>
                  </select>
                </label>
                <label className="mobile-topbar-menu-item mobile-topbar-menu-item-toggle">
                  <span>Slider Gradients</span>
                  <input type="checkbox" checked={sliderGradientsEnabled} onChange={(e) => {
                    setSliderGradientsEnabled(e.target.checked);
                    setShowQuickViewMenu(false);
                  }} />
                </label>
              </div>
            )}
          </div>
          <div className="mobile-topbar-menu-wrap">
            <button type="button" className="mobile-topbar-action mobile-topbar-action-right" onClick={() => {
              setShowShareMenu((value) => !value);
              setShowSaveMenu(false);
              setShowQuickViewMenu(false);
            }} aria-label="Share options">
              <svg className="mobile-topbar-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V5" />
                <path d="m7 10 5-5 5 5" />
                <path d="M5 19h14" />
              </svg>
            </button>
            {showShareMenu && (
              <div className="mobile-topbar-menu mobile-topbar-menu-right">
                <button
                  type="button"
                  className={`mobile-topbar-menu-item ${copiedProjectLink ? 'mobile-topbar-menu-item-success' : ''}`}
                  onClick={async () => {
                    await copyProjectLink();
                    window.setTimeout(() => setShowShareMenu(false), 1000);
                  }}
                >
                  {copiedProjectLink ? '✓ Copied Project Link' : 'Copy Project Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {mobileMetricsPinned && (
        <div className="mobile-metrics-header mobile-metrics-header-pinned">
          <span>
            <strong style={{ color: sentiment.tone === 'positive' ? '#16a34a' : sentiment.tone === 'caution' ? '#ca8a04' : '#dc2626' }}>{sentiment.label}</strong>
          </span>
          <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
          <span>IRR <strong>{formatMobileIrr(irrAnalysis)}</strong></span>
          <span>Payback <strong>{formatPaybackDisplay(payback, periodMode)}</strong></span>
        </div>
      )}

      <div className={`app-shell-header ${(showProductHero && !quickViewEnabled) ? '' : 'app-shell-header-hidden-mobile'}`}>
        <div className="app-shell-brand">
          <h1 className="app-title">NPV Lab</h1>
          {entitlement.hasPro && <span className="app-shell-pro-badge" aria-label="Upgraded account">Pro</span>}
        </div>
      </div>

      {quickViewEnabled ? (
        <div className={`quick-view-shell ${isDesktopViewport ? 'quick-view-shell-desktop' : ''}`}>
          <div className="quick-view-stage">
            <QuickViewCharts
              currency={currency}
              periodMode={periodMode}
              showSensitivity={effectiveShowSensitivity}
              sensitivityPercent={sensitivityPercent}
              setSensitivityPercent={setSensitivityPercent}
              access={access}
              canViewAdvancedExample={canViewAdvancedExample}
              onRequestUpgrade={openUpgradeModal}
              discountData={discountData}
              barData={barData}
              marginalSensitivityData={marginalSensitivityData}
              sensitivityData={sensitivityData}
              irrAnalysis={irrAnalysis}
              discount={discount}
              appliedDiscountRate={appliedDiscountRate}
              showHurdleRate={showHurdleRate}
              hurdleRate={hurdleRate}
              appliedHurdleRate={appliedHurdleRate}
              rateBasis={rateBasis}
              rateBasisLabel={appliedRateLabel}
              shouldShowAppliedRate={shouldShowAppliedRate}
              cashflows={cashflows}
              pvBreakEvenInfo={pvBreakEvenInfo}
              sentiment={sentiment}
              recommendation={recommendation}
              viabilityPass={viabilityPass}
              spreadPass={spreadPass}
              spread={spread}
              spreadStatus={spreadStatus}
              fragilityPass={fragilityPass}
              discountRateForAnalysis={discountRateForAnalysis}
              payback={payback}
              breakEvenCashflowUpliftPct={breakEvenCashflowUpliftPct}
              maxInitialAtNpvZero={maxInitialAtNpvZero}
              isDesktopViewport={isDesktopViewport}
            />
          </div>
          <QuickViewVariablePanel
            sentiment={sentiment}
            periodMode={periodMode}
            rateBasisPrefix={rateBasisPrefix}
            appliedRateForAnalysis={appliedRateForAnalysis}
            appliedRateLabel={appliedRateLabel}
            shouldShowAppliedRate={shouldShowAppliedRate}
            isDesktopViewport={isDesktopViewport}
            npvColor={npvColor}
            npv={npv}
            currency={currency}
            irrAnalysis={irrAnalysis}
            payback={payback}
            initialInput={initialInput}
            setInitialInput={setInitialInput}
            initial={initial}
            setInitial={setInitial}
            insertQuickViewYearAfter={insertQuickViewYearAfter}
            sliderBounds={sliderBounds}
            showHurdleRate={showHurdleRate}
            rateInput={rateInput}
            setRateInput={setRateInput}
            hurdleRate={hurdleRate}
            setHurdleRate={setHurdleRate}
            discount={discount}
            setDiscount={setDiscount}
            setShowHurdleRate={setShowHurdleRate}
            cashflows={cashflows}
            cashflowInputs={cashflowInputs}
            setCashflowInputs={setCashflowInputs}
            setCashflows={setCashflows}
            quickViewInputRefs={quickViewInputRefs}
            removeYear={removeYear}
            addQuickViewYear={addQuickViewYear}
            access={access}
            onRequestUpgrade={openUpgradeModal}
            isFreeExamplePreview={isFreeExamplePreview}
          />
        </div>
      ) : (
      <div className="container">
        <div className="mobile-metrics-header mobile-metrics-header-inline">
          <span className="mobile-sentiment-dot-wrap">
            <span className={`mobile-sentiment-dot sentiment-${sentiment.tone}`} aria-label={sentiment.label} title={sentiment.label} />
          </span>
          <span>NPV <strong style={{ color: npvColor }}>{formatMobileNpv(npv, currency)}</strong></span>
          <span>IRR <strong>{formatMobileIrr(irrAnalysis)}</strong></span>
          <span>Payback <strong>{formatPaybackDisplay(payback, periodMode)}</strong></span>
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
                  if (parsed !== null) setInitial(sanitizeFinancialValue(parsed));
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
              <label className="rate-toggle-label">{rateBasisPrefix}Discount Rate: {discount.toFixed(1)}%</label>
              {access.features.hurdleRate && (
                <span className="rate-checkbox-label">
                  <input type="checkbox" checked={showHurdleRate} onChange={(e) => setShowHurdleRate(e.target.checked)} />
                  Hurdle Rate
                </span>
              )}
            </div>
            {shouldShowAppliedRate && <div className="rate-derived-line">{appliedRateLabel}: {appliedDiscountRate.toFixed(2)}%</div>}
            <input type="range" min={0} max={30} step={0.1} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="slider-discount" />
            {showHurdleRate && (
              <div className="hurdle-rate-control">
                <div className="hurdle-rate-label-row">
                  <span>{rateBasisPrefix}Hurdle Rate: {hurdleRate.toFixed(1)}%</span>
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
                {shouldShowAppliedRate && <div className="rate-derived-line">{appliedRateLabel}: {appliedHurdleRate.toFixed(2)}%</div>}
                <input type="range" min={0} max={30} step={0.1} value={hurdleRate} onChange={(e) => setHurdleRate(Number(e.target.value))} className="slider-hurdle" />
              </div>
            )}
          </div>

          <h3 className="factor-subheader">Cash Flows</h3>
          <button onClick={addYear} className="button-secondary add-year-button">Add {getPeriodMeta(periodMode).singular}{!canAddCashflowPeriod && <span className="pro-texture-badge">PRO</span>}</button>

          {cashflows.map((cf, index) => (
            <div key={index} className="cashflow-row">
              <div className="cashflow-slider-wrap input-stack">
                <div className="cashflow-input-row">
                  <div className="cashflow-input-segment">{getPeriodLabel(periodMode, index + 1)}</div>
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
                        newCashflows[index] = sanitizeFinancialValue(parsed);
                        setCashflows(newCashflows);
                      }
                    }}
                    onBlur={() => {
                      const newCashflowInputs = [...cashflowInputs];
                      newCashflowInputs[index] = formatNumberWithCommas(cashflows[index]);
                      setCashflowInputs(newCashflowInputs);
                    }}
                    aria-label={`${getPeriodLabel(periodMode, index + 1)} cash flow value`}
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
              <button onClick={() => removeYear(index)} className="delete-btn" title={`Delete ${getPeriodLabel(periodMode, index + 1)}`} aria-label={`Delete ${getPeriodLabel(periodMode, index + 1)}`}>
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
              <div className={`metric-pill metric-pill-sentiment-inline sentiment-${sentiment.tone}`}>
                <span className="metric-pill-label">Sentiment</span>
                <span className="metric-pill-value metric-pill-value-sentiment-inline">{sentiment.label}</span>
                <span className="metric-pill-subtext">{sentiment.detail}</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">NPV</span>
                <span className="metric-pill-value compact" style={{ color: npvColor }}>{formatCompactCurrency(npv, currency)}</span>
                <span className="metric-pill-subtext">Discounted value</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">IRR {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span>
                <span className="metric-pill-value">{getIrrDisplay(irrAnalysis)}</span>
                <span className="metric-pill-subtext">{irrIssueLabel || 'Break-even discount rate'}</span>
              </div>
              <div className="metric-pill">
                <span className="metric-pill-label">Payback</span>
                <span className="metric-pill-value">{formatPaybackDisplay(payback, periodMode)}</span>
                <span className="metric-pill-subtext">{getPeriodCollectionLabel(periodMode)} to recover investment</span>
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
                    Discounting source: {showHurdleRate ? `${rateBasisPrefix.toLowerCase()}hurdle rate (${hurdleRate.toFixed(1)}%)${shouldShowAppliedRate ? `, applied as ${appliedHurdleRate.toFixed(2)}%` : ''}` : `${rateBasisPrefix.toLowerCase()}discount rate (${discount.toFixed(1)}%)${shouldShowAppliedRate ? `, applied as ${appliedDiscountRate.toFixed(2)}%` : ''}`}
                  </div>
                  <div className="details-rule-list">
                    <div className={`details-rule ${viabilityPass ? 'pass' : 'fail'}`}>
                      <span className="details-rule-name">Creates Value</span>
                      <span className="details-rule-status">{viabilityPass ? 'Pass' : 'Fail'}</span>
                      <span className="details-rule-subtext">NPV &gt; 0 using {discountRateForAnalysis.toFixed(1)}% {rateBasis}</span>
                    </div>
                    <div className={`details-rule ${spreadStatus.tone === 'positive' ? 'pass' : spreadStatus.tone === 'negative' ? 'fail' : 'warn'}`}>
                      <span className="details-rule-name">Spread {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span>
                      <span className="details-rule-status">{spreadStatus.label}</span>
                      <span className="details-rule-subtext">{irrAnalysis.status === 'valid' ? `IRR spread versus active rate: ${spread >= 0 ? '+' : ''}${spread.toFixed(2)} pts` : irrIssueDetail}</span>
                    </div>
                    <div className={`details-rule ${fragilityPass ? 'pass' : 'fail'}`}>
                      <span className="details-rule-name">Durable {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</span>
                      <span className="details-rule-status">{['valid', 'above-range', 'not-applicable'].includes(downsideIrr.status) ? (fragilityPass ? 'Pass' : 'Fail') : 'N/A'}</span>
                      <span className="details-rule-subtext">
                        {downsideIrr.status === 'not-applicable' ? getIrrIssueDetail(downsideIrr) : downsideIrr.status === 'above-range' ? `Downside IRR is above ${downsideIrr.bound}%, clearing the active rate.` : downsideIrr.status === 'valid' ? (showHurdleRate ? `Downside IRR (${downsideIrr.value.toFixed(2)}%) ≥ annual hurdle (${hurdleRate.toFixed(1)}%)` : `Downside IRR (${downsideIrr.value.toFixed(2)}%) ≥ annual discount (${discount.toFixed(1)}%)`) : getIrrIssueDetail(downsideIrr)}
                      </span>
                    </div>
                  </div>
                  <p className="recommendation">{recommendation}</p>
                </section>

                <section className="details-panel thresholds">
                  <h3 className="details-panel-title">Breakeven Analysis</h3>
                  <div className="details-list">
                    <p>Break-even discount rate (IRR): <strong>{getIrrDisplay(irrAnalysis)}</strong> {irrIssueLabel && <span className="irr-info-icon" title={irrIssueDetail}>i</span>}</p>
                    <p>Discounted payback period at {discountRateForAnalysis.toFixed(1)}% {rateBasis} ({appliedRateForAnalysis.toFixed(2)}% applied): <strong>{formatPaybackDisplay(payback, periodMode)}</strong></p>
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
            Sensitivity{' '}
            <select className={!access.features.sensitivityAnalysis && !isFreeExamplePreview ? 'locked-select-blur' : ''} value={effectiveShowSensitivity ? String(sensitivityPercent) : 'locked'} onChange={(e) => {
              if (!access.features.sensitivityAnalysis && !isFreeExamplePreview) {
                openUpgradeModal('Sensitivity analysis is locked on the free tier. Upgrade to see downside and upside cash-flow swings.');
                return;
              }
              setShowSensitivity(true);
              setSensitivityPercent(Number(e.target.value));
            }}>
              {!access.features.sensitivityAnalysis && !isFreeExamplePreview && <option value="locked">••••</option>}
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
            </select>
          </label>

          <div className="action-button-row">
            <button onClick={() => {
              if (!access.features.exportReports) {
                openUpgradeModal('Exportable reports are locked on the free tier. Upgrade to prepare CSV now and richer XLSX, PDF, and presentation exports later.');
                return;
              }
              exportToCSV();
            }} className="button-secondary">Export CSV</button>
            <button onClick={copyProjectLink} className="button-secondary">{copiedProjectLink ? 'Copied Project Link' : 'Copy Project Link'}</button>
          </div>

          {effectiveShowSensitivity && (
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
            <h2 className="chart-title">NPV vs {rateBasisPrefix}Discount Rate</h2>
            <p className="chart-subtitle">
              {shouldShowAppliedRate
                ? `Cash flows: ${getPeriodMeta(periodMode).appliedLabel}. Discount rate: ${discount.toFixed(1)}% annual, applied as ${appliedDiscountRate.toFixed(2)}% per ${getPeriodMeta(periodMode).singular.toLowerCase()}.`
                : 'See how the project’s discounted value changes as the required rate rises, and where it crosses into unattractive territory.'}
            </p>
            <ResponsiveContainer width="100%" height={236}>
              <LineChart data={discountData} margin={{ top: 22, right: 18, left: 0, bottom: 28 }}>
                <XAxis dataKey="discount" type="number" domain={[0, 30]} />
                <YAxis />
                <Tooltip {...chartTooltipMotionProps} cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }} content={<NpvTooltip currency={currency} showSensitivity={effectiveShowSensitivity} sensitivityPercent={sensitivityPercent} periodMode={periodMode} rateBasis={rateBasis} />} />
                <Line type="monotone" dataKey="npv_pos" stroke="green" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                <Line type="monotone" dataKey="npv_neg" stroke="red" dot={false} activeDot={{ r: 4 }} strokeWidth={3} isAnimationActive={false} />
                {irrAnalysis.roots.map((root) => (
                  <ReferenceLine key={root} x={root} stroke="#7dd3fc" strokeDasharray="3 3" label={<Label value={`IRR: ${root.toFixed(2)}%`} position="insideTopRight" fill="#7dd3fc" dx={-10} dy={-8} />} />
                ))}
                {!showHurdleRate && (
                  <ReferenceLine x={discount} stroke="#c084fc" strokeDasharray="3 3" label={<Label value={`Annual Disc: ${discount.toFixed(1)}%`} position="insideBottom" fill="#c084fc" dy={-2} />} />
                )}
                {showHurdleRate && (
                  <ReferenceLine x={hurdleRate} stroke="#22c55e" strokeDasharray="6 4" label={<Label value={`Annual Hurdle: ${hurdleRate.toFixed(1)}%`} position="insideBottom" fill="#22c55e" dy={-2} />} />
                )}
                {effectiveShowSensitivity && (
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
                <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={2} />
                <Tooltip {...chartTooltipMotionProps} content={<CashflowTooltip currency={currency} showSensitivity={effectiveShowSensitivity} sensitivityPercent={sensitivityPercent} />} />
                <Legend payload={[{ value: 'PV Cumulative', type: 'line', color: '#a78bfa' }, { value: 'Cash Cumulative', type: 'line', color: '#60a5fa' }]} />
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
                {effectiveShowSensitivity && (
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
                <Tooltip {...chartTooltipMotionProps} content={<MarginalSensitivityTooltip currency={currency} />} />
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

      {!isPro && (
        <button type="button" className="floating-upgrade-button" onClick={() => openUpgradeModal('Upgrade to unlock more saved projects, full editing on examples, sensitivity analysis, and deeper charts.')}>
          <span className="floating-upgrade-label">Upgrade</span>
          <span className="floating-upgrade-badge pro-texture-badge">PRO</span>
        </button>
      )}

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
        localProjects={projects}
        cloudProjects={cloudProjects}
        onLoadProject={loadProject}
        onLoadExampleProject={loadExampleProject}
        pendingDeleteProjectKey={pendingDeleteProjectName}
        onRequestDeleteProject={setPendingDeleteProjectName}
        onCancelDeleteProject={() => setPendingDeleteProjectName('')}
        onConfirmDeleteProject={(name, source) => {
          deleteProject(name, source);
          setPendingDeleteProjectName('');
        }}
        projectPreviews={projectPreviews}
        cloudStatus={cloudStatus}
        access={access}
      />

      {showSaveLocalModal && (
        <div className="modal" onClick={() => setShowSaveLocalModal(false)}>
          <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="upgrade-modal-header">
              <div>
                <h2>{saveTarget === 'cloud' ? 'Cloud Save' : 'Local Save'}</h2>
              </div>
            </div>
            <div className="auth-card">
              <div className="local-save-warning" role="alert">
                {saveTarget === 'cloud'
                  ? 'Saved to your passwordless cloud library. Project ownership is enforced by database row-level security.'
                  : 'Saved in this browser only. Project may be lost if browser storage is cleared, the app data is reset, or you switch devices.'}
              </div>
              <label className="auth-field">
                <span>Project name</span>
                <input
                  type="text"
                  value={saveLocalName}
                  onChange={(e) => setSaveLocalName(e.target.value.slice(0, PROJECT_NAME_MAX_LENGTH))}
                  maxLength={PROJECT_NAME_MAX_LENGTH}
                  placeholder="My NPV Project"
                  className="local-save-input"
                />
              </label>
              {saveTarget === 'cloud' && cloudStatus && <p className="auth-footnote">{cloudStatus}</p>}
              <div className="auth-actions">
                <button type="button" className="button-primary" onClick={handleConfirmSave}>{saveTarget === 'cloud' ? 'Save to Cloud' : 'Save Locally'}</button>
                <button type="button" className="button-secondary" onClick={() => setShowSaveLocalModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        onRequestMagicLink={handleRequestMagicLink}
        authStatus={authStatus}
        authNotice={authNotice}
      />

      <ProductModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade NPV Lab"
        isAuthenticated={Boolean(authUser)}
        userLabel={authUser ? authUser.email : 'Not signed in'}
        checkoutStatus={checkoutStatus}
        checkoutNotice={checkoutNotice}
        reason={upgradeReason}
        onStartCheckout={handleStartCheckout}
        onRequireAuth={() => handleRequireAuth('register')}
      />
    </>
  );
};

export default App;
