export const formatNumberWithCommas = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

export const sanitizeNumericDraft = (value) => {
  const raw = String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, '');
  let result = '';
  let hasDot = false;
  let hasSign = false;

  for (const char of raw) {
    if (char === '-') {
      if (!hasSign && result.length === 0) {
        result += char;
        hasSign = true;
      }
      continue;
    }

    if (char === '.') {
      if (!hasDot) {
        result += char;
        hasDot = true;
      }
      continue;
    }

    result += char;
  }

  return result;
};

export const parseNumericInput = (value) => {
  const normalized = sanitizeNumericDraft(value);
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
