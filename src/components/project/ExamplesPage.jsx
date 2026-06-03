import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, XAxis, YAxis } from 'recharts';
import { analyzeIRR } from '../../lib/finance.js';
import { convertIrrAnalysisRateBasis, formatMobileIrr, formatMobileNpv, formatPaybackDisplay } from '../../lib/calculation.js';
import {
  buildExampleDiscountCurve,
  exampleProjects,
  getExampleSlug,
  getProjectPreview,
} from './projectData.js';

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString()}`;

const ExampleCurve = ({ project }) => {
  const data = useMemo(() => buildExampleDiscountCurve(project), [project]);
  const irrAnalysis = useMemo(() => convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows), project.periodMode, project.rateBasis), [project]);
  const activeRate = project.showHurdleRate ? project.hurdleRate : project.discount;

  return (
    <div className="examples-chart-frame" aria-label={`${project.name} NPV curve preview`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
        <LineChart data={data} margin={{ top: 18, right: 18, left: 4, bottom: 18 }}>
          <XAxis dataKey="discount" type="number" domain={[0, 30]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={58} />
          <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.55)" strokeWidth={1} />
          <Line type="monotone" dataKey="npv_pos" stroke="#22c55e" dot={false} activeDot={{ r: 4 }} strokeWidth={4} isAnimationActive={false} />
          <Line type="monotone" dataKey="npv_neg" stroke="#ef4444" dot={false} activeDot={{ r: 4 }} strokeWidth={4} isAnimationActive={false} />
          {irrAnalysis.roots.map((root) => <ReferenceLine key={root} x={root} stroke="#7dd3fc" strokeDasharray="3 3" />)}
          <ReferenceLine x={activeRate} stroke={project.showHurdleRate ? '#22c55e' : '#c084fc'} strokeDasharray="5 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ExamplesPage = ({ onBackToApp, onOpenExample }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProject = exampleProjects[activeIndex] || exampleProjects[0];
  const activePreview = getProjectPreview(activeProject);
  const activeSlug = getExampleSlug(activeProject);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % exampleProjects.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="examples-page-shell">
      <header className="examples-page-header">
        <a href="/" className="legal-brand" onClick={onBackToApp}>NPV Lab</a>
        <button type="button" className="button-secondary" onClick={onBackToApp}>Open Calculator</button>
      </header>

      <main className="examples-page-main">
        <section className="examples-hero">
          <div className="examples-copy">
            <p className="legal-eyebrow">Examples</p>
            <h1>Interactive NPV cases you can open directly in the calculator.</h1>
            <p>
              Browse complete templates with live visual feedback, core inputs, and decision metrics before jumping into the editable app view.
            </p>
          </div>

          <div className={`examples-carousel tone-${activePreview.tone}`}>
            <div className="examples-carousel-topline">
              <div>
                <span className="example-project-kicker">{activeProject.subtitle}</span>
                <h2>{activeProject.name}</h2>
              </div>
              <span className={`examples-status-pill tone-${activePreview.tone}`}>{activePreview.label}</span>
            </div>

            <ExampleCurve project={activeProject} />

            <div className="examples-variable-grid">
              <span><strong>{formatCurrency(activeProject.initial)}</strong>Initial</span>
              <span><strong>{activeProject.showHurdleRate ? `${activeProject.hurdleRate}%` : `${activeProject.discount}%`}</strong>{activeProject.showHurdleRate ? 'Hurdle' : 'Discount'}</span>
              <span><strong>{activeProject.cashflows.length}</strong>{activeProject.periodMode}</span>
              <span><strong>{activeProject.tier.toUpperCase()}</strong>Template</span>
            </div>

            <div className="examples-metric-grid">
              <span><strong style={{ color: activePreview.npv >= 0 ? '#22c55e' : '#ef4444' }}>{formatMobileNpv(activePreview.npv, '$')}</strong>NPV</span>
              <span><strong>{formatMobileIrr(activePreview.irrAnalysis)}</strong>IRR</span>
              <span><strong>{formatPaybackDisplay(activePreview.payback, activeProject.periodMode)}</strong>Payback</span>
            </div>

            <div className="examples-carousel-actions">
              <a className="button-primary" href={`/?example=${activeSlug}`} onClick={(event) => onOpenExample(event, activeSlug)}>
                Open This Example
              </a>
              <a className="button-secondary" href={`/examples/${activeSlug}`}>
                Slug Link
              </a>
            </div>
          </div>
        </section>

        <section className="examples-picker" aria-label="Example templates">
          {exampleProjects.map((project, index) => {
            const preview = getProjectPreview(project);
            const slug = getExampleSlug(project);
            const isActive = index === activeIndex;

            return (
              <button
                key={slug}
                type="button"
                className={`examples-picker-card tone-${preview.tone} ${isActive ? 'active' : ''}`}
                onClick={() => setActiveIndex(index)}
              >
                <span>{project.subtitle}</span>
                <strong>{project.name}</strong>
                <small>{project.description}</small>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
};
