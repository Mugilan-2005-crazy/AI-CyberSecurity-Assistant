# UI Guide — CyberSphere AI v3.1.0

## Design System

CyberSphere AI uses a consistent design system built on Tailwind CSS with custom design tokens.

### Design Tokens

#### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#0ea5e9` | Primary actions, links, active states |
| `cyber-400` | `#22d3ee` | Cyber accent, icons, highlights |
| `danger` | `#ef4444` | Error states, destructive actions |
| `success` | `#22c55e` | Success states, confirmations |
| `warning` | `#f59e0b` | Warning states, alerts |
| `surface-card` | `#ffffff` / `#1e293b` | Card backgrounds (light/dark) |

#### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | Inter, system-ui | Base font family |
| `text-xs` | 12px | Captions, labels |
| `text-sm` | 14px | Body text |
| `text-base` | 16px | Default text |
| `text-lg` | 18px | Section headings |
| `text-xl` | 24px | Page titles |
| `text-2xl` | 32px | Hero headings |

#### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `p-2` | 8px | Small padding |
| `p-4` | 16px | Standard padding |
| `p-6` | 24px | Section padding |
| `gap-2` | 8px | Small gap |
| `gap-4` | 16px | Standard gap |
| `gap-6` | 24px | Section gap |

#### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded` | 4px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, modals |
| `rounded-full` | 9999px | Badges, avatars |

### Animations

| Token | Value | Usage |
|-------|-------|-------|
| `animate-fade-in` | Fade in 0.2s ease-out | Page transitions |
| `animate-slide-up` | Slide up 0.3s ease-out | Card entrances |
| `animate-pulse-slow` | Pulse 2s infinite | Loading indicators |
| `animate-spin` | Spin 1s linear infinite | Loaders |

## Components

### Button

**Usage:** Primary actions, form submissions, navigation.

**Variants:**
- `bg-primary` — Primary action button
- `bg-danger` — Destructive action button
- `bg-slate-200` — Secondary/ghost button

**States:**
- Default, hover, focus, active, disabled
- Loading state with spinner

### Card

**Usage:** Content containers, module panels, dashboard widgets.

**Variants:**
- Default card with border and shadow
- Glass card (`glass` class) for topbar and overlays

### Input

**Usage:** Form fields, search boxes, text inputs.

**States:**
- Default, focus, error, disabled
- Error state with red border and error message
- Success state with green border

### Modal

**Usage:** Dialogs, confirmations, detail views.

**Features:**
- Focus trap
- Escape key to close
- Backdrop click to close
- Animated entrance and exit

### Badge

**Usage:** Status indicators, labels, tags.

**Variants:**
- `bg-primary` — Informational
- `bg-success` — Success/active
- `bg-warning` — Warning/pending
- `bg-danger` — Error/critical

### Alert

**Usage:** Inline notifications, banners.

**Variants:**
- `bg-success/10` — Success alert
- `bg-warning/10` — Warning alert
- `bg-danger/10` — Error alert
- `bg-info/10` — Informational alert

### Loader

**Usage:** Loading states for async operations.

**Variants:**
- Spinner — Full-screen loading
- Inline spinner — In-content loading
- Skeleton — Content placeholder

### Skeleton

**Usage:** Loading placeholders for content.

**Patterns:**
- Text skeleton — Wavy line placeholder
- Card skeleton — Card-shaped placeholder
- Table skeleton — Row placeholders

### Tooltip

**Usage:** Hover information for icons and actions.

**Features:**
- Appears on hover and focus
- Keyboard accessible
- Auto-positioning

## Dashboard Layout

### SOC Dashboard

The SOC dashboard provides a comprehensive security overview:

1. **Threat Overview Cards** — Key metrics at a glance
   - Total scans, threats detected, safe scans, security score
2. **Risk Score Visualization** — Risk gauge and trend chart
3. **Security Posture Graph** — Compliance and posture over time
4. **Recent Alerts Timeline** — Chronological alert feed
5. **AI Recommendations** — AI-generated security suggestions
6. **System Health Indicators** — Service health status

### Page Structure

```
┌─────────────────────────────────────────────┐
│ Topbar (notifications, theme, user menu)    │
├──────────┬──────────────────────────────────┤
│ Sidebar  │ Main Content Area                │
│          │                                    │
│ Modules  │  Page-specific content            │
│ Navigation│  with loading/error/empty states  │
│          │                                    │
│ Admin    │                                    │
│ Section  │                                    │
├──────────┴──────────────────────────────────┤
│ Footer (version, status)                     │
└─────────────────────────────────────────────┘
```

## Responsive Design

### Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| Mobile | < 640px | Single column, hamburger menu |
| Tablet | 640px - 1024px | Two-column layout |
| Desktop | > 1024px | Full sidebar + content |

### Mobile Considerations

- Sidebar collapses to a drawer with hamburger menu
- Cards stack vertically
- Tables scroll horizontally
- Touch targets are at least 44x44px
- Navigation uses bottom tab bar on mobile

## Accessibility

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order follows visual layout
- Focus indicators are visible on all interactive elements
- Escape key closes modals and dropdowns
- Enter/Space activates buttons and links

### Screen Reader Support

- All images have `alt` attributes
- Form fields have associated `<label>` elements
- ARIA attributes (`aria-label`, `aria-describedby`, `aria-invalid`) are used appropriately
- Live regions announce dynamic content changes
- Role attributes define landmark regions

### Color Contrast

- All text meets WCAG 2.2 AA contrast ratios (4.5:1 minimum)
- Interactive elements have visible focus indicators
- Color is never the sole indicator of state

## Theming

### Light Mode

- Background: `#ffffff`
- Surface: `#f8fafc`
- Text: `#1e293b`
- Border: `#e2e8f0`

### Dark Mode

- Background: `#0f172a`
- Surface: `#1e293b`
- Text: `#f1f5f9`
- Border: `#334155`

## Error Handling UI

### Loading State

- Skeleton UI with animated placeholders
- Spinner overlay for full-page loading
- Progress bar for file uploads

### Error State

- Friendly error message (no raw stack traces)
- Retry action button
- Suggested next steps
- Error boundary catches unhandled errors

### Empty State

- Helpful illustration or icon
- Clear explanation of what's empty
- Call-to-action to get started

### Success State

- Clear confirmation message
- Visual feedback (checkmark, green highlight)
- Optional: auto-dismiss after 3 seconds