# NPV Calculator Pedagogical Product Roadmap

Started: 2026-04-01
Purpose: Ongoing product-thinking scratchpad for turning the NPV calculator into a pedagogical freemium offering.
Cadence note: User requested this be revisited on heartbeat roughly every 30 minutes; future thoughts should be appended/refined here.

---

## Product Thesis

This should evolve from a finance calculator into a teaching product that helps students learn:
- time value of money
- discounted cash flow reasoning
- IRR vs discount rate vs hurdle rate
- downside/sensitivity reasoning
- breakeven thinking
- investment decision framing under constraints

The product should feel:
- visual
- intuitive
- assignment-friendly
- classroom-ready
- progressively deeper as users unlock more advanced analysis

---

## Core Audience Segments

### 1. Free individual learner
Wants:
- quick calculator
- visual intuition
- no signup or minimal friction
- enough value to trust the tool

### 2. Paid individual learner / professional learner
Wants:
- save projects
- revisit work
- compare scenarios
- possibly export/share/present analysis

### 3. Professor / instructor
Wants:
- assign projects
- preload scenarios
- control assumptions
- create classroom or course access
- have students interact without setup chaos

### 4. Students in institutional plans
Wants:
- access via code or class link
- clear exercises
- ability to tweak what professor allows
- feedback / guided analysis

---

## Initial Positioning

Working pitch:
> An interactive NPV teaching and scenario-analysis platform for finance education, with a free visual calculator and classroom-ready premium tools for assignments, saved work, and guided analysis.

This is stronger than positioning it as just “an NPV calculator.”

---

## Free vs Paid Structure

## Free Tier
Likely includes:
- basic NPV calculator
- colored sliders
- one editable investment slider
- basic cash flow entry/sliders
- discount rate slider
- simple top-line outputs: NPV / IRR / Payback / Sentiment
- Export CSV
- Copy Project Link

Possible free restrictions:
- no saving projects
- no hurdle rate
- no advanced charts
- no detailed analysis panels
- no sensitivity analysis toggle
- no browser/local saved project library

### Strong idea from user
Free mode could expose only a simplified calculator and a **sample premium project preview** where advanced features are visible but mostly locked.

That preview could be a high-conversion mechanic if done carefully.

---

## Premium Individual Tier
Likely includes:
- save projects
- full chart suite
- hurdle rate
- full sentiment / fragility / breakeven analysis
- sensitivity analysis
- scenario comparison
- maybe assignment templates / study packs later

Possible cloud features:
- minimal account system
- saved projects in lightweight DB
- project history or versions later if needed

---

## Institutional / Professor Tier
Likely includes:
- course/class creation
- access codes or invite links
- preloaded project sets
- locked variables per assignment
- ability to reveal or hide advanced analysis
- per-project restrictions:
  - lock hurdle rate
  - lock initial investment
  - lock some cash flows
  - lock discount rate
  - allow only certain sliders/inputs
- class dashboards later
- possibly assignment deadlines later

### Especially strong classroom feature set
Instructor authoring should eventually support:
- create project template
- define allowed changes
- write prompt/context for the case
- publish to class
- optionally generate answer key/private instructor notes

---

## Suggested Monetization Structure

## Option A: Simple and probably best to start
### Individual
- Monthly: $6–12/month
- Annual: $49–89/year

### Professor
- Annual single instructor license: $149–299/year
- Could include a student cap initially (e.g. 100–250 students)

### Department / institution
- custom pricing

Why this is good:
- simple to understand
- easy to sell manually first
- enough room for educator value without overcomplication

## Option B: Lower-friction education-first pricing
### Individual
- Free
- Pro: $4.99/month or $39/year

### Instructor
- $99/year starter
- $199/year pro classroom

This may convert better early if the product is still narrowly scoped.

### Current opinion
User’s freemium instinct is good, but the free tier may become **too strict** if it removes too much of the “aha” value.

Better free tier rule:
- free users should still experience at least **one compelling insight loop**
- if free is too stripped, it feels like a demo, not a product

Recommendation:
- keep one graph free (probably NPV vs Discount Rate or a simplified one)
- keep core metrics free
- paywall saved projects, advanced analyses, sensitivity layers, hurdle rate, instructor features

That likely converts better than hiding all analysis.

---

## Sample Project Preview Idea

Strong concept:
- free users can open a premium sample project
- they can see advanced visuals and premium features in action
- but only one variable is editable (e.g. initial investment)
- all other premium controls appear visible-but-locked

Why this works:
- demonstrates value concretely
- avoids abstract upsell copy
- turns the product itself into the sales funnel

Need to avoid annoyance:
- not too many locks
- clear “why this is locked” messaging
- one-click upgrade prompt, not constant nags

---

## Trials, Demos, and Sales Funnel

Trials and demos should exist for different audiences early, not just after the product is mature.

### Why this matters
- lowers hesitation for individual learners
- gives professors a real way to evaluate classroom fit
- supports top-of-funnel traction before institutional procurement is ready
- makes the premium value tangible without forcing immediate commitment

### Suggested structure
#### Student / individual trial
- 7-day free trial
- enough time to support roughly a week of homework or self-study
- should unlock meaningful premium depth, not just cosmetic features

#### Instructor / professor trial
- longer than student trial
- likely 14 to 30 days depending on sales motion
- should include class creation, access-code flow, template authoring, and restricted assignment controls where feasible

#### Demo mode
- separate from trial
- no account required, or minimal friction
- should let users preview a polished premium scenario with limited editing

### Funnel recommendation
- free mode = useful educational product
- demo mode = see premium value fast
- trial mode = temporarily unlock real workflow value
- paid mode = persistence, depth, classroom control, and institutional readiness

This likely belongs earlier in the product rollout than full institution-grade admin tooling.

## Paywall UX Thoughts

Potential paywall surfaces:
- Save Project button
- Hurdle Rate toggle
- Sensitivity Analysis toggle
- Advanced chart tabs
- Detailed analysis sections
- Instructor-only publishing controls

Best practice:
- do not hard-jump users away
- let them click and then show a contextual paywall modal
- modal should explain the feature in educational terms, not just commerce terms

Example:
> Save and revisit projects, compare scenarios over time, and share course-ready links.

---

## Payments / Billing Thoughts

## Stripe
Best default choice.
Why:
- easy SaaS subscriptions
- supports monthly/annual plans
- supports promo codes
- supports customer portal
- easier than Shopify for this product shape

## Shopify
Probably not first choice unless user wants broader storefront/merch/course-commerce ecosystem.
Feels heavier than needed for a teaching SaaS web app.

### Recommendation
Start with **Stripe**.
Later add:
- Stripe Billing
- customer portal
- coupon support for education
- invoice/manual institution flows if needed

---

## Architecture / Product Scaffolding Likely Needed

## App Modes
Need explicit product modes eventually:
- free mode
- premium individual mode
- instructor mode
- classroom/student mode
- sample preview mode

This argues for a future entitlements system rather than ad hoc feature hiding.

## Entitlements Layer
Need a clean feature flag / entitlement model, e.g.:
- canSaveProjects
- canUseHurdleRate
- canViewCharts
- canUseSensitivity
- canAccessDetailedAnalysis
- canOpenSamplePreview
- canCreateClasses
- canPublishAssignments
- canLockVariables

This will matter a lot. Product complexity becomes much easier if entitlements are modeled intentionally early.

## Persistence
### Free
- maybe no persistence or ephemeral only

### Individual paid
- small cloud DB for projects
- likely Postgres/Supabase/Firebase-level needs are enough

### Instructor
- courses
- templates
- assignment configs
- roster or access-code mapping

Recommendation:
- lightweight DB first, likely Supabase is strong candidate
- auth + table storage + row-level security can go a long way

---

## Data Model Ideas

### Users
- id
- email
- role(s): learner / instructor / admin
- subscription tier
- subscription status

### Projects
- id
- ownerId
- title
- parameters JSON
- createdAt / updatedAt
- visibility
- sourceType (personal / sample / class-template / assignment-copy)

### Classes
- id
- instructorId
- title
- term
- accessCode

### ClassProjects / Templates
- id
- classId
- projectDefinition JSON
- lockRules JSON
- instructions markdown/text

### StudentAssignments (later)
- id
- classProjectId
- studentUserId or access token
- submission/project state

### Lock Rules
Could include:
- lockedFields: ['hurdleRate', 'initial']
- editableCashflowYears: [1,2,3]
- hiddenFeatures: ['sensitivity', 'breakevenPanel']

---

## Pedagogical Opportunities Beyond Current Vision

### 1. Guided mode
Tool asks teaching questions:
- Is NPV positive?
- Does IRR exceed the hurdle?
- What happens in downside?
- Why would an instructor reject despite positive NPV?

This could be a major differentiator.

### 2. “Explain this decision” output
Have the product generate structured reasoning from the current metrics.
Useful for teaching students how to write recommendations.

### 3. Locked classroom challenges
Examples:
- Only change discount rate and explain impact
- Diagnose why project is borderline
- Improve project until hurdle is met

### 4. Comparison mode
Compare 2–3 project scenarios side-by-side.
Very valuable pedagogically.

### 5. Assessment mode
Potential future premium feature:
- instructor creates assignment
- students answer prediction questions before seeing full output

---

## Risks / Things to Think Hard About

### Free tier too strict
If free users cannot experience enough of the “teaching magic,” they may bounce instead of convert.

### Feature sprawl
The classroom/institution idea is strong, but it can snowball into LMS territory. Avoid becoming an LMS too early.

### Overbuilding auth/billing before product proof
Good to think about Stripe and classes now, but likely best to validate:
- students find it useful
- professors care enough to pay
- premium boundaries feel sensible

---

## Recommended Product Sequence

### Phase 1: Sharpen the calculator
- polish UX
- clarify pedagogy
- keep it delightful
- establish free vs premium boundaries in UI

### Phase 2: Add entitlements/paywall scaffolding
- gated features
- sample premium preview
- upgrade modals
- Stripe subscriptions

### Phase 3: Paid individual accounts
- auth
- cloud save
- project library

### Phase 4: Instructor mode
- classes
- access codes
- project templates
- lock rules
- institution SSO considerations
  - Azure Entra
  - Google
  - Okta
  - Duo
  - Shibboleth (common for institutions)

SSO note:
- likely not needed for the very first paid version
- becomes important once departments or institutions want centralized identity and onboarding
- pragmatic order may be email auth first, then Google/Microsoft, then enterprise/institutional SSO paths

### Phase 5: Classroom workflows
- assignment distribution
- student copies
- instructor dashboards
- trial-to-paid conversion flow for instructors after classroom evaluation

### Phase 6: Operational / support tooling
- backend support panel to manage users, classes, orgs/departments, and subscription state
- ability to extend trials manually
- support-side entitlement overrides when needed
- admin/support visibility into institution setup and access issues

This sequencing keeps scope sane.

---

## Current Opinion on User’s Vision

Overall: strong.
Especially good:
- freemium core
- premium classroom angle
- sample project preview
- instructor lock/restriction concepts

Main caution:
- do not make the free product feel dead-on-arrival
- leave enough visual and analytical value in free mode to create trust and curiosity

If choosing one principle:
> Free should be genuinely educational. Paid should amplify workflow, depth, and classroom control.

That feels right.

---

## Concrete Next Scaffolding Ideas for Future Passes

1. Draft entitlement matrix in detail
2. Define free-mode UI exactly
3. Define premium sample project UX
4. Write pricing experiments / candidate plans
5. Sketch database schema for users/projects/classes/templates
6. Evaluate Stripe + Supabase stack formally
7. Consider whether saved browser projects should become cloud projects for paid tier
8. Define instructor lock-rule model carefully
9. Write landing page copy ideas
10. Define onboarding flow for professor vs learner
11. Define student vs instructor trial experiences
12. Sketch backend support/admin panel requirements
13. Define institutional SSO readiness plan
