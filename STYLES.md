# UI style guide

All styles live in `frontend/src/index.css`. There is no CSS framework and no web fonts or CDN, so the
app works offline. Every color comes from a token on `:root`. The look is a soft, warm "glass"
dashboard: big rounded translucent cards on a grey-to-pale-yellow gradient, black pills, and yellow highlights.

## Principles

1. **Status at a glance.** The first card is the overall status, in a tint that matches its meaning.
2. **Never color alone.** Every status color comes with a text label (`Nominal` / `Monitor` / `Act now`) and,
   for urgent items, a *Notify surgeon* tag.
3. **Big, light numbers.** Key figures (mission day, findings, averages) use large weight-200/300 type.
4. **Black for action, yellow for "now".** Primary buttons and the active nav item are black pills. Yellow marks
   today, progress so far, and the career-dose arc.
5. **AI is visibly distinct.** Onboard-model output uses the ✦ sparkle icon and the violet `--ai` accent.

## Layout

- `.shell` is the rounded gradient frame (max 1440px) on a grey page.
- Top bar: an outlined brand pill, a pill nav group (active tab = black pill), a Settings pill (mission configuration page),
  a bell button that opens the **alerts** dropdown (badge dot: red if anything is *Act now*), and an avatar button that
  opens the **crew profile** card. No two buttons lead to the same place.
- Every page starts with a `.page-title` (light weight, 2.2–3.6rem).
- The dashboard uses a 4-column `.dash-grid`, which drops to 2 columns below 1180px and 1 column below 680px. `.span-2`
  and `.row-span-2` shape the grid. On phones the shell goes edge to edge, the nav scrolls sideways, and the page itself never scrolls sideways.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg-grad` | grey → warm yellow gradients | Shell background |
| `--surface` / `--surface-strong` | white at 62% / 86% | Cards / nested surfaces, inputs, table rows |
| `--inset` | `#f1f0ea` | Code, track backgrounds |
| `--text` / `--muted` / `--faint` | `#1c1c1f` / `#7b7c82` / `#a9aaaf` | Ink levels |
| `--ink` / `--ink-2` / `--on-ink` | `#232326` / `#3a3a3e` / `#f4f4f2` | Black pills, dark cards, text on dark |
| `--yellow` / `--yellow-soft` | `#f5d264` / `#fbedb5` | Highlights: today, flown share, dose arc, baseline band |
| `--hatch` | diagonal stripes | "Remaining" or projected quantities, only on shapes without paragraph text |
| `--ai` / `--ai-bg` | `#6b58c9` | Onboard-AI accents only |
| `--r-xl` … `--r-sm`, `--pill` | 30 / 22 / 16 / 12px, 999px | Corner radii |

### Status colors (reserved for health status only)

| Level | Token | Meaning |
|---|---|---|
| `ok` | `--ok` green | Nominal, within personal baseline |
| `watch` | `--watch` amber | Monitor, drift or a mild out-of-range value |
| `act` | `--act` red | Act now, needs action today and possibly the flight surgeon |

The status card tints (`.status-card.ok|watch|act`) are gradients of the same hues. The domains bar is the
one place where yellow stands for "nominal", and every segment there carries a text label.

## Dashboard components (`components/dashboard/`)

| Component | Visual pattern |
|---|---|
| `StatusCard` | Large tinted "portrait" card with a planet/orbit motif, level in big light type, and a ghost "Check in" pill |
| `SleepCard` | Rounded sticks with dots for the last 7 nights. Today is yellow with a value flag, nights below the minimum are amber, and a dotted line marks the 6.5 h minimum |
| `RadiationCard` | Ring gauge: a yellow arc for career dose used, tick marks for the remainder, and a dotted arc for the projected dose |
| `DomainsCard` | A segmented bar of domain levels over the dark **Action plan** task list (domain icon, title, colored state dot) |
| `ReadingsCard` | Accordion of metric groups with dotted separators; an amber dot means a reading is ≥ 2σ from baseline |
| `WeekCard` | Calendar-style lanes, one per symptom, with episodes as blocks spanning consecutive days (dark = recurring or red-flag, yellow = 2 days, white = 1 day) |
| `AiBriefingCard` | Two columns: summary, then the dark anomaly note and pale-yellow forecast box, with numbered priorities on the right |
| `ReportModal` | Plain-text or Markdown report with Copy and Download |

## Body map, routine, Learn, check-in extras

| Class | Purpose |
|---|---|
| `.bodymap`, `.bm-part.{level}(.sel)`, `.bm-aura`, `.bm-heart` | SVG body regions filled by status (green 35% / amber 70% / red 85%). Act-now regions pulse, the heart beats, and the radiation aura is a dotted ring. Selected = ink outline; keyboard focus = yellow. All motion stops under `prefers-reduced-motion` |
| `.bm-detail`, `.bm-findings`, `.bm-metrics` | Right-hand panel: function, *In space*, findings with first action, readings chips, how-to-measure line |
| `.routine-card`, `.rc-*` | Dark Dashboard card: progress ring, streak (yellow flame), due tasks |
| `.routine-list`, `.xp-bar`, `.badges`, `.badge-tile(.earned)` | Routine page: checklist (done = yellow box, struck through), XP bar, badge tiles (earned = yellow, locked = faded with progress bar) |
| `.hazards`, `.hazard`, `.hz-*` | Learn: RIDGE cards with a big letter disc, facts, a yellow "How AstroVital monitors it" box and related NASA risks. Source links appear once, in the Sources card at the bottom (`.sources-card`) |
| `.guide-btn`, `.guide-tip` | ⓘ button on check-in fields opening a pale-yellow how-to-measure tip (escalation line in red) |
| `.photo-capture`, `.pc-*` | Camera controls and thumbnails on the check-in |

## Mission story & profiles

| Class | Purpose |
|---|---|
| `.ribbon`, `.rib.{level}`, `.ribbon-phases` | One thin bar per mission day colored by status (pale yellow = nominal), with phase labels underneath |
| `.chapter`, `.chapter-num`, `.beat.{level}` | Story chapter cards: a big light number (red if the chapter had an Act now), and beats with day, domain icon, title, chips and narrative |
| `.profile-grid`, `.profile-opt(.on)` | Mission-profile radio cards in Settings (selected = black); facts in mono, source in muted text |
| `.profile-chips`, `.mini-stat.dark` | Profile, Earth-link and gravity chips under the Dashboard title |
| `.fcard-evidence` | Pale-yellow *Why this matters* panel on each finding (scientific basis) |

## Shared classes

| Class | Purpose |
|---|---|
| `.card` / `.panel`, `.card.dark` | Rounded glass card / dark card |
| `.btn`, `.btn.primary`, `.btn.yellow`, `.btn.ai`, `.btn.danger`, `.btn.ghost-light` | Pill buttons |
| `.pill-btn`, `.circle-btn(.dark/.white)` | Top-bar pills and round icon buttons (↗ links to detail) |
| `.pill.{level}`, `.tag` | Status chip, "Notify surgeon" badge |
| `.fcard(.dark)`, `.lvl-chip.{level}`, `.surgeon-chip` | Finding card in the domain modal (`DomainModal.tsx`): domain icon, title, data line, numbered action checklist with dotted dividers. The most severe *Act now* finding uses the dark card. Level chips: red = Act now, yellow = Monitor |
| `.finding.{level}` | Legacy finding style with a colored left edge (kept for reuse) |
| `.mini-stat`, `.kv` | Small stat pills, key/value tiles |
| `.task`, `.task-ico`, `.task-state` | Rows in a dark list (Action plan, copilot suggestions) |
| `.scale`, `.check` | 1–5 pill scale (selected = black) and symptom pill checkboxes (selected = yellow; red-flag = red) |
| `table`, `tr.clickable` | Rows are separate rounded pills, and hovering highlights the row yellow |
| `.ai-filled` | Violet ring on fields the onboard model pre-filled |
| `.popover`, `.pop-item`, `.profile-kv` | Top-bar dropdowns: bell → alerts list (red/amber dot per finding), avatar → crew profile card. They close on outside click or Escape, and go full width on phones |

## Charts

- **One series and one y-axis per chart.** Don't build dual-axis charts.
- **Trends (Recharts):** the line is a 2px black monotone curve. The personal baseline is a yellow ±2σ band plus a dotted
  black mean line. Out-of-range points are amber with a white ring. The tooltip is a dark rounded box, and the active
  dot is yellow. The Drift scan table is the chart's table view.
- **Hand-built dashboard charts** (sleep sticks, dose ring, segment bar) use plain HTML/SVG with `role="img"`
  plus an `aria-label` that states the values, and per-mark `title` tooltips.

## Accessibility

- Status is never color-only. Native controls are used throughout, so keyboard and screen readers work.
- The focus ring is a 2px yellow outline. The alertness test accepts Space as well as tap.
- Spinners slow down under `prefers-reduced-motion`.

## Adding styles

Add colors as tokens on `:root`, never as raw hex in component rules. Keep the status colors for
status. Use `--yellow` for "current / progress" emphasis, `--ink` for primary actions and dark cards,
and `--ai` only for onboard-model output.
