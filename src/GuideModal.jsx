import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const NPV_FORMULA = 'NPV = -I_0 + \\sum_{t=1}^{n} \\frac{CF_t}{(1+r)^t}';
const IRR_FORMULA = '0 = -I_0 + \\sum_{t=1}^{n} \\frac{CF_t}{(1+IRR)^t}';
const DCF_FORMULA = 'DCF_t = \\frac{CF_t}{(1+r)^t}';
const ROI_FORMULA = 'ROI = \\frac{\\text{Total Cash Inflows} - I_0}{I_0} \\times 100\\%';
const PI_FORMULA = 'PI = \\frac{NPV + I_0}{I_0}';
const PI_INLINE = 'PI > 1';

const renderMath = (math, displayMode = true) => ({
  __html: katex.renderToString(math, {
    throwOnError: false,
    displayMode,
    strict: 'ignore',
  }),
});

const GuideModal = ({ onClose }) => {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content guide-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Educational Guide</h2>

        <p><strong>NPV (Net Present Value)</strong> measures how much value a project creates after discounting future cash flows back to today.</p>
        <div dangerouslySetInnerHTML={renderMath(NPV_FORMULA)} />
        <p>A positive NPV means the project adds value under the selected assumptions today.</p>

        <p><strong>IRR (Internal Rate of Return)</strong> is the discount rate that makes NPV equal to zero.</p>
        <div dangerouslySetInnerHTML={renderMath(IRR_FORMULA)} />
        <p>Compare IRR to the discount rate or hurdle rate to judge whether the return clears your standard.</p>

        <p><strong>Discounted Payback Period</strong> asks how long it takes for discounted cash inflows to recover the upfront investment.</p>
        <div dangerouslySetInnerHTML={renderMath(DCF_FORMULA)} />
        <p>Shorter payback usually means less exposure and faster recovery of capital.</p>

        <p><strong>ROI</strong> is a simpler return measure that does not discount timing.</p>
        <div dangerouslySetInnerHTML={renderMath(ROI_FORMULA)} />

        <p><strong>PI (Profitability Index)</strong> shows value created per dollar invested.</p>
        <div dangerouslySetInnerHTML={renderMath(PI_FORMULA)} />
        <p>If <span dangerouslySetInnerHTML={renderMath(PI_INLINE, false)} /> , the project is creating value.</p>

        <p><strong>Story flow</strong>: set assumptions, inspect the metrics and charts, then decide whether the project is acceptable, borderline, or worth rejecting.</p>
        <button onClick={onClose} className="button-primary">Close</button>
      </div>
    </div>
  );
};

export default GuideModal;
