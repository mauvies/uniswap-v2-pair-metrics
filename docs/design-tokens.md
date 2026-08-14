# Design tokens — ITB Sample Exercise (Figma)

Source: `vECoxmVyaLOZmM7zn8uztM`, frame `Dashboard` (`2:30`), 1440 × 847.
Extracted via the Figma MCP on 2026-08-11 (`get_design_context`, `get_variable_defs`,
`get_metadata`, `download_assets`) plus direct inspection of the exported SVG assets.

**The file defines zero Figma variables** (`get_variable_defs` → `{}`) and zero shared
styles. Every value below is a raw literal read off a node or an exported asset, which is
why the semantic names in §1 are *inferred by us*, not read from the design.

---

## 1. Global primitives (`@theme` candidates)

### 1.1 Colour

Semantic names are our inference. "Used by" lists every place the literal appears, so the
grouping can be checked against the design.

#### Surfaces

| Proposed name | Value | Used by |
|---|---|---|
| `canvas` | `#F9F9FB` | Page background (frame `2:30`); also the search field fill |
| `surface` | `#FFFFFF` | Metric cards, Performance card, header bar, sidebar |
| `surface-muted` | `#F6F6F6` | Inactive filter pills |
| `surface-selected` | `#E2E8F3` | Active filter pill ("All") |
| `surface-nav-active` | `#E7F1FF` | Active sidebar button (Dashboard) |

#### Borders and rules

| Proposed name | Value | Used by |
|---|---|---|
| `border` | `#EFEFF4` | Card borders (1px), header bottom rule, sidebar right rule |
| `border-selected` | `#2467E8` | Active filter pill border (1px) |
| `divider` | `#EEEEEE` | Rule under the Performance card title (1px) |

#### Text and icons

| Proposed name | Value | Used by |
|---|---|---|
| `ink` | `#152935` | Metric card values and labels, Performance card title |
| `ink-heading` | `#333335` | Section titles, header title "Dashboard" |
| `ink-secondary` | `#43484D` | Chart legend label, filter pill labels |
| `ink-muted` | `#485465` | Chart axis labels (x and y) |
| `ink-placeholder` | `#C0C0C5` | Search placeholder |
| `icon` | `#808080` | The five Performance card header icons |
| `icon-nav` | `#77767B` | Sidebar nav icons, inactive |
| `icon-notification` | `#323232` | Notification bell |
| `icon-search` | `#515054` | Search icon |
| `on-accent` | `#FFFFFF` | Avatar initials |

The active sidebar icon uses `primary` (`#2E71F0`), not a separate token. Note that the
design uses **three different greys for icons** — `#808080`, `#77767B`, `#323232` — which,
like the three blues, is template drift rather than a system. Reproduced faithfully.

#### Accents

| Proposed name | Value | Used by |
|---|---|---|
| `primary` | `#2E71F0` | Chart line + dot strokes, logo, active sidebar icon |
| `primary-strong` | `#2467E8` | Active pill border |
| `accent-legend` | `#4A90E2` | Legend dot |
| `positive` | `#5AD700` | Positive deltas, all Annualized Returns values |
| `avatar` | `#23366E` | User avatar circle |

> **Three blues.** `#2E71F0`, `#2467E8`, `#4A90E2` are visually near-identical and appear
> to be template drift rather than a system. **Decision: reproduce all three faithfully**
> (the brief asks for pixel-perfect), documented in the README as an observed
> inconsistency we chose not to normalise.
>
> **`positive` is not Tailwind `green-500`.** `#5AD700` is a bright chartreuse; Tailwind's
> `green-500` is `#22C55E`. This — together with `#485465` and `#2E71F0` matching nothing
> in the default scale — **falsifies the Tailwind-default-palette hypothesis** from the
> brief. All colours are custom literals.

#### Chart-specific

| Proposed name | Value | Notes |
|---|---|---|
| `grid` | `#F5F7F8` | The five upper gridlines |
| `grid-baseline` | `#627086` | The `$0` baseline, visibly darker |

> **Gridline gradients resolve to solids — exactly, not approximately.** Each gridline is
> stroked with a radial gradient (`#F5F7F8` → `#E7EBEF`, baseline `#627086` → `#E7EBEF`).
> Its `gradientTransform` is `translate(604.8, -0.7) rotate(90) scale(299.18, 180854)`,
> so across the full 1209px span the gradient offset never exceeds ~0.005 of 1 — every
> pixel renders the stop-0 colour. Using solid stop-0 values is a faithful reproduction,
> not a simplification. Documented in the README all the same.

### 1.2 Type

Family: **Inter** throughout (`Inter:Regular`, `Inter:Medium`, `Inter:Semi_Bold`,
`Inter:Bold`). No fallback stack is specified in the design.

| Role | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|
| Page title ("Dashboard") | 20px | Bold (700) | normal | — |
| Metric card value | 15px | SemiBold (600) | normal (18px box) | — |
| Section title / card title | 15px | Medium (500) | normal; 23px on the Performance title | — |
| Search placeholder | 14px | Medium (500) | normal | — |
| Avatar initials | 14px | SemiBold (600) | normal | — |
| Metric card label, legend, pills | 11px | Regular (400) | normal (13px box) | 0.12px on pills |
| Chart axis labels | 10px | Regular (400) | normal (12px box) | 0.12px |

### 1.3 Radius

| Proposed name | Value | Used by |
|---|---|---|
| `radius-card` | 8px | Metric cards, Performance card, sidebar buttons |
| `radius-field` | 6px | Search field |
| `radius-pill` | 2px | Filter pills |
| `radius-full` | 9999px | Avatar |

### 1.4 Elevation

| Proposed name | Value |
|---|---|
| `shadow-card` | `0 0 5px 0 #EFEFF4` (offset 0/0, blur 5, spread 0, 100% opacity) |

Applied to every card — metric cards and the Performance card alike.

### 1.5 Spacing units observed

Not a clean scale; the design was hand-placed. Recurring values:

`3px` (pill gap) · `6px` (legend dot → label) · `10px` (card gap) · `12px` (sidebar button
inset) · `14px` (metric card padding) · `16px` (Performance card padding) · `20px` (sidebar
logo inset) · `27px` (legend → pill row) · `28px` (section title → cards) · `40px` (control
sizes) · `60px` (sidebar button pitch).

---

## 2. Per-section geometry

Layout constants: page 1440 × 847 · sidebar 63px · **content left edge x=104** · section
titles at x=105 · Performance card right edge x=1390 (50px right margin).

### 2.1 Sidebar (`2:367`)

- Frame **63 × 847**, `surface`, 1px `border` rule on the right edge.
- Logo at (20, 20), **21.89 × 25.37**, fill `primary`.
- Five nav buttons, **40 × 40**, `radius-card`, at x=12, y = 100 / 160 / 220 / 280 / 340
  (**60px pitch**). Icons **24 × 24**, centred (8px inset).
  Order: Dashboard, Strategies, Invoices, Discover, Settings.
- Active button (Dashboard) fill `surface-nav-active`; its icon is `primary`.
- Notifications button **40 × 40** at (11, 736); icon 24 × 24 at (19, 744).
- Avatar **32 × 32** at (15, 796), fill `avatar`, initials "MS" 14px SemiBold `on-accent`.

Nav icons are 24px component instances (Material-Symbols-style outlines), not the Line
Awesome glyphs used in the card header. Each sits in a 24 × 24 box; the glyph's natural
size and offset within that box are fixed by the instance insets:

| Slot | Node | Natural size | Offset in the 24px box |
|---|---|---|---|
| Dashboard (active) | `2:385` | 20 × 17 | (2, 3) |
| Strategies | `2:382` | 20 × 20 | (2, 2) |
| Invoices | `2:379` | 18 × 20 | (3, 2) |
| Discover | `2:376` | 14 × 20 | (5, 2) |
| Settings | `2:373` | 19.45 × 20 | (2.27, 2) |
| Notification | `2:399` | 18 × 21.5 | (3, 1.5) |

**Icon state variants are stacked, not variant-based.** The Dashboard icon node contains
two copies of the same glyph — one `#2E71F0`, one `#77767B` — with only the active colour
rendering. One other nav icon carries the same pair. This is the only encoding of an
active/inactive state anywhere in the file, and it is what fixes inactive nav icons at
`icon-nav`.

### 2.2 Header (`2:350`)

- Bar **1378 × 64** starting at x=63, `surface`, 1px `border` bottom rule.
- Title "Dashboard" at (105, 20), 20px Bold `ink-heading`.
- Search field **351 × 40** at (1041, 12), fill `canvas`, `radius-field`.
  - Icon **12 × 12** at (1054, 26), fill `icon-search`.
  - Placeholder "Search..." at (1074, 23), 14px Medium `ink-placeholder`.

### 2.3 Metric cards (`2:443` Global Metrics, `2:444` Annualized Returns)

Identical card geometry in both sections:

- Card **206 × 70**, `surface`, 1px `border`, `radius-card`, `shadow-card`.
- **10px** horizontal gap (x = 104, 320, 536, 752, 968).
- Label: 14px from the left edge, **18px** from the card top — 11px Regular `ink`.
- Value: 14px from the left edge, **36px** from the card top — 15px SemiBold.

| Section | Title at | Cards at | Value colour |
|---|---|---|---|
| Global Metrics | (105, 87) | y=115 | `ink`, with the parenthetical percentage in `positive` |
| Annualized Returns | (105, 205) | y=233 | `positive` (whole value) |
| Performance | (105, 323) | card at y=351 | — |

Vertical rhythm: section title → cards **28px**; cards bottom → next section title **20px**.

Content (hardcoded per the brief):

- **Global Metrics** — Total Allocation `$2,533,557.32` · Day Change `+$4,482.29 (0.18%)` ·
  YTD Change `+$1,360,225 (115.93%)` · Average Annualized Yield `23%` ·
  Total Depolyed `$21,000,000`
- **Annualized Returns** — All-Time `8.838%` · 30-Day `8.838%` · 7-Day `7.382%` ·
  24-Hour `7.765%`

> `Total Depolyed` is misspelled **in the design**. Reproducing it is pixel-faithful but
> reads as our typo; correcting it silently deviates from the source. **Decision:
> reproduce the string exactly and note the typo in the README**, so the fidelity is
> deliberate and visible rather than ambiguous.

### 2.4 Performance card (`2:70`)

Card **1286 × 451** at (104, 351), `surface`, 1px `border`, `radius-card`, `shadow-card`,
16px horizontal padding.

**Header** (`2:122`)
- Title at (120, 367), 15px Medium / 23px `ink`. (Layer is internally named
  "BitMEX XBTUSD Price" — template residue.)
- Help icon at x=234, 18px box, `icon`.
- Right icon row at x = 1232, 1272.25, 1312.5, 1352.76 (**40.25px pitch**), 18px boxes,
  `icon`: share, download, expand, ellipsis-vertical.
- `divider` rule, 1px, full card width, at y=407 (**56px** from card top).

**Legend** (`2:102`) — dot **9 × 9** `accent-legend` at (120, 424); label at (135, 422),
11px Regular `ink-secondary`. **6px** gap; row sits **15px** below the divider.

**Filter pills** (`2:105`) — row at y=449 (**27px** below the legend row).
- Height **22px**, `radius-pill`, **3px** gaps.
- Width **30.19px** for `7d 1m 3m 6m 1y YTD All`, **52.33px** for `Custom`.
- Order left→right: `7d 1m 3m 6m 1y YTD Custom All`; total row width **284.79px**
  (x=120.1 → 404.89), leaving **~985px** of empty space to the card's right edge.
- Inactive: fill `surface-muted`. Active (`All`): fill `surface-selected` + 1px
  `border-selected`.
- Labels 11px Regular `ink-secondary`, centred, tracking 0.12px.

**Plot area** (`2:75`)
- Six horizontal gridlines, 0.6px, spanning x=153→1362 (**1209px**), at
  y = 515 / 561 / 608 / 655 / 702 / 748 (**~46.6px** rhythm). Plot height **233px**.
- Top five use `grid`; the bottom (`$0`) uses `grid-baseline`. **No vertical gridlines.**
- Y labels right-aligned ending at x≈146.6, 10px Regular `ink-muted` (`0`, `$1M`…`$5M`).
  (Layers are named `$9.2k`–`$9.6k` — more template residue.)
- X labels at y=759 (**11px** below the baseline), 10px Regular `ink-muted`, centred,
  **87px** pitch, alternating a date (`1 Feb`) and `12h` — i.e. date at midnight, `12h`
  at noon. Confirms the brief's reading of the axis.
- Series: 14 points across **1137px** (**~87px** apart), line 1.5px `primary`,
  dots **r=3** (6px diameter) filled `#FFFFFF` with 1.5px `primary` stroke.

---

## 3. Icon assets

All 13 icons in the design, exported as outlined vector (no font dependency). Their home is
`packages/web/src/components/icons/`, which the app shell commit creates.

The inventory is verified complete against `download_assets(2:30)`, which returned 20
vector assets, accounted for as follows:

- **8 icons** — the five sidebar glyphs, the notification bell, the search magnifier and
  the logo.
- **2 duplicates** — colour variants of two sidebar glyphs, from the stacked
  active/inactive pairs described in §2.1.
- **10 non-icons** — the Performance card chrome, two gridlines, the chart line, three
  rules and dividers, the legend dot, the avatar circle, and one empty vector layer.

The remaining **5 icons are absent from that dump by design**: they are text nodes set in
the Line Awesome font, not vector layers, so they had to be exported separately from their
own nodes (`2:125`–`2:129`).

| File | Source node | Glyph | viewBox |
|---|---|---|---|
| `help-circle.svg` | `2:125` | Line Awesome `U+F059` question-circle | 14 × 14 |
| `share.svg` | `2:129` | Line Awesome `U+F064` share | 14 × 13 |
| `download.svg` | `2:126` | Line Awesome `U+F019` download | 11 × 14 |
| `expand.svg` | `2:127` | Line Awesome `U+F31E` expand | 14 × 14 |
| `more-vertical.svg` | `2:128` | Line Awesome `U+F142` ellipsis-vertical | 3 × 12 |
| `nav-dashboard.svg` | `2:385` | home | 24 × 24 |
| `nav-strategies.svg` | `2:382` | newspaper | 24 × 24 |
| `nav-invoices.svg` | `2:379` | receipt (5 paths) | 24 × 24 |
| `nav-discover.svg` | `2:376` | lightbulb | 24 × 24 |
| `nav-settings.svg` | `2:373` | gear | 24 × 24 |
| `notification.svg` | `2:399` | bell | 24 × 24 |
| `search.svg` | `2:357` | magnifier | 12 × 12 |
| `logo.svg` | `2:386` | product mark | 21.89 × 25.37 |

Cleaning applied to every file: export-artifact background rects removed (the `#E5E5E5`
bounding box and the `#F9F9FB` page rect), wrapper groups unwrapped, and hardcoded fills
replaced with `currentColor` so colour comes from the token. **Path data is untouched.**
The six sidebar icons are wrapped in a `translate()` matching their instance offset above,
so each renders correctly in a 24 × 24 box.

**Licence.** The design uses **Line Awesome** (Icons8) glyphs — the layer font is
`la-solid-900`. Line Awesome is dual-licensed: the fonts under **SIL OFL 1.1**, the CSS and
other non-font files under **MIT**. We ship five outlined glyphs as inline SVG rather than
the font, which keeps us clear of the OFL's reserved-font-name and bundling clauses while
still requiring attribution in the README.
Sources: [Icons8 Line Awesome licence](https://intercom.help/icons8-7fb7577e8170/en/articles/4732843-line-awesome-license) ·
[icons8/line-awesome LICENSE.md](https://github.com/icons8/line-awesome/blob/master/LICENSE.md)

> The brief assumed `lucide-react`. **That assumption is falsified** — the design uses Line
> Awesome. Using the exact exported glyphs is both more faithful and one dependency lighter.

---

## 4. What the source does *not* define

Verified absent from the file, not overlooked. Everything here is a **documented
adaptation** — a decision we had to make because the design is silent, not an omission.

| Missing | Consequence |
|---|---|
| **Responsive frames** — one page, one frame, 1440 × 847 | Pixel-perfect is only *defined at 1440*. Every breakpoint, the card-grid collapse, the hidden sidebar and the control-band wrap are ours |
| **Interaction states** — no component variants; hover, focus, active and disabled are undesigned | Pill hover, focus rings and button feedback are ours. The only state evidence in the file is the stacked active/inactive nav icon pair |
| **Dynamic-view design** — no tooltip, loading, error or empty state | All four are ours: chart tooltip, skeleton, error-with-retry, and the empty-pair state |
| **Fonts not embedded** — Inter is referenced by name only | Shipped via `@fontsource/inter` (weights 400/500/600/700), self-hosted rather than CDN |
| **No dark mode, no motion, no grid system** | Light-only, static, hand-placed geometry reproduced as measured |

## 5. Template artifacts (context, no action)

The file was hand-assembled from a portfolio-dashboard template and carries leftovers:
zero variables/styles, the Performance title layer named "BitMEX XBTUSD Price", y-axis
layers named `$9.2k`–`$9.6k` while displaying `$1M`–`$5M`, the "Depolyed" typo, and three
near-identical blues. None of this affects the rendered design; it explains why the values
above are literals rather than a token system.
