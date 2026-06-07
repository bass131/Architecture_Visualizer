# UI Guide

## Intent

The atlas is a dense engineering tool, not a marketing page. Favor legibility, hierarchy, and evidence over decoration. Every user-facing capability must remain discoverable from `_index.html`.

## Visual System

- Background: `#0b0e12`
- Panels: `#11161d`, `#171d26`, `#1d2530`
- Borders: `#293442`
- Primary text: `#e7edf4`
- Muted text: `#8d9aaa`
- Primary accent: `#d5f05c`
- Secondary accent: `#6ed7c7`
- Relationship colors: blue `#73a7ff`, orange `#f2a65a`, red `#ff6b6b`, violet `#b697ff`
- Typography: system-first `Inter`, `Pretendard`, `Noto Sans KR`; monospace for source paths and signatures

Use color as a secondary signal. Labels, relation names, and severity text must remain understandable without color.

## Layout

- Keep the top navigation, type tree, main workspace, and context panel as the primary desktop structure.
- Preserve keyboard search and visible focus behavior.
- Use compact cards and lists for evidence-heavy information.
- Keep source paths, line numbers, diagnostic evidence, and static-analysis limitations near the result they qualify.
- Responsive layouts may stack or hide secondary panels, but must not remove access to their content.

## Components

- Tabs switch major tasks, not minor filters.
- Chips and badges represent filters, relation kinds, patterns, or severity.
- High and medium diagnostic styles indicate review priority, never pass/fail status.
- Graph edges and nodes require textual alternatives in adjacent lists or context panels.
- Empty states explain what action produces content.

## Interaction

- Avoid navigation that requires a server, router, or network request.
- Keep controls usable through keyboard input and semantic HTML.
- Do not use animation that delays inspection. Motion should be brief and functional.
- Preserve the selected type or method context when switching related views where practical.

## Avoid

- Decorative glassmorphism, neon glow, or gradient text
- Large hero sections and marketing copy
- Icon-only controls without accessible names
- Color-only severity or relation encoding
- Hidden hover-only evidence
- External fonts, CDNs, analytics, or runtime dependencies
