import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, XAxis, YAxis } from 'recharts';
import { analyzeIRR, calculateNPV } from '../../lib/finance.js';
import { convertIrrAnalysisRateBasis, formatMobileIrr, formatMobileNpv, formatPaybackDisplay, getAppliedRate } from '../../lib/calculation.js';
import * as projectData from './projectData.js';

const { exampleProjects, getProjectPreview } = projectData;

const buildDiscountCurve = (project) => {
  const data = [];
  const periodMode = ['months', 'quarters', 'years'].includes(project.periodMode) ? project.periodMode : 'years';
  const rateBasis = project.rateBasis === 'per-period' ? 'per-period' : 'annual';
  for (let r = 0; r <= 30; r += 1) {
    const npv = calculateNPV(project.initial, getAppliedRate(r, periodMode, rateBasis), project.cashflows);
    data.push({
      discount: r,
      npv,
      npv_pos: npv >= 0 ? npv : null,
      npv_neg: npv < 0 ? npv : null,
    });
  }
  return data;
};

const ExampleProjectPreview = ({ project }) => {
  const data = useMemo(() => buildDiscountCurve(project), [project]);
  const irrAnalysis = useMemo(() => convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows), project.periodMode, project.rateBasis), [project]);
  const activeRate = project.showHurdleRate ? project.hurdleRate : project.discount;

  return (
    <div className="example-project-preview" aria-hidden="true">
      <ResponsiveContainer width="100%" height={96} minWidth={0} minHeight={96}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
          <XAxis dataKey="discount" type="number" domain={[0, 30]} hide />
          <YAxis hide />
          <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.55)" strokeWidth={1} />
          <Line type="monotone" dataKey="npv_pos" stroke="#22c55e" dot={false} activeDot={false} strokeWidth={3} isAnimationActive={false} />
          <Line type="monotone" dataKey="npv_neg" stroke="#ef4444" dot={false} activeDot={false} strokeWidth={3} isAnimationActive={false} />
          {irrAnalysis.roots.map((root) => <ReferenceLine key={root} x={root} stroke="#7dd3fc" strokeDasharray="3 3" />)}
          <ReferenceLine x={activeRate} stroke={project.showHurdleRate ? '#22c55e' : '#c084fc'} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MobileLibraryPanel = ({ open, onClose, activeTab, setActiveTab, isAuthenticated, onRequireAuth, localProjects, cloudProjects, onLoadProject, onLoadExampleProject, pendingDeleteProjectKey, onRequestDeleteProject, onCancelDeleteProject, onConfirmDeleteProject, projectPreviews, cloudStatus, access }) => {
  if (!open) return null;

  const localProjectNames = Object.keys(localProjects || {});
  const cloudProjectNames = Object.keys(cloudProjects || {});
  const renderProjectList = ({ names, source, previews }) => (
    <div className="mobile-library-saved-list">
      {names.map((name) => {
        const preview = previews?.[name];
        const previewTone = preview?.tone || 'neutral';
        const deleteKey = `${source}:${name}`;

        return (
          <div key={deleteKey} className={`mobile-library-saved-item tone-${previewTone}`}>
            <button
              type="button"
              className="mobile-library-saved-open"
              onClick={() => {
                onLoadProject(name, source);
                onClose();
              }}
            >
              <strong>{name}</strong>
              {preview ? (
                <div className="mobile-library-saved-metrics">
                  <span className={`tone-${previewTone}`}>{preview.label}</span>
                  <span style={{ color: preview.npv >= 0 ? '#22c55e' : '#ef4444' }}>NPV {formatMobileNpv(preview.npv, preview.currency)}</span>
                  <span>IRR {formatMobileIrr(preview.irrAnalysis)}</span>
                  <span>Payback {formatPaybackDisplay(preview.payback, preview.periodMode)}</span>
                </div>
              ) : (
                <span>Open saved project</span>
              )}
            </button>
            {pendingDeleteProjectKey === deleteKey ? (
              <div className="mobile-library-saved-confirm">
                <span>Delete?</span>
                <div className="mobile-library-saved-confirm-actions">
                  <button type="button" className="mobile-library-saved-delete confirm" onClick={() => onConfirmDeleteProject(name, source)}>Yes</button>
                  <button type="button" className="mobile-library-saved-delete cancel" onClick={onCancelDeleteProject}>No</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mobile-library-saved-delete"
                onClick={() => onRequestDeleteProject(deleteKey)}
                aria-label={`Delete ${name}`}
              >
                Delete
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mobile-library-overlay" onClick={onClose}>
      <div className="mobile-library-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-library-topbar">
          <div className="mobile-library-heading">
            <h2>Open Project</h2>
            <p>Browse saved projects and examples.</p>
          </div>
          <button type="button" className="mobile-library-close" onClick={onClose} aria-label="Close open project modal">×</button>
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
          <div className="mobile-library-saved-view">
            <section className="mobile-library-saved-section">
              <div className="mobile-library-section-header">
                <h3>Cloud Projects</h3>
                {isAuthenticated && <span>{cloudProjectNames.length}</span>}
              </div>
              {!isAuthenticated ? (
                <div className="mobile-library-empty-state compact">
                  <h3>Log in to access your projects anywhere</h3>
                  <p>Sign in so your saved work can follow you across devices.</p>
                  <div className="mobile-library-auth-actions">
                    <button type="button" className="button-secondary" onClick={() => onRequireAuth('signin')}>Log In</button>
                    <button type="button" className="button-primary" onClick={() => onRequireAuth('register')}>Sign Up</button>
                  </div>
                </div>
              ) : cloudProjectNames.length ? (
                renderProjectList({ names: cloudProjectNames, source: 'cloud', previews: projectPreviews?.cloud })
              ) : (
                <div className="mobile-library-empty-state compact">
                  <h3>No cloud projects yet</h3>
                  <p>{cloudStatus || 'Use Save → Save to Cloud to keep projects across devices.'}</p>
                </div>
              )}
            </section>

            <section className="mobile-library-saved-section">
              <div className="mobile-library-section-header">
                <h3>Saved Locally</h3>
                <span>{localProjectNames.length}</span>
              </div>
              {localProjectNames.length ? (
                renderProjectList({ names: localProjectNames, source: 'local', previews: projectPreviews?.local })
              ) : (
                <div className="mobile-library-empty-state compact">
                  <h3>No local projects yet</h3>
                  <p>Use Save → Save Locally to keep projects in this browser.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            <div className="mobile-library-example-intro">
              <h3>Example Templates</h3>
              <p>Open a complete case. Free preview mode lets you test the first period before upgrading to edit and save a copy.</p>
            </div>
            <div className="mobile-library-grid">
              {exampleProjects.map((project) => {
                const preview = getProjectPreview(project);
                const isPreviewLocked = !access?.hasPro;

                return (
                  <article key={project.name} className={`mobile-library-card example-project-card tone-${preview.tone} ${isPreviewLocked ? 'locked' : ''}`}>
                    <button
                      type="button"
                      className="example-project-open"
                      onClick={() => {
                        onLoadExampleProject(project);
                        onClose();
                      }}
                    >
                      <h4>{project.name}</h4>
                      <span className="example-project-kicker">{project.subtitle}</span>
                      <ExampleProjectPreview project={project} />
                      <p>{project.description}</p>
                      <div className="mobile-library-saved-metrics example-project-metrics">
                        <span className={`tone-${preview.tone}`}>{preview.label}</span>
                        <span style={{ color: preview.npv >= 0 ? '#22c55e' : '#ef4444' }}>NPV {formatMobileNpv(preview.npv, preview.currency)}</span>
                        <span>IRR {formatMobileIrr(preview.irrAnalysis)}</span>
                        <span>{project.periodMode}</span>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
