export const AuthModal = ({ open, onClose, authMode, setAuthMode, authEmail, setAuthEmail, onRequestMagicLink, authStatus, authNotice }) => {
  if (!open) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2>{authMode === 'signin' ? 'Sign in to continue' : 'Create your account'}</h2>
            <p>Use a passwordless account so projects and premium access stay attached to you.</p>
          </div>
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
            <button type="button" className="button-primary" onClick={onRequestMagicLink} disabled={authStatus === 'sending'}>
              {authStatus === 'sending' ? 'Sending...' : authMode === 'signin' ? 'Email me a sign-in link' : 'Create account'}
            </button>
            <button type="button" className="button-secondary" disabled title="Google and Microsoft OpenID can be enabled after the passwordless email flow is deployed.">
              Google / Microsoft later
            </button>
          </div>

          {authNotice && <p className={`auth-footnote auth-notice ${authStatus === 'error' ? 'error' : ''}`}>{authNotice}</p>}
        </div>

        <div className="auth-modal-footer">
          <button type="button" className="button-secondary upgrade-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

