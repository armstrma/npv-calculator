export const AuthModal = ({
  open,
  onClose,
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  onSignIn,
  onRequestMagicLink,
  onTryPasskey,
  authStatus,
  authNotice,
  showPasskeyOption = false,
  passkeyStatus = 'idle',
}) => {
  if (!open) return null;

  const busy = authStatus === 'sending' || passkeyStatus === 'working';
  const showPasskeyFallback = authMode === 'signin' && authStatus === 'passkey_fallback';
  const primaryLabel = (() => {
    if (authMode === 'register') return authStatus === 'sending' ? 'Sending...' : 'Create account';
    if (passkeyStatus === 'working') return 'Waiting for your device...';
    if (authStatus === 'sending') return 'Sending...';
    return 'Sign in';
  })();

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
          <button type="button" className={`button-secondary auth-mode-tab ${authMode === 'signin' ? 'active' : ''}`} onClick={() => setAuthMode('signin')} disabled={busy}>
            Sign in
          </button>
          <button type="button" className={`button-secondary auth-mode-tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => setAuthMode('register')} disabled={busy}>
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
              autoComplete="username webauthn"
              disabled={busy}
            />
          </label>

          {showPasskeyFallback ? (
            <div className="auth-actions">
              <button type="button" className="button-primary" onClick={onRequestMagicLink} disabled={busy}>
                {authStatus === 'sending' ? 'Sending...' : 'Email me a sign-in link'}
              </button>
              {showPasskeyOption && (
                <button type="button" className="button-secondary" onClick={onTryPasskey} disabled={busy}>
                  {passkeyStatus === 'working' ? 'Waiting for your device...' : 'Try passkey again'}
                </button>
              )}
            </div>
          ) : (
            <div className="auth-actions">
              <button
                type="button"
                className="button-primary"
                onClick={authMode === 'register' ? onRequestMagicLink : onSignIn}
                disabled={busy}
              >
                {primaryLabel}
              </button>
              {authMode === 'signin' && showPasskeyOption && (
                <button type="button" className="button-link auth-passkey-link" onClick={onTryPasskey} disabled={busy}>
                  Use a passkey
                </button>
              )}
            </div>
          )}

          {authNotice && <p className={`auth-footnote auth-notice ${authStatus === 'error' || authStatus === 'passkey_fallback' ? 'error' : ''}`}>{authNotice}</p>}
        </div>

        <div className="auth-modal-footer">
          <button type="button" className="button-secondary upgrade-modal-close" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
