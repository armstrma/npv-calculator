# NPV Calculator

A browser-based project evaluation tool for comparing discounted cash flow scenarios, IRR, discounted payback, profitability, and sensitivity ranges.

## Purpose

This application helps evaluate whether a project creates value under a given discount rate and optional hurdle rate. It is designed for quick scenario testing with visual feedback rather than accounting-grade audit output.

## Core Assumptions

- Cash flows occur at the **end of each year**.
- Discounting uses a standard annual discount rate entered as a percentage.
- NPV is calculated as:
  - `NPV = -Initial Investment + Σ(CF_t / (1 + r)^t)`
- IRR is approximated numerically using a bounded binary search.
- Payback is based on **discounted cash flows**, not nominal cash flows.
- Fractional payback is interpolated within the year where discounted cumulative value crosses zero.
- Sensitivity scenarios are deterministic percentage shocks, not probabilistic forecasts.

## Methodology

### 1. Net Present Value (NPV)
NPV discounts future cash flows back to present value using the selected discount rate. A positive NPV suggests the project adds value under the chosen assumptions.

### 2. Internal Rate of Return (IRR)
IRR is the discount rate at which NPV is approximately zero. The calculator estimates this using repeated midpoint refinement between lower and upper bounds.

### 3. Discounted Payback Period
The payback value shown in the UI uses **discounted** cash flows and is reported to the nearest tenth of a year when recovery occurs between two periods.

### 4. Profitability Index (PI)
PI is calculated as:
- `(NPV / Initial Investment) + 1`

A PI greater than 1 implies value creation.

### 5. ROI
ROI is included as a simple undiscounted return measure:
- `((Total Cash Inflows - Initial Investment) / Initial Investment) * 100`

### 6. Sensitivity Views
When sensitivity mode is enabled, the charts show scenario shocks around the base case so the user can see how NPV changes under weaker or stronger assumptions.

### 7. Hurdle Rate
If enabled, the hurdle rate acts as an additional acceptance gate beyond the discount rate. A project can still be rejected if IRR exceeds the discount rate but fails to exceed the hurdle rate.

## URL / Deep Link Behavior

The calculator can generate project deep links containing:
- project name
- initial investment
- discount rate
- cash flows
- currency
- hurdle-rate state and value

These links are intended for sharing scenarios, after which the browser URL is cleaned after hydration.

## Testing Scope

Unit tests cover:
- NPV
- IRR approximation
- discounted payback
- ROI and PI edge cases
- numeric input parsing and formatting helpers

## Limitations

- Annual timing only
- No taxes, inflation, depreciation, or financing structure
- IRR search is approximate rather than symbolic
- Sensitivity ranges are scenario-based, not Monte Carlo or statistical risk models

## Development

### Run locally
- `npm install`
- `npm run dev`

### Build
- `npm run build`

### Test
- `npm test`

### GitHub Pages build
- `npm run build:pages`
