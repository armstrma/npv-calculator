const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

export const PasskeyPromptModal = ({ open, onEnroll, onDismiss, status, notice }) => {
  if (!open) return null;
  return (
    <div className="modal" onClick={onDismiss}>
      <div className="modal-content auth-modal" role="dialog" aria-labelledby="passkey-prompt-title" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2 id="passkey-prompt-title">Sign in faster next time</h2>
            <p>Add a passkey to use your fingerprint, face, or device PIN instead of waiting for an email link.</p>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-actions">
            <button type="button" className="button-primary" onClick={onEnroll} disabled={status === 'working'}>
              {status === 'working' ? 'Waiting for your device...' : 'Add a passkey'}
            </button>
            <button type="button" className="button-secondary" onClick={onDismiss}>
              Not now
            </button>
          </div>
          {notice && <p className={`auth-footnote auth-notice ${status === 'error' ? 'error' : ''}`}>{notice}</p>}
          <p className="auth-footnote">You can add or remove passkeys later from the account menu.</p>
        </div>
      </div>
    </div>
  );
};

export const PasskeyManagerModal = ({ open, onClose, passkeys, loading, status, notice, onAdd, onDelete, canAdd }) => {
  if (!open) return null;
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content auth-modal" role="dialog" aria-labelledby="passkey-manager-title" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-header">
          <div>
            <h2 id="passkey-manager-title">Passkeys</h2>
            <p>Passkeys let you sign in with this device instead of an email link. Email links keep working.</p>
          </div>
        </div>
        <div className="auth-card">
          {loading ? (
            <p className="auth-footnote">Loading passkeys...</p>
          ) : passkeys.length === 0 ? (
            <p className="auth-footnote">No passkeys yet.</p>
          ) : (
            <ul className="passkey-list">
              {passkeys.map((passkey) => (
                <li key={passkey.id} className="passkey-list-item">
                  <span>
                    <strong>{passkey.friendly_name || 'Passkey'}</strong>
                    {passkey.created_at && <small> Added {formatDate(passkey.created_at)}</small>}
                    {passkey.last_used_at && <small> · Last used {formatDate(passkey.last_used_at)}</small>}
                  </span>
                  <button type="button" className="button-secondary" onClick={() => onDelete(passkey.id)} disabled={status === 'working'}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="auth-actions">
            {canAdd && (
              <button type="button" className="button-primary" onClick={onAdd} disabled={status === 'working'}>
                {status === 'working' ? 'Waiting for your device...' : 'Add a passkey'}
              </button>
            )}
          </div>
          {!canAdd && <p className="auth-footnote">This browser does not support passkeys.</p>}
          {notice && <p className={`auth-footnote auth-notice ${status === 'error' ? 'error' : ''}`}>{notice}</p>}
        </div>
        <div className="auth-modal-footer">
          <button type="button" className="button-secondary upgrade-modal-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
