import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

const GuideModal = ({ onClose }) => {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content guide-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Educational Guide</h2>

        <p><strong>NPV (Net Present Value)</strong> measures how much value a project creates after discounting future cash flows back to today.</p>
        <BlockMath math={'NPV = -I_0 + \\sum_{t=1}^{n} \\frac{CF_t}{(1+r)^t}'} />
        <p>A positive NPV means the project adds value under the selected assumptions.</p>

        <p><strong>IRR (Internal Rate of Return)</strong> is the discount rate that makes NPV equal to zero.</p>
        <BlockMath math={'0 = -I_0 + \\sum_{t=1}^{n} \\frac{CF_t}{(1+IRR)^t}'} />
        <p>Compare IRR to the discount rate or hurdle rate to judge whether the return clears your standard.</p>

        <p><strong>Discounted Payback Period</strong> asks how long it takes for discounted cash inflows to recover the upfront investment.</p>
        <BlockMath math={'DCF_t = \\frac{CF_t}{(1+r)^t}'} />
        <p>Shorter payback usually means less exposure and faster recovery of capital.</p>

        <p><strong>ROI</strong> is a simpler return measure that does not discount timing.</p>
        <BlockMath math={'ROI = \\frac{\\text{Total Cash Inflows} - I_0}{I_0} \\times 100\\%'} />

        <p><strong>PI (Profitability Index)</strong> shows value created per dollar invested.</p>
        <BlockMath math={'PI = \\frac{NPV + I_0}{I_0}'} />
        <p>If <InlineMath math={'PI > 1'} />, the project is creating value.</p>

        <p><strong>Story flow</strong>: set assumptions, inspect the metrics and charts, then decide whether the project is acceptable, borderline, or worth rejecting.</p>
        <button onClick={onClose} className="button-primary">Close</button>
      </div>
    </div>
  );
};

export default GuideModal;
