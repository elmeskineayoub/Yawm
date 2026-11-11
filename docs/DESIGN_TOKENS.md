# Yawm design tokens

The working token set for the design-standards pass. Values live in `app/globals.css`; this page
says what each is for. Pages reference a token by role and never a raw value. First applied to the
Dashboard (`components/dashboard/`); other pages still use the older utilities until they are moved.

## Colour

Unchanged (see `docs/UX_REDESIGN.md` §5): `background`, `surface`, `surface-muted`, `foreground`,
`muted-foreground`, `border`, `input-border`, `primary` (+ `-foreground`, `-hover`), `accent`
(+ `-foreground`, `-soft`), and the states `success`, `warning`, `danger`, `info` (+ `-soft`).
Each has a light and a dark value. Measured on the Dashboard in both themes: every text pairing
meets WCAG AA (4.5:1, or 3:1 for large text).

## Type

| Token        | Size / line    | Class                   | Use                                             |
| ------------ | -------------- | ----------------------- | ----------------------------------------------- |
| Title (h1)   | 30 / 36, serif | `page-title`            | Page title (26 / 32 on phones)                  |
| Display      | 28 / 34, serif | `text-display`          | The page's one featured line (24 on phones)     |
| Section (h2) | 18 / 24, 600   | `text-h2`               | Page section headings                           |
| Card (h3)    | 14 / 20, 600   | `text-sm font-semibold` | Card titles                                     |
| Body large   | 16 / 24        | `text-base`             | The summary sentence under the title            |
| Body         | 14 / 20        | `text-sm`               | Rows, links, sentences. The minimum for content |
| Value        | 20 / 28, 600   | `text-xl font-semibold` | Figures in stat groups                          |
| Caption      | 12 / 16        | `text-caption`          | Labels and metadata only (dates, counts, units) |

## Spacing (4px step)

| Token        | Value | Class                                 | Use                            |
| ------------ | ----- | ------------------------------------- | ------------------------------ |
| `card`       | 24px  | `sm:p-card`                           | Card padding, tablet and up    |
| `card-sm`    | 16px  | `p-card-sm`                           | Card padding, phones           |
| `gutter`     | 24px  | `gap-gutter`                          | Between cards                  |
| `section`    | 64px  | `lg:space-y-section`                  | Between page sections, desktop |
| `section-sm` | 48px  | `space-y-section-sm`                  | Between page sections, phones  |
| `tap`        | 44px  | `min-h-tap`, `size-tap`, `tap-target` | Minimum touch target           |

## Radius

`rounded-card` (8px) for cards and panels, `rounded-control` (6px) for buttons and inputs,
`rounded-bar` (4px) for chart bars and small marks, `rounded-full` for dots and meters.

## Components

- **Card** (`components/ui/card.tsx`): the one card surface (`cardClass`) with an h3 title, an
  optional count, and header actions. **PageSection**: an h2 and the cards beneath it.
- **Buttons** (`components/ui/button.tsx`): primary (one per page), secondary, ghost. On touch
  screens add `pointer-coarse:min-h-tap`.
- **Links:** `text-link` in text; `tap-target text-link` for a standalone link.
- **Task rows:** `<TaskList comfortable>` gives the checkbox, title, and menu 44px targets on touch
  screens.

## Rules

1. One primary (filled) button per page.
2. Heading sizes step down: title → section → card. Nothing else uses those sizes.
3. Content text is never under 14px; captions (12px) are for labels and metadata only.
4. Every standalone link or control is a 44px target on touch screens.
5. New token names must also be listed in `lib/utils.ts`, or `cn()` will drop them.
