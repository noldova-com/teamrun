# TeamRun UI standards

**Scope:** Appearance, shared controls, interaction and accessibility for the shell and modules. The [coding standards](CODING-STANDARDS.md) own implementation and security.

TeamRun uses a compact IDE-style shell with no separate activity bar. Its appearance comes from a theme (section 2); the default theme uses panel cards, pill tabs and restrained surfaces. Reference applications do not automatically change these rules.

Sections 1 and 8 own typography/units and component metrics. Dimensions yield to text fitting, responsive layout and accessibility.

## 1. Typography

Use Noldova Sans for interface and prose, and Noldova Mono for code, with system fallbacks. Appearance offers independent interface and code font choices; selecting System changes only that font stack. Font assets and their licenses must be reviewed before distribution.

Panel, message and code sizes are independently adjustable from 12 to 18 CSS pixels. Labels and headings derive from them. All roles use shared tokens; components define no text sizes.

Use rem for dimensions. The root size in CSS pixels is `16 × panelSize / 13`, preserving the default 13px panel text and 16px root. Interface text, icons, spacing, radii, shadows and geometry scale together. Message and code sizes remain independently chosen pixel sizes.

Keep pixels for thin borders, dividers, outlines and progress bars; fixed minimums such as pointer targets; and the three chosen font sizes. Use percentages, flex or grid for dimensions tied to available space.

| Role | Token or derivation | Default size | Line-height rule |
|---|---|---|---|
| Panel | `--tr-text-panel` | 0.8125rem | At least 1.125rem and at least the font size plus 0.3125rem |
| Message | `--tr-text-message` | 14px, as chosen | 1.6 for prose |
| Code | `--tr-text-code` | 14px, as chosen | At least 1.5; preserve code alignment |
| Label | Derived from panel size: the larger of 12px and panel size minus 0.0625rem | 0.75rem | At least the font size plus 0.25rem; tooltips use at least the font size plus 0.4375rem |
| Settings group heading | Twice the panel size | 1.625rem | At least 1.25 times the font size |

Panel text applies to navigation, menus, fields, options and dialog text. Label text applies to section headers, button labels, tooltips and secondary details. Prose a person reads or writes uses the message role; code blocks and diffs use the code role.

Use weight 400 for ordinary text and 600 for document titles, section headers, setting/dialog titles and choice pills. Row/tab selection does not change weight; choice pills retain 600 in both states.

Rows, controls, headings and overlays grow with fonts, zoom, translations and validation text; never clip glyphs or labels vertically. Specified horizontal truncation retains the full accessible name or tooltip.

Use Material Symbols Rounded for interface icons. Glyph sizes and control geometry are separate: a small icon still needs a usable pointer target.

## 2. Themes and color

A theme gives TeamRun its appearance. The person chooses a theme and, separately, a mode: light, dark or the operating system's.

A theme consists of:

- **Colors:** for each mode, values for the theme keys in the table below. A token whose key the theme leaves out uses its fallback, then the default theme's value.
- **A look:** values for the geometry tokens (radii, borders, spacing, shadows and section 8's component dimensions) and, for each kit control that offers shapes, the shape it uses.

A shape is a named form of a kit control, such as the tab's `pill`. The kit implements every shape; a theme only chooses among them.

A theme is data: it contains no styles, selectors or code and changes nothing else. Fonts and text sizes stay the person's choice, and this document's layout, interaction and accessibility rules hold in every theme and mode.

The shell's default theme defines the values in this document: the colors below and the look of sections 3, 4 and 8. Another theme provides its colors for both modes and the parts of the look it changes; the rest comes from the default theme. Modules contribute themes under the [architecture](ARCHITECTURE.md#5-contributions).

Every color uses a theme token. The default theme's light and dark colors start from the table below; provide complete initial tokens before painting themed content. Section 9 governs module tokens.

The application's icon follows the operating system's appearance, not the theme. Each window on Windows and Linux shows the light or dark icon and switches when the system's appearance changes; on Windows the taskbar's own appearance decides, and the taskbar shows the same icon. macOS shows one icon in the Dock.

The table specifies normal-state colors. Check actual composited foreground/background pairs in hover, selection and overlay states under section 7; correct the mapping or use a verified fallback when needed. Decorative borders may remain subtle; boundaries needed to identify controls must meet non-text contrast requirements.

| Token | Theme key or source | Light | Dark | Use |
|---|---|---|---|---|
| `--tr-window` | `sideBar.background` | #F8F8F8 | #181818 | Shell and dock surfaces |
| `--tr-panel` | `editor.background` | #FFFFFF | #1F1F1F | Document surface |
| `--tr-raised` | `teamrun.raisedBackground`, fallback `editorWidget.background` | #F8F8F8 | #2B2B2B | Raised cards |
| `--tr-code` | `teamrun.codeBackground`, fallback `sideBar.background` | #F8F8F8 | #181818 | Code body |
| `--tr-code-header` | `teamrun.codeHeaderBackground`, fallback `editorWidget.background` | #F2F2F2 | #2B2B2B | Code header |
| `--tr-inline-code` | Foreground mixed at 12% over the local surface | 12% foreground | 12% foreground | Inline-code background; text remains fully opaque |
| `--tr-text` | `foreground` | #3B3B3B | #CCCCCC | Ordinary text and selected-tab labels |
| `--tr-text-muted` | `teamrun.mutedForeground`, fallback `descriptionForeground` | #616161 | #9D9D9D | Secondary text on normal surfaces |
| `--tr-text-tab` | Opaque muted text, adjusted for its surface | #616161 | #9D9D9D | Unselected, operable tab labels |
| `--tr-text-placeholder` | Opaque muted text, adjusted for its surface | #616161 | #9D9D9D | Placeholder of a prose input |
| `--tr-icon-color` | `icon.foreground`, fallback `foreground` | #3B3B3B | #CCCCCC | Interface icons |
| `--tr-card-border` | `surface.border`, fallback `widget.border` | #E5E5E5 | #252526 | Decorative panel border |
| `--tr-border` | `sideBarSectionHeader.border` | #E5E5E5 | #2B2B2B | Section dividers |
| `--tr-accent` | `focusBorder`, contrast-adjusted | #005FB8 | #4DAAFC | Focus, drop guides and active resize indicators |
| `--tr-link` | `textLink.foreground` | #005FB8 | #4DAAFC | Links |
| `--tr-hover` | `list.hoverBackground` | #F2F2F2 | #2A2D2E | Row, tab and menu-item hover |
| `--tr-selected` | `list.inactiveSelectionBackground`, fallback `list.activeSelectionBackground` | #E4E6F1 | #37373D | Selected rows, tabs and choice pills |
| `--tr-toolbar-hover` | `toolbar.hoverBackground` | #B8B8B850 | #5A5D5E50 | Icon-button hover |
| `--tr-scrollbar` | `scrollbarSlider.background` | #64646466 | #79797966 | Scrollbar thumb; adjust when needed for visibility |
| `--tr-title-bar`, `--tr-title-bar-text` | `titleBar.activeBackground`, `titleBar.activeForeground` | #F8F8F8, #1E1E1E | #181818, #CCCCCC | Native title-bar integration |
| `--tr-input`, `--tr-input-border`, `--tr-input-text`, `--tr-placeholder` | `input.*`, with contrast-checked border fallback | #FFFFFF, #858585, #3B3B3B, #767676 | #313131, #858585, #CCCCCC, #989898 | Fields and selects; placeholders are not substitutes for labels |
| `--tr-button`, `--tr-button-text`, `--tr-button-hover` | `button.*` | #005FB8, #FFFFFF, #0258A8 | #0078D4, #FFFFFF, #026EC1 | Primary button |
| `--tr-button-secondary`, `--tr-button-secondary-text`, `--tr-button-secondary-hover` | `button.secondary*` | #E5E5E5, #3B3B3B, #CCCCCC | transparent, #CCCCCC, #2B2B2B | Secondary button |
| `--tr-dropdown`, `--tr-dropdown-border`, `--tr-dropdown-list` | `dropdown.*`, fallback `input.*` | #FFFFFF, #858585, #FFFFFF | #313131, #858585, #1F1F1F | Select and options list |
| `--tr-list-active`, `--tr-list-active-text` | `list.activeSelection*` | #E8E8E8, #000000 | #04395E, #FFFFFF | Chosen or keyboard-active option |
| `--tr-button-border` | `button.border` | #0000001A | #FFFFFF1A | Decorative edge where the button fill already identifies the control |
| `--tr-setting-title` | `settings.headerForeground`, fallback `foreground` | #1F1F1F | #FFFFFF | Settings titles |
| `--tr-hover-widget`, `--tr-hover-widget-border` | `editorHoverWidget.*`, fallback `editorWidget.background` / `widget.border` | #F8F8F8, #3B3B3B33 | #202020, #CCCCCC33 | Tooltip surface |
| `--tr-quick-input` | `quickInput.background`, fallback `editorWidget.background` | #F8F8F8 | #222222 | Search surface |
| `--tr-menu-separator` | `menu.separatorBackground`, fallback `widget.border` | #3B3B3B33 | #454545 | Decorative menu separator |
| `--tr-widget-shadow` | `widget.shadow` | #00000029 | #0000005C | Select-list shadow |
| `--tr-widget-border` | `widget.border`, fallback `surface.border` | #E5E5E5 | #313131 | Dialog and search outline |
| `--tr-dialog` | `dialog.background`, fallback `editorWidget.background` | #F8F8F8 | #202020 | Dialog surface |
| `--tr-menu`, `--tr-menu-text`, `--tr-menu-border` | `menu.*` | #FFFFFF, #3B3B3B, #CECECE | #1F1F1F, #CCCCCC, #454545 | Menus; keyboard and pointer rows use the hover fill |
| `--tr-checkbox`, `--tr-checkbox-border` | `checkbox.*`, with contrast-checked border fallback | #F8F8F8, #858585 | #313131, #858585 | Checkbox surface and identifiable boundary |
| `--tr-badge`, `--tr-badge-text` | `badge.*` | #CCCCCC, #3B3B3B | #616161, #F8F8F8 | Available filled-badge pair; count chips use the component table |
| `--tr-progress` | `progressBar.background`, fallback accent | #005FB8 | #4DAAFC | Progress indicators |
| `--tr-docking-preview`, `--tr-docking-preview-border` | `teamrun.dockingPreviewBackground`, fallback `list.inactiveSelectionBackground`; `teamrun.dockingPreviewBorder`, fallback `focusBorder` | #E4E6F1, #005FB8 | #37373D, #4DAAFC | The area a dragged tab will occupy |
| `--tr-notification`, `--tr-notification-border` | `notifications.*` | #FFFFFF, #E5E5E5 | #1F1F1F, #454545 | Notification surface |
| `--tr-error`, `--tr-removed` | Semantic error/removal foregrounds | #A1260D | #F48771 | Errors and removed lines/counts, with text or symbols identifying their meaning |
| `--tr-added` | Semantic addition foreground | #3F6212 | #B5CEA8 | Added lines/counts and copy-success icon |
| `--tr-added-background`, `--tr-removed-background` | Respective semantic foreground mixed over the local surface | 12% foreground | 12% foreground | Diff backgrounds; normal code text remains readable |

Use selected foreground or another validated token when muted text loses contrast on selected surfaces. Sections 6 and 7 distinguish readable secondary text from disabled controls.

Use one interaction accent per theme; errors and additions/removals have separate semantic colors. Section 7 governs contrast and non-color cues in every theme and mode.

Shadows are shared tokens: `--tr-shadow-large` is 0 0 0.75rem at 14% black; `--tr-shadow-xlarge` is 0 0 1.25rem at 15% black; `--tr-widget-shadow` supplies select lists. Menus, tooltips, dialogs, search overlays and drag ghosts may use their assigned shadow. Ordinary panel and content cards do not. A modal backdrop uses `--tr-backdrop` at 50% black; a non-modal search overlay does not dim the window.

Nested previews, including the Gallery, resolve base and derived colors within their own scope. Framework tokens use the same sources; changing libraries requires a separate decision.

## 3. Panels and surfaces

Each tab group uses a panel card with a tab bar and active content. Groups in a dock use the shell surface; groups in the middle use the panel surface. Collapsed docks show view icons. Section 8 owns card geometry.

Do not add dividers below the native window row or every tab bar, or between every container. Optional section-header separators, functional borders, table separators and code-header dividers remain allowed.

Panel cards may clip content to their corners; overlays, focus indicators and drag guides must remain visible and controls accessible.

Radius tokens: `hover` = 0.1875rem, `small` = 0.25rem, `medium` = 0.375rem, `large` = 0.5rem; `round` is only for circles and avatars. Section 8 alone assigns component radii.

## 4. Tabs and navigation

- Show a tab bar for every panel, including a panel with one view. The document strip scrolls horizontally when necessary, keeps the active tab visible and offers an overflow list. Dock actions remain reachable at the end of their strip.
- A tab shows selection and hover through its shape; the `pill` shape uses a fill. Selected labels use ordinary text; unselected labels use the opaque tab-text token. Hover must not erase the selection or keyboard-focus cue. A tab whose content is working can replace the close glyph with a spinner, but hovering or focusing the tab reveals its close action.
- Middle-click uses the targeted tab's close action without activating a background tab or starting autoscroll. Closing the active tab focuses a surviving tab/panel; section 7 requires keyboard access.
- The window row runs across the top and the status bar along the bottom. Between them, the window has four regions: the left, right and bottom docks and the middle. Each region holds one or more tab groups, side by side or stacked. Every view can be placed in any region, including beside the documents or as a tab among them; documents, Settings among them, stay together in one group in the middle. Document tabs only reorder within that group; they are not split or docked.
- Dragging a view's tab shows docking guides over the tab group under the pointer: the center target adds the tab to that group, and four arrows split the group, placing the tab to its left, right, top or bottom. A guide for each side docks the tab along the whole left, right or bottom side, centered in the area the tab would take there. Hovering a target previews the area the tab will occupy; dropping away from every target changes nothing. Dragging a document's tab shows no docking guides and only reorders it within its group. The dragged representation may dim; its name remains available in the accessible interaction. Provide keyboard/menu alternatives for moving, splitting, pinning and docking views and for reordering documents.
- Splits resize with a handle between groups. A group closes when its last tab leaves, and its space returns to its neighbors. The layout, including splits and their sizes, is restored after a restart. **Reset the layout**, in the shell's panel menu, returns to the default.
- With no modules, the docks are hidden and the middle shows a quiet card with the product name and "No modules".
- Each strip has one italic preview tab, replaced by the next preview. A keep action or double-click retains it; modules may define additional keep actions. Section 7 requires keyboard equivalents.

## 5. Spacing and responsive layout

Use spacing tokens of 0.25, 0.5, 0.75, 1 and 1.5rem with section 8's component measurements.

- Overlays fit within the window 0.5rem inside its edges, below the window row and above the status bar; an overlay anchored in the window row or the status bar may come within 0.5rem of that edge instead. Reduce preferred widths as needed; bound height and scroll content while keeping essential actions reachable.
- Fields/selects shrink to their container; settings rows and dialog actions wrap or stack. Errors wrap within their owner. Truncated labels retain their full accessible name.
- Prose wraps; code and genuinely two-dimensional tables/diffs may scroll horizontally within their own region. A long string must not widen the document card or the entire window.
- Prefer enough room for the document before the docks. When space decreases, shrink the left dock first, then the right, and the bottom on the vertical axis. Preserve the user's saved dock and split sizes so they return when space becomes available. Groups in a split keep a minimum size and share the rest of their region in proportion. If preferred minima cannot fit, collapse docks into reachable controls rather than overflowing the window or producing negative pane sizes.
- Resize within available window bounds. Navigation, hidden-dock controls and dialog actions stay reachable at the smallest supported window and enlarged zoom; drafts, selections and reading position survive layout changes.
- Native window controls and application overlay controls occupy separate usable regions. An overlay's own controls must never be covered by the operating system's close/minimize controls.

## 6. Interaction states

- **Hover:** use the appropriate row, toolbar or button hover token. A checkbox or field does not need an extra hover fill. Hover-only actions also appear on keyboard focus and remain usable while the pointer moves to them.
- **Pointer:** buttons, links, tabs, selectable rows and menu items use a hand cursor; editable text uses the text cursor, resize handles use their resize cursor, and disabled controls use the default cursor.
- **Selection:** rows, tabs and choice pills use the selected surface; keyboard-active options use the active-list pair. A checked checkbox shows its mark. Section 7 governs semantics and non-color cues.
- **Focus:** editable fields use the accent border. Other controls have a visible keyboard-focus outline that survives hover and selection and is not clipped or hidden behind overlays. Use a contrast-safe alternative or a two-color treatment when the accent blends into a control's fill. Menu keyboard focus remains distinct through its active row and semantic state.
- **Disabled:** a genuinely unavailable control may dim, but it must not respond to activation. Explain the reason where useful. Readable status text and unselected tabs are not disabled controls and must retain sufficient contrast.
- **Working:** show local progress and cancellation where supported. Keep the status in the component that owns the work. Announce significant progress and completion accessibly without announcing every timer tick or streamed token.
- **Errors:** show a clear message with an applicable recovery action. Preserve drafts and selections on recoverable failures. Do not depend on red coloring or a transient toast to explain why an operation failed.
- **Dragging:** show the source, valid targets and the intended destination. Clear previews and highlights on drop, cancellation, blur or loss of the target. Respect reduced-motion preferences for rearrangement animations.

## 7. Accessibility

- Operable UI text, placeholders, tooltips and informative secondary text meet at least 4.5:1 contrast at normal sizes. Large text follows the applicable 3:1 threshold. Disabled-control exceptions apply only to genuinely inoperable controls, not unselected tabs or historical information. Measure the composited foreground/background pair in every relevant state. See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Essential control boundaries, state indicators and focus cues meet at least 3:1 against adjacent colors where required for identification. Decorative separators are not substitutes for an identifiable control. Color alone does not communicate success, error, availability or identity. See [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Use semantic controls, accessible names and associated labels. Icon-only actions expose their purpose. Errors and help text are associated with their inputs; a tooltip or placeholder is not the only label. Expose selected, expanded, checked, pressed and disabled states through the appropriate semantics.
- All operations are usable by keyboard with a predictable focus order. Tabs, lists, menus and completion use their established keyboard patterns; activation and dismissal cannot depend on middle-click, double-click, drag or a context menu alone.
- Modal dialogs receive appropriate initial focus, contain focus while open, make the background inert and return focus to the opener or a sensible surviving control when closed. Escape dismisses a dismissible overlay; forms with unsaved work use an explicit discard policy. Non-modal search and popovers do not accidentally trap focus. See the [modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Dialogs are the shell's own, drawn in the window. The one exception is a window whose page has stopped or no longer responds: the page cannot draw then, so the desktop asks with the operating system's message box, in the product's voice, with the safe choice as default.
- Pointer targets are at least 24 by 24 CSS pixels or meet a documented spacing/equivalent-control exception. A target sized in rem keeps this minimum when the root is small. Visual glyphs, hover pads and hit regions can differ, but hit regions must not overlap adjacent controls. A narrow resize sash needs adequate hit spacing or an equivalent adequately sized pointer control, plus keyboard operation. Do not restore large framework hit regions that obscure neighboring controls. See [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Tooltips open on focus as well as hover, can be dismissed without moving focus and stay available while the user moves the pointer over them. Place it 0.5rem above the visible anchor unless its component names another side, flip when needed and keep it within the overlay bounds of section 5. Reposition or dismiss it when the anchor scrolls, becomes clipped or is removed. Tooltips contain descriptions; use a popover or dialog for interactive content. See [hover/focus content](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html).
- Enlarged text, zoom, high-contrast/forced-color modes and reduced motion remain usable. Do not hide focus or selection cues when a custom theme or color preference changes. Provide text alternatives for images and meaningful status announcements without repeatedly stealing focus.

## 8. Component metrics and behavior

This table assigns geometry and radius tokens under sections 1, 3 and 7, with the default theme's values. A control that offers shapes names each one. Widths are preferred maxima unless marked as minimums.

| Component | Default geometry | Text role | Surface and behavior |
|---|---|---|---|
| Window row | 2.1875rem high | Panel; title 600 | Shell; window controls, the active document's breadcrumb and the top bar's actions, with no divider beneath |
| Status bar | 1.75rem high; 0.5rem side inset; items are 1.25rem high pills with 0.375rem side padding, 0.25rem apart; hover radius | Label | Shell; items on the left and right, with no divider above; an item with a command is a button with toolbar hover, meeting section 7's target size through its spacing; truncated text keeps its full text in the tooltip and accessible name |
| Module failures item | Status-bar item; 1rem error icon 0.25rem from its text | Label | Shown at the status bar's right end only while a module is failed or blocked; the error icon with text such as "1 module didn't start", never color alone; opens the module failures popover |
| Panel card | 1px border; large radius; 0.25rem gaps and outer side/bottom margin | Inherited | Shell for groups in a dock, panel for groups in the middle; meets the window row above |
| Dock sizing | Default 26rem left, 25rem right and 16.25rem bottom; preferred minimum 10rem on its resize axis; collapsed strip 2.75rem | Inherited | Preserve saved sizes; collapse when necessary to keep the document and controls reachable |
| Split | Groups at least 10rem wide and 6.25rem high; a 0.25rem sash between them | Inherited | Groups share the rest of the split by their saved proportions and shrink in proportion to their minimums when those cannot fit |
| Document area | Preferred minimum 13.75rem across and down | Inherited | Priority when allocating pane space; effective size must fit the usable window |
| Tab bar | 2rem minimum high; inset from the card's sides by its large radius, the first tab a further 0.125rem in | Panel | One per card; tabs scroll sideways under the thin scrollbar, a vertical wheel scrolls them across, and the selected tab is revealed clear of the actions; the panel actions stay pinned at the end, after the overflow list's button while tabs don't fit, with the dock's hide action on its top-right group |
| Tab | Shape `pill`: 2rem minimum high; up to 16rem wide; 1.5rem pill; 0.125rem side inset; 0.5rem label inset; 1.75rem action allowance; 1.5rem action slot; 1.25rem close pad; small radius | Panel | Selected/hover fill; selected text or opaque tab text; the icon never shrinks and a long label truncates, keeping its full title as its accessible name and in a tooltip below the tab shown only while truncated; accessible close target fits the action slot |
| Tree row | 1.625rem minimum high; 0.5rem text inset; 1rem icon; 0.5rem icon gap; small radius | Panel | Hover/selected surface; the label or twistie toggles children; child indentation 1.75rem |
| Section header | 1.75rem minimum high; text inset 1.5rem; separator inset 0.25rem | Label, 600 | No fill; optional separator above |
| Configuration table | Rows grow; 0.5rem cell padding | Panel; header 600 | Settings pages that list items share the pattern: title/Add above, explanation, semantic headers, separators and labelled actions; horizontal scroll only when necessary |
| Menu | Sized to its rows, up to the window's width less 1rem; large radius; 1px border; 0.25rem vertical padding; section-label padding 0.5rem 0.75rem 0.25rem | Panel; section labels muted | Menu surface and large shadow; opens below its trigger, aligned with its start or end, or at the pointer as a context menu, also from the menu key or Shift+F10; kept within the overlay bounds and scrolling under the thin scrollbar when bounded, never sideways. A submenu opens on hover or Right flush against its menu's edge, its first row level with its trigger row, and flips to the other side at the window's edge. Arrow keys, Home, End and type-ahead move between rows and Enter runs one; Left or Escape closes a submenu back to its row, and Escape, Tab or a click outside closes the menu, returning focus to its trigger. The overflow list starts with Close all and a separator, then each tab's icon and title, truncated with a tooltip, the current tab marked; it is at most 20 rows or 60% of the window high and no wider than a popover |
| Menu item | 1.625rem minimum high; fill inset 0.25rem from the menu's sides; 0.5rem text padding; 1rem icon; 0.5rem icon gap; medium radius; a submenu row ends with a 1rem chevron at least 1rem after its label; 1px separator with 0.3125rem spacing | Panel | Hover, keyboard-active and open-submenu rows fill; the current row uses the selected fill; labels don't wrap; disabled rows are dimmed, focusable and inoperable |
| Tooltip | Up to 43.75rem wide, viewport-clamped; 0.125rem vertical/0.5rem horizontal padding; hover radius; 0.5rem from its anchor | Label, tooltip line height | Hover-widget surface, 1px border and large shadow; shows at once on hover or keyboard focus and hides when the pointer leaves the anchor and the tooltip, on a press, Escape or blur; a truncation tooltip shows only while its text is cut short; placement and dismissal from sections 6 and 7 |
| Scrollbar | 0.375rem thick; round thumb; transparent track; no arrows | — | The thumb fades in only while the pointer is over its scroll area, without the fade when reduced motion is preferred, and darkens while dragged; revealing it never shifts content |
| Popover | Preferred width 27.5rem, viewport-clamped; large radius; 1px border; 0.75rem padding; 0.5rem gaps | Panel; title 600 | Menu surface, border and large shadow; anchored to its control and kept in the viewport; non-modal: focus moves into it, Escape or a click outside closes it, and Escape returns focus to the control. The module failures popover lists each module, its state and cause, then secondary buttons Copy details and Open log folder; a folder that cannot open is reported in a status line |
| Dialog | Preferred width 27.5rem; large radius; title padding 1.375rem 2rem 0.75rem 1.25rem; body 0 2rem 0 1.25rem; actions 1.25rem 0.5rem 0.5rem with 0.5rem gaps | Panel; title 600 | Dialog surface, 1px border, extra-large shadow and modal backdrop; content/actions reflow |
| Sash | 0.25rem visual gap; three 0.125rem grip dots spaced 0.3125rem | Accessible resize label | Grip at 30% normal foreground; accent after 300ms hover or during drag; keyboard resize exposes the affected pane and size |
| Quick input (search) | Preferred width 37.5rem; 0.375rem top margin; padding 0.375rem 0.375rem 0.25rem; hits 0.25rem below field; large radius | Panel | Quick-input surface, border and extra-large shadow; non-modal and viewport-clamped |
| Button | 1.625rem minimum high; 0.5rem side padding; small radius | Label | Primary, secondary or text-button tokens; no ripple/state layer; adequate hit region without overlapping controls |
| Text field | 1.625rem minimum high; preferred width 12.5rem; 0.375rem inner padding; small radius | Panel | Input tokens; labelled; focus border; wraps validation text outside the input |
| Select | 1.625rem minimum high; preferred width 20rem; small radius | Panel | Field styling; arrow in readable foreground; shrinks to its container |
| Dropdown list | 1.625rem minimum rows; 0.25rem inner padding; 0.5rem row side padding; small radius | Panel | Dropdown surface, 1px border and widget shadow; chosen/keyboard row uses active-list pair; no decorative check mark |
| Checkbox | 1.125rem visual square; 0.5rem label gap; hover radius | Panel label | Label participates in the hit target; border and check mark remain identifiable |
| Choice pills (toggle group) | 1.375rem minimum visual height; 0.5rem side padding; 0.25rem gaps; small radius | Panel, 600 | Selected or hover fill, no decorative border/check; separate semantic selected state |
| Settings item | Padding 0.75rem 0.875rem 1.125rem; description gap 0.1875rem; control gap 0.5625rem; medium radius | Panel; title 600 | Subtle hover surface; text and controls wrap |
| Settings heading | Automatic height; 0.625rem surrounding space, 0.9375rem start inset | Settings group heading, 600 | Heading foreground; grows with its proportional line height |
| Icon button | 1.375rem visual pad around a 1rem glyph; small radius | Accessible name | Toolbar hover; pointer hit region at least 24px unless a documented exception applies |
| Docking guide | 2.5rem square around a 1.5rem glyph; small radius; a group's center target and split arrows share a medium-radius plate with 0.125rem gaps, moved clear of the side guides | Accessible action name | Raised surface; shown while a view's tab is dragged; accent for the chosen target, whose landing area is previewed with the docking-preview fill, a 1px docking-preview border and the large radius |
| Progress | 2px bar; 1rem spinner; reveal after 300ms where delay avoids flicker | Accessible status | Progress token; empty track; completion/error remain understandable without animation |
| Word wrap | Icon-button geometry; 1rem wrap glyph | Accessible name | Initially off; precedes Copy or diff collapse; pressed state exposed; Enter/Space activate |
| Inline code | Text metrics; small radius | Code | Inline-code token |
| Preview tab | Tab geometry | Panel, italic | One temporary preview per strip; explicit keep action available |
| Tree row while dragged | Tree-row geometry; small radius | Panel | Shell-color ghost, border and large shadow; placeholder may dim; rearrangement animation up to 150ms and disabled for reduced motion |
| Card | Automatic height; medium radius; 1px border | Message | Raised surface |
| Module failure card | Card geometry with 0.75rem padding, 0.5rem from the panel's edges; 1rem error icon 0.5rem from the title | Message; title 600 | Raised surface; fills a failed module's view with "<Module> didn't start" and the cause in muted text |
| Code block | Automatic body height; 1.625rem minimum header; medium radius; 1px border | Code body; Panel/Label header | Separate header/body surfaces and divider; language, wrap and copy controls; horizontal scroll is local to the block |
| Badge (counts, +1 -0), key chip | 1.25rem visual height; small radius; 1px border | Panel | Count badges unfilled, key chips raised; diff counts use semantic text and signs; failures have an explicit status |

Copy feedback uses both the check glyph and the accessible Copied label.

## 9. The shared kit and modules

The shell's kit provides these typography, color, surface, spacing, interaction, accessibility and component contracts. Feature-specific components belong to modules.

- Modules build their components, such as calendars, from kit tokens, text roles, spacing and radii under sections 6 and 7. Their own documents define geometry and behavior.
- Modules neither restyle kit components nor redefine shared tokens. Additional colors use `--tr-<module id>-<name>`, a theme key and fallback, checked in every theme and mode. The architecture's [identity rules](ARCHITECTURE.md#3-vocabulary-and-identity) enforce complete-name uniqueness.
- Reused components remain module-owned and may be published to dependents. Adding one to the kit requires a reviewed change to section 8.
- A module's theme is data under section 2, shown in the Gallery and checked like the default theme. It requires no change to a module or a kit control; a look that needs a new shape adds that shape to the kit first, through a reviewed change to section 8.

## 10. Implementation and verification

- Shared stylesheet/theme tokens own colors and geometry; templates use shared layout and component classes. Layout classes may arrange elements and consume tokens, but do not add competing literal sizes, colors or radii. Framework overrides must preserve semantics, focus and hit testing as well as appearance.
- The Angular CDK provides overlays, menu behavior and accessible drag. No utility-CSS framework is used; the kit's tokens and classes cover layout.
- The window applies a theme by setting token values and shape names at its root; the kit's styles implement every shape, and nothing else varies by theme. A fixture theme whose values all differ from the default theme's verifies that every kit control takes its colors and geometry from the theme.
- Docks and documents share the panel-card and tab primitives. A new kit control extends the component table when its contract differs; update this owner through review instead of adding a private visual exception.
- Use the framework's supported theming APIs where available. Verify the actual cascade and theme scope rather than assuming a particular stylesheet order or increasing specificity without examining the conflict.
- The kit's Gallery, which the window shows as a Settings page in development builds only ([architecture](ARCHITECTURE.md#2-components-and-dependency-direction)), demonstrates each reusable control's meaningful states in every theme and both modes. Include keyboard focus, selection, disabled/working/error states, long text and overlay behavior. Gallery coverage does not replace checks in the real parent layouts.
- Verify default and minimum/maximum font preferences, that spacing and component geometry scale with the panel size while borders keep their pixel width, relevant font fallbacks, 100% and 200% zoom, the smallest supported window, reduced motion and forced colors. Check that active controls, focus and dialog actions remain reachable and that code/diff scrolling does not widen the page.
- Capture relevant regions under [TESTING.md](TESTING.md#ui-screenshots-and-reports), recording theme, mode, fonts, zoom, viewport, platform and revision. External references include reproducible versions/settings, without requiring another person's installed editor.
- Use DOM/computed-style and contrast measurements for numerical claims, which the [desktop UI workflows](TESTING.md#desktop-ui-automation) assert on every target, plus keyboard and assistive-technology checks for interaction claims. Screenshots alone do not prove geometry, contrast or accessibility. Check composited colors in each state and test popup anchoring during scroll, resize and removal.
- [TESTING.md](TESTING.md) owns automation, target coverage, screenshots, reporting and cleanup for component and real-layout checks.
