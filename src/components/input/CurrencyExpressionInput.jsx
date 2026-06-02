import { useEffect, useRef, useState } from 'react';

const operatorButtons = [
  { label: '+', value: '+', title: 'Add' },
  { label: '-', value: '-', title: 'Subtract' },
  { label: '×', value: '*', title: 'Multiply' },
  { label: '÷', value: '/', title: 'Divide' },
];

export const CurrencyExpressionInput = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  disabled = false,
  className = '',
  inputRef,
  ...inputProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const internalInputRef = useRef(null);
  const wrapperRef = useRef(null);

  const setInputRef = (node) => {
    internalInputRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
  };

  useEffect(() => {
    const input = internalInputRef.current;
    if (!input || !onBlur) return undefined;

    const handleNativeBlur = (event) => {
      onBlur(event);
    };

    input.addEventListener('blur', handleNativeBlur);
    return () => input.removeEventListener('blur', handleNativeBlur);
  }, [onBlur]);

  useEffect(() => {
    const input = internalInputRef.current;
    const wrapper = wrapperRef.current;
    if (!input || !wrapper || !onBlur) return undefined;

    const handleDocumentPointerDown = (event) => {
      if (document.activeElement === input && !wrapper.contains(event.target)) {
        onBlur({ ...event, target: input, currentTarget: input });
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  }, [onBlur]);

  const emitValueChange = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
  };

  const insertOperator = (operator) => {
    const input = internalInputRef.current;
    const currentValue = String(value ?? '');
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${operator}${currentValue.slice(selectionEnd)}`;

    emitValueChange(nextValue);
    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = selectionStart + operator.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div ref={wrapperRef} className={`currency-expression-field ${isOpen ? 'is-open' : ''}`}>
      <input
        {...inputProps}
        ref={setInputRef}
        value={value}
        disabled={disabled}
        className={className}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="currency-expression-trigger"
        aria-label="Open arithmetic operators"
        aria-expanded={isOpen}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>+</span>
        <span>-</span>
        <span>×</span>
        <span>÷</span>
      </button>
      {isOpen && !disabled && (
        <div className="currency-expression-pad" role="group" aria-label="Arithmetic operators">
          {operatorButtons.map((operator) => (
            <button
              key={operator.value}
              type="button"
              title={operator.title}
              aria-label={operator.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertOperator(operator.value)}
            >
              {operator.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
