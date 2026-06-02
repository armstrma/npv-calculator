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

const normalizeExpressionInput = (value) => (
  String(value ?? '')
    .replace(/,/g, '')
    .replace(/[×x]/gi, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')
);

const isOperator = (token) => ['+', '-', '*', '/'].includes(token);

export const hasArithmeticOperator = (value) => {
  const normalized = normalizeExpressionInput(value);
  if (/[+*/]/.test(normalized)) return true;

  return normalized.slice(1).includes('-');
};

const tokenizeArithmeticExpression = (value) => {
  const normalized = normalizeExpressionInput(value);
  if (normalized === '') return null;

  const tokens = [];
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (/[0-9.]/.test(char)) {
      let draft = '';
      let hasDot = false;

      while (index < normalized.length && /[0-9.]/.test(normalized[index])) {
        if (normalized[index] === '.') {
          if (hasDot) return null;
          hasDot = true;
        }
        draft += normalized[index];
        index += 1;
      }

      if (draft === '.') return null;
      tokens.push(Number(draft));
      continue;
    }

    if (isOperator(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
};

const evaluateArithmeticTokens = (tokens) => {
  if (!tokens?.length) return null;

  let index = 0;

  const parseSignedNumber = () => {
    let sign = 1;

    while (tokens[index] === '+' || tokens[index] === '-') {
      if (tokens[index] === '-') sign *= -1;
      index += 1;
    }

    const token = tokens[index];
    if (typeof token !== 'number' || !Number.isFinite(token)) return null;
    index += 1;
    return sign * token;
  };

  const parseProduct = () => {
    let value = parseSignedNumber();
    if (value === null) return null;

    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index];
      index += 1;
      const nextValue = parseSignedNumber();
      if (nextValue === null) return null;
      if (operator === '/' && nextValue === 0) return null;
      value = operator === '*' ? value * nextValue : value / nextValue;
    }

    return value;
  };

  let value = parseProduct();
  if (value === null) return null;

  while (tokens[index] === '+' || tokens[index] === '-') {
    const operator = tokens[index];
    index += 1;
    const nextValue = parseProduct();
    if (nextValue === null) return null;
    value = operator === '+' ? value + nextValue : value - nextValue;
  }

  return index === tokens.length && Number.isFinite(value) ? value : null;
};

export const evaluateNumericExpression = (value) => {
  const tokens = tokenizeArithmeticExpression(value);
  return evaluateArithmeticTokens(tokens);
};

export const parseNumericInput = (value) => {
  const expressionValue = evaluateNumericExpression(value);
  if (expressionValue !== null) return expressionValue;

  const normalized = sanitizeNumericDraft(value);
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
