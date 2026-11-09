export const checkEmailHasPasskey = async (email) => {
  const response = await fetch('/api/check-passkey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (response.status === 429) {
    return { hasPasskey: false, limited: true, error: true };
  }
  if (!response.ok) {
    return { hasPasskey: false, limited: false, error: true };
  }
  const body = await response.json().catch(() => ({}));
  return { hasPasskey: Boolean(body.hasPasskey), limited: false, error: false };
};
