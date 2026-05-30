import { checkoutPlans, pricingPlan, upgradeFeatures } from '../../lib/calculation.js';

export const ProductModal = ({ open, onClose, title = 'Upgrade', reason = '', isAuthenticated, userLabel, checkoutStatus, checkoutNotice, onStartCheckout, onRequireAuth }) => {
  if (!open) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2>{title}</h2>
            <p>
              Unlock the premium NPV Calculator for clearer insights and guided decision-making.
            </p>
          </div>
        </div>

        {reason && (
          <div className="upgrade-reason-callout" role="status">
            {reason}
          </div>
        )}

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
          {isAuthenticated ? (
            <div className="upgrade-plan-actions">
              {checkoutPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="button-primary upgrade-plan-button"
                  onClick={() => onStartCheckout(plan.id)}
                  disabled={checkoutStatus === 'starting'}
                >
                  <span>{checkoutStatus === 'starting' ? 'Starting checkout...' : plan.label}</span>
                  <strong>{plan.price}</strong>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="button-primary" onClick={onRequireAuth}>
              Sign in to continue
            </button>
          )}
          <button type="button" className="button-secondary upgrade-modal-close-bottom" onClick={onClose}>
            Close
          </button>
        </div>
        {checkoutNotice && <p className={`auth-footnote auth-notice ${checkoutStatus === 'error' ? 'error' : ''}`}>{checkoutNotice}</p>}
      </div>
    </div>
  );
};
