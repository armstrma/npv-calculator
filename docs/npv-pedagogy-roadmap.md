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
- avoid support burden during the first 10 minutes of class

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
- define a student handoff flow that works in one click from a class link or code

### Classroom workflow refinement
A strong freemium boundary may be less about raw analytics and more about orchestration.
Potential premium classroom workflow:
- instructor creates a case
- system generates a class link or short code
- student opens directly into the assignment context
- first interaction works before full account creation, or with very lightweight sign-in
- project is autosaved into a student submission copy only when needed

Why this feels important:
- classroom products die fast when setup friction eats class time
- professors care about reliability and speed almost as much as feature depth
- this creates a clean distinction between a consumer calculator and a teachable classroom product

### Instructor onboarding and course-bootstrap refinement
A useful product scaffolding idea is a "first 10 minutes of class" workflow optimized for instructors who are trying the tool live for the first time.

Potential premium onboarding flow:
- instructor picks a course type template such as intro finance, corporate finance, or capital budgeting
- system creates a starter class with one sample case, one editable assignment, and a ready-to-share student link
- instructor gets a short preflight checklist: test link, projected classroom view, variable locks, and expected student steps
- system offers a printable or copyable one-paragraph student instruction block

Why this seems valuable:
- many professor tools fail not because features are weak, but because initial setup feels risky right before class
- a guided bootstrap flow makes the product feel classroom-safe sooner
- this improves trial conversion because instructors can imagine using it immediately instead of planning a future setup session

This may become an important product principle:
- premium classroom value is not just deeper controls
- premium classroom value is also confidence, speed, and low-chaos launch readiness

### Important extension: delayed account creation and seat activation
A particularly strong classroom pattern may be:
- student enters through a class link or short code
- student can begin interacting immediately as a guest or temporary session
- account creation is deferred until the student tries to save, submit, or return later
- seat activation happens only when the student crosses that persistence boundary

Why this could matter:
- removes first-minute classroom friction
- reduces abandoned starts caused by auth fatigue
- lets instructors distribute work without troubleshooting signups live
- creates a cleaner economic model for institutional seats, because "opened once" and "actually activated" are different events

This may become an important product and billing principle:
- access friction should be near zero
- persistence and returnability are what trigger identity binding
- institutional usage metrics should distinguish visitors, active learners, and activated seats

### Seat lifecycle and instructor controls refinement
A useful follow-on to delayed activation is a more explicit seat lifecycle model:
- invited or eligible seat
- first-open visitor
- active learner
- activated named seat
- completed or inactive seat

Why this seems useful:
- instructors and departments often care about roster consumption, not just anonymous traffic
- support gets easier when the product can explain why a student does or does not count against a license
- trials and institutional contracts can use cleaner language around activation thresholds and reclaimable seats

Potential product implication:
- allow instructors or admins to reclaim seats that never crossed a true activation boundary
- show simple roster status labels so classroom troubleshooting does not become billing confusion
- keep billing rules aligned with learning-state transitions, not raw page views

### Classroom roster import and identity reconciliation refinement
Another useful classroom-scaffolding idea is to plan for roster mismatch handling early.

Common real-world situations:
- instructor uploads or syncs a roster before students ever open the product
- student enters through a class link with a different email than the rostered address
- student first joins as a guest on mobile, then later creates an account on desktop
- add/drop changes happen after assignments are already distributed

Why this matters:
- classroom tools often become painful when identity mismatches turn into manual support work
- instructors mostly want confidence that the right student got credit, not a perfect identity model
- delayed account creation works better if the product later reconciles guest activity into a named learner cleanly

Potential product implication:
- keep a distinction between roster identity, access identity, and final named account identity
- support a lightweight reconciliation flow for instructors or support, instead of assuming every join is clean
- preserve assignment work when a learner upgrades from guest to account-backed status
- make add/drop and late-enrollment handling part of the classroom model, not an afterthought

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
- canExportBrandedAssignmentPDFs
- canUseInstructorAnswerKeys

This will matter a lot. Product complexity becomes much easier if entitlements are modeled intentionally early.

### Important refinement: entitlements should be scoped, not just global
A useful next-step principle is to model permissions at more than one level:
- user/account level entitlement
- class level entitlement
- project/template level entitlement
- assignment instance level restrictions

Why this matters:
- an instructor may generally have premium access, but a specific assignment can still hide IRR or lock the discount rate
- a student may have access through a class without owning an individual paid plan
- a sample premium preview may expose visibility without edit rights

This suggests the product should separate:
- feature visibility
- feature editability
- feature export/share rights

That separation will likely prevent messy conditional logic later and make classroom workflows much cleaner.

### Entitlement evaluation order refinement
It may help to define an explicit precedence rule early, before feature gating spreads through the UI.

A likely evaluation order could be:
- product plan sets the maximum feature ceiling
- role or org entitlement grants a broader capability set
- class or assignment rules narrow what is allowed in that context
- project state determines whether the user is viewing, editing, submitting, or previewing

Why this seems valuable:
- avoids contradictory gating decisions across tabs, modals, and classroom links
- makes support easier because entitlement outcomes can be explained in plain language
- helps engineers avoid scattered one-off checks that drift over time

Potential product implication:
- compute a resolved entitlement object for the current session or project context
- expose both the final permission and the reason source, such as plan, class rule, or preview restriction
- use that same resolution path for UI visibility, API authorization, and paywall messaging so behavior stays consistent

### Paywall moment design refinement
A useful freemium/product-scaffolding idea is to treat premium prompts differently depending on what the user is trying to do.

Potential paywall moment types:
- curiosity moment: learner clicks a locked advanced chart or analysis panel
- workflow moment: user tries to save, compare scenarios, or return later
- classroom moment: instructor tries to publish, lock variables, or create a class link

Why this matters:
- the same upgrade modal should not try to sell every audience with the same language
- conversion usually improves when the prompt matches the user's immediate intent
- this helps keep free mode feeling respectful instead of constantly salesy

Potential product implication:
- map each gated action to a small set of paywall message templates
- classroom prompts should emphasize launch readiness, assignment control, and reduced in-class friction
- learner prompts should emphasize persistence, deeper analysis, and better study workflow
- curiosity moments can stay lightweight, while workflow-blocking moments can justify stronger upgrade messaging or trial offers

### Trial conversion timing refinement
A useful next refinement is to define not just who gets a trial, but when the product should offer it.

Potential timing rules:
- do not interrupt a brand-new free user immediately on first load
- offer a learner trial after a meaningful workflow block, such as save, compare, or revisit intent
- offer an instructor trial when classroom-intent signals appear, such as class creation, assignment publishing, or variable-lock usage
- avoid starting the trial too early if the user is still exploring a sample preview casually

Why this seems valuable:
- early trial prompts can waste the most motivated evaluation window before the user understands the value
- later prompts, tied to clear intent, make the trial feel helpful instead of pushy
- instructor trials especially should begin when classroom setup is imminent, not when a professor is just browsing

Potential product implication:
- track upgrade-trigger intent events, not just page visits
- let trial offers differ by audience and trigger point
- preserve the strongest workflow moment for the first serious trial prompt, rather than spending it on a generic banner

### Assignment submission state refinement
A useful classroom-workflow refinement is to separate ordinary project editing from assignment submission state early.

Potential states:
- in progress
- submitted
- resubmission allowed
- returned for revision
- graded or reviewed later if that ever exists

Why this matters:
- classroom products often get messy if submission is treated as just another saved project flag
- instructors may want a clear freeze point for grading or discussion, while still allowing later revision paths
- students need confidence about whether they are still experimenting privately or have actually turned something in

Potential product implication:
- model submission state separately from project ownership and feature entitlements
- make assignment links and student copies aware of due-state and resubmission rules
- keep the first version simple, but avoid a data model that assumes every project is always freely editable forever

### Instructor preview versus student view refinement
A useful classroom-scaffolding idea is to distinguish instructor preview mode from the actual student runtime early.

Why this matters:
- instructors need confidence that locks, prompts, and visible outputs behave the way students will actually see them
- many classroom tools create confusion when the authoring view is too different from the learner experience, or when preview is inaccurate
- this is especially important if assignments can hide features, lock variables, or delay premium prompts

Potential product implication:
- support a true "view as student" preview that resolves the same entitlement and restriction rules as the learner link
- clearly label when the instructor is in authoring mode versus preview mode
- let instructors test first-run flows such as guest entry, instructions, submission state, and paywall behavior before sharing
- treat preview accuracy as a product trust feature, not just a convenience

### Assignment versioning and edit window refinement
A useful next classroom refinement is to decide how assignment changes behave after students have already opened them.

Common situations:
- instructor fixes a typo after the link is already shared
- instructor changes lock rules after some students have started
- instructor wants a future section to use an updated version without disrupting existing submissions

Why this matters:
- classroom trust drops fast if assignment behavior shifts invisibly underneath students
- instructors need some flexibility, but students also need a stable target once work begins
- support and grading both get harder if no one can tell which assignment version a student actually saw

Potential product implication:
- distinguish minor edits from material changes that should create a new assignment version
- store the assignment version on each student copy or submission context
- allow instructors to choose whether changes apply only to future opens, all unstarted learners, or a newly duplicated assignment
- make version history visible enough to support troubleshooting and fairness

### Late enrollment and make-up workflow refinement
A useful classroom workflow note is to plan for students who join after the normal assignment launch window.

Common situations:
- a student adds the course late and needs access after the original class link was already distributed
- an instructor grants a make-up assignment or extended due date to one student or a small subset
- a learner’s first open happens after the main cohort has already submitted

Why this matters:
- classroom tooling often assumes one clean cohort, but real classes are messier
- instructors need flexibility without cloning the whole course structure manually every time
- fairness and support both improve when exceptions are modeled intentionally instead of handled with ad hoc overrides

Potential product implication:
- support per-student or subgroup access windows and due-date overrides
- let late enrollees inherit the correct assignment version intentionally, not accidentally
- keep exception handling visible in the instructor view so special cases do not disappear into hidden system state
- avoid forcing instructors to duplicate an entire assignment just to accommodate one late student

### Instructor feedback release workflow refinement
A useful follow-on classroom idea is to decide how and when instructor feedback or answer visibility gets released back to students.

Common situations:
- instructor wants students to submit before seeing solution guidance
- a class discussion happens first, and feedback should unlock afterward
- some assignments may reveal only numeric results, while others reveal full reasoning or answer-key style commentary

Why this matters:
- pedagogical timing often matters as much as the content itself
- instructors may want to preserve exploration and discussion before revealing the "right answer"
- this creates another meaningful distinction between a classroom workflow product and a plain calculator

Potential product implication:
- model feedback visibility separately from submission state and assignment locks
- allow instructors to release feedback immediately, manually, on a date, or after the due window
- support different feedback layers such as score/status, model reasoning, or instructor notes
- keep the first version lightweight, but avoid assuming that submission automatically means full answer reveal

### Classroom analytics boundary refinement
A useful product-scaffolding question is to define what classroom analytics should be in scope early, and what should stay out.

Why this matters:
- instructors often want some visibility, but analytics can quickly turn the product into an LMS or surveillance tool
- a light, assignment-focused analytics layer could strengthen the classroom offer without exploding scope
- deciding the boundary early helps shape the data model and avoids collecting noisy metrics with no product purpose

Potential product implication:
- keep early analytics focused on assignment operational signals such as opened, in progress, submitted, and maybe not-yet-started
- avoid deep behavioral surveillance unless there is a very clear pedagogical need
- treat analytics as instructor workflow support first, not as a broad student monitoring system
- align metrics with the seat lifecycle and submission models already described so the system tells one consistent story

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
