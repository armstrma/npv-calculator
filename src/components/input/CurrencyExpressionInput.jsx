import { useCallback, useEffect, useRef, useState } from 'react';

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

  const handleInputBlur = useCallback((event) => {
    setIsOpen(false);
    onBlur?.(event);
  }, [onBlur]);

  const handleInputKeyDown = useCallback((event) => {
    if (event.key === 'Enter') setIsOpen(false);
    onKeyDown?.(event);
  }, [onKeyDown]);

  useEffect(() => {
    const input = internalInputRef.current;
    if (!input) return undefined;

    const handleNativeBlur = (event) => {
      handleInputBlur(event);
    };

    input.addEventListener('blur', handleNativeBlur);
    return () => input.removeEventListener('blur', handleNativeBlur);
  }, [handleInputBlur]);

  useEffect(() => {
    const input = internalInputRef.current;
    const wrapper = wrapperRef.current;
    if (!input || !wrapper) return undefined;

    const handleDocumentPointerDown = (event) => {
      if (wrapper.contains(event.target)) return;

      setIsOpen(false);

      if (document.activeElement === input) {
        handleInputBlur({ ...event, target: input, currentTarget: input });
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  }, [handleInputBlur]);

  useEffect(() => {
    const input = internalInputRef.current;
    const viewport = window.visualViewport;
    if (!input || !viewport) return undefined;

    let previousHeight = viewport.height;

    const handleViewportResize = () => {
      const nextHeight = viewport.height;
      const keyboardLikelyClosed = document.activeElement === input && nextHeight - previousHeight > 80;
      previousHeight = nextHeight;

      if (keyboardLikelyClosed) setIsOpen(false);
    };

    viewport.addEventListener('resize', handleViewportResize);
    return () => viewport.removeEventListener('resize', handleViewportResize);
  }, []);

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
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
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
