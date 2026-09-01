# hajimi Preferences UI System

This is the small, local UI system for the Preferences panel. It is inspired by
the two-pane settings surface in `/Users/wavef/Documents/AI/genoffice`, while
using hajimi's existing semantic theme tokens and behavior.

## Direction

- Neutral desktop utility UI: quiet, direct, and easy to scan.
- Settings are organized into a left navigation rail and one scrollable content pane.
- Controls are aligned to a shared right edge; labels stay on the left.
- Prefer structure, whitespace, and hairline rules over decoration.
- Do not use gradients, oversized marketing copy, emoji as navigation icons, or
  persistent card shadows inside the panel.

## Layout tokens

| Token              |            Value | Use                                    |
| ------------------ | ---------------: | -------------------------------------- |
| Dialog width       |        960px max | Main Preferences dialog                |
| Dialog height      | 720px max / 90vh | Keep the panel usable on short screens |
| Dialog radius      |             14px | One restrained outer radius            |
| Header padding     |        18px 22px | Title and close action                 |
| Navigation width   |            232px | Fixed desktop rail                     |
| Content padding    |    8px 28px 24px | Scrollable settings pane               |
| Row minimum height |             52px | Consistent field rhythm                |
| Row gap            |             20px | Label-to-control separation            |
| Navigation radius  |              8px | Active and hover states                |

## Type and color

- Use the existing system font stack (`-apple-system`, `SF Pro`, and CJK fallbacks).
- Panel title: 20px / 600. Section title: 18px / 600. Field label: 14px / 400.
- Supporting text: 12–13px using `--color-muted`.
- Use `--color-text`, `--color-header`, `--color-muted`, `--color-border`,
  `--color-elevated-bg`, and `--color-accent` only; do not introduce a second
  visual theme for Preferences. The accent is macOS blue: `#007AFF` in light
  mode and `#0A84FF` in dark mode.
- The active navigation item uses a neutral elevated background. Accent color is
  reserved for focus rings, enabled controls, and explicit primary actions.
- The modal may retain one soft outer shadow; controls should remain flat.

## Component rules

### Navigation

- Use short categories: General, Search, and Indexing.
- Each item has a 16–18px monochrome line icon, an 8px radius, and a minimum
  40px hit area. Navigation items are flat: no shadow and no saturated active
  background.
- Active state is conveyed by neutral background plus medium/bold text, not by
  a saturated block.
- Navigation buttons must expose `aria-current` and retain a visible keyboard focus ring.

### Settings rows

- Use a two-column row: flexible label/details on the left, control on the right.
- Do not divide individual rows. Each major section gets one hairline divider
  beneath its heading; spacing provides separation between options.
- Long labels may wrap; controls must not move unpredictably between rows.
- Help text belongs beneath the related label/control and should be concise.

### Controls and states

- Selects and text fields use a 7px radius, 1px border, and the elevated surface;
  selects use 5px 10px padding and editable input text uses a monospace stack.
- Switches use a compact iOS-style 44×26px track with 2px inner padding,
  white thumb, and iOS green enabled state.
- Primary and secondary actions are flat, compact, and aligned in the footer.
- Hover changes surface or border only. Pressed buttons use
  `filter: brightness(0.8)` so text and background retain their contrast.
- All interactive elements require `:focus-visible` treatment. Respect
  `prefers-reduced-motion` for scrolling and transitions.

## Responsive behavior

- At widths below 760px, convert the left rail into a horizontally scrollable
  category bar above the content pane.
- At narrow widths, rows become stacked label-then-control blocks.
- The content pane remains the only scrolling region inside the dialog.

## Acceptance checks

- A user can identify the three setting categories at a glance.
- Every setting row has the same alignment and vertical rhythm.
- The panel reads as a native utility surface in both light and dark themes.
- The panel remains usable with keyboard navigation and at narrow window sizes.
