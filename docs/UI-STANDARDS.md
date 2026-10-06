# TeamRun UI standards

**Scope:** Appearance, shared controls, interaction and accessibility for the shell and modules.
The [coding standards](CODING-STANDARDS.md) own implementation and security.

TeamRun uses a compact IDE-style shell with no separate activity bar.
Its appearance comes from a theme (section 2); the default theme uses panel cards, pill tabs and restrained surfaces.
Reference applications do not automatically change these rules.

Sections 1 and 8 own typography/units and component metrics.
Dimensions yield to text fitting, responsive layout and accessibility.

## 1. Typography

Use Noldova Sans for interface and prose, and Noldova Mono for code, with system fallbacks.
Appearance offers independent interface and code font choices; selecting System changes only that font stack.
Font assets and their licenses must be reviewed before distribution.

Panel, message and code sizes are independently adjustable from 12 to 18 CSS pixels.
Labels, titles and headings derive from them.
All roles use shared tokens; components define no text sizes.

Use rem for dimensions.
The root size in CSS pixels is `16 × panelSize / 13`, preserving the default 13px panel text and 16px root.
Interface text, icons, spacing, radii, shadows and geometry scale together.
Message and code sizes remain independently chosen pixel sizes.

Keep pixels for thin borders, dividers, outlines and progress bars; fixed minimums such as pointer targets; and the three chosen font sizes.
Use percentages, flex or grid for dimensions tied to available space.

| Role | Token or derivation | Default size | Line-height rule |
|---|---|---|---|
| Panel | `--tr-text-panel` | 0.8125rem | At least 1.125rem and at least the font size plus 0.3125rem |
| Message | `--tr-text-message` | 14px, as chosen | 1.6 for prose |
| Code | `--tr-text-code` | 14px, as chosen | At least 1.5; preserve code alignment |
| Label | Derived from panel size: the larger of 12px and panel size minus 0.0625rem | 0.75rem | At least the font size plus 0.25rem; tooltips use at least the font size plus 0.4375rem |
| Title | Derived from panel size: panel size plus 0.125rem | 0.9375rem | At least the font size plus 0.3125rem |
| Settings group heading | Twice the panel size | 1.625rem | At least 1.25 times the font size |

Panel text applies to navigation, menus, fields, options and dialog text.
Label text applies to section headers, button labels, tooltips and secondary details.
Title text names the item a panel shows, such as the selected module in its details.
Prose a person reads or writes uses the message role; code blocks and diffs use the code role.
Inline code takes the code font at the size and line height of the text around it.

Use weight 400 for ordinary text and 600 for document titles, section headers, setting/dialog titles and choice pills.
Row/tab selection does not change weight; choice pills retain 600 in both states.

Rows, controls, headings and overlays grow with fonts, zoom, translations and validation text; never clip glyphs or labels vertically.
Specified horizontal truncation retains the full accessible name or tooltip.

Use Material Symbols Rounded for interface icons.
A mark that must sit centred in a drawn frame, such as the checkbox's tick, is an inline vector shape instead, because a glyph is centred by its font box, not by what it draws.
Glyph sizes and control geometry are separate: a small icon still needs a usable pointer target.

## 2. Themes and color

A theme gives TeamRun its appearance.
The person chooses a theme and, separately, a mode: the operating system's, light or dark, offered as System, Light and Dark in that order, since System is the default.

A theme consists of:

- **Colors:** for each mode, values for the theme keys in the table below.
  A token whose key the theme leaves out uses its fallback, then the default theme's value.
- **A look:** values for the geometry tokens (radii, borders, spacing, shadows and section 8's component dimensions) and, for each kit control that offers shapes, the shape it uses.

A shape is a named form of a kit control, such as the tab's `pill`.
The kit implements every shape; a theme only chooses among them.

A theme is data: it contains no styles, selectors or code and changes nothing else.
Fonts and text sizes stay the person's choice, and this document's layout, interaction and accessibility rules hold in every theme and mode.

The shell's default theme defines the values in this document: the colors below and the look of sections 3, 4 and 8.
Another theme provides its colors for both modes and the parts of the look it changes; the rest comes from the default theme.
Modules contribute themes under the [architecture](ARCHITECTURE.md#5-contributions).

Every color uses a theme token.
The default theme's light and dark colors start from the table below; provide complete initial tokens before painting themed content.
The default theme's greys for surfaces, borders, hover, selection and the focused list's selection carry no tint, so a selected item sits in the same grey family as the window around it.
Section 9 governs module tokens.

The application shows one icon in light and dark mode, whatever the theme or the operating system's appearance.
On Windows and Linux it is the outlined icon, a white shape with a dark outline that stays readable on both backgrounds, on the window, the taskbar and the program file. macOS shows the Dock icon.

The table specifies normal-state colors.
Check actual composited foreground/background pairs in hover, selection and overlay states under section 7; correct the mapping or use a verified fallback when needed.
Decorative borders may remain subtle; boundaries needed to identify controls must meet non-text contrast requirements.

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
| `--tr-card-border` | `surface.border`, fallback `widget.border` | #E5E5E5 | #252525 | Decorative panel border |
| `--tr-border` | `sideBarSectionHeader.border` | #E5E5E5 | #2B2B2B | Dock strip separators and other functional borders |
| `--tr-accent` | `focusBorder`, contrast-adjusted | #005FB8 | #4DAAFC | Focus and active resize indicators |
| `--tr-sash-active` | `sash.hoverBorder`, fallback `focusBorder` | #005FB8 | #4DAAFC | Bar of a sash in use |
| `--tr-link` | `textLink.foreground` | #005FB8 | #4DAAFC | Links |
| `--tr-hover` | `list.hoverBackground` | #F2F2F2 | #2C2C2C | Row, tab and menu-item hover |
| `--tr-selected` | `list.inactiveSelectionBackground`, fallback `list.activeSelectionBackground` | #E6E6E6 | #383838 | Selected rows, tabs and choice pills |
| `--tr-toolbar-hover` | `toolbar.hoverBackground` | #B8B8B850 | #5C5C5C50 | Icon-button and toolbar-button hover |
| `--tr-scrollbar` | `scrollbarSlider.background` | #64646466 | #79797966 | Scrollbar thumb; adjust when needed for visibility |
| `--tr-scrollbar-active` | `scrollbarSlider.hoverBackground`, fallback `scrollbarSlider.background` | #646464B3 | #646464B3 | Scrollbar thumb while dragged |
| `--tr-title-bar`, `--tr-title-bar-text` | `titleBar.activeBackground`, `titleBar.activeForeground` | #F8F8F8, #1E1E1E | #181818, #CCCCCC | Native title-bar integration |
| `--tr-input`, `--tr-input-border`, `--tr-input-text`, `--tr-placeholder` | `input.*`, with contrast-checked border fallback | #FFFFFF, #858585, #3B3B3B, #767676 | #313131, #858585, #CCCCCC, #9A9A9A | Fields and selects; placeholders are not substitutes for labels |
| `--tr-button`, `--tr-button-text`, `--tr-button-hover` | `button.*` | #005FB8, #FFFFFF, #0258A8 | #0078D4, #FFFFFF, #026EC1 | Primary button and the chosen docking guide |
| `--tr-button-secondary`, `--tr-button-secondary-text`, `--tr-button-secondary-hover` | `button.secondary*` | #E5E5E5, #3B3B3B, #CCCCCC | transparent, #CCCCCC, #2B2B2B | Secondary button |
| `--tr-dropdown`, `--tr-dropdown-border`, `--tr-dropdown-list` | `dropdown.*`, fallback `input.*` | #FFFFFF, #858585, #FFFFFF | #313131, #858585, #1F1F1F | Select and options list |
| `--tr-list-active`, `--tr-list-active-text` | `list.activeSelection*` | #D4D4D4, #000000 | #4A4A4A, #FFFFFF | Chosen or keyboard-active option |
| `--tr-list-highlight` | `list.highlightForeground` | #0066BF | #2AAAFF | Search matches, underlined or at weight 600 so color is not their only cue |
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
| `--tr-docking-preview`, `--tr-docking-preview-border` | `teamrun.dockingPreviewBackground`, fallback `list.inactiveSelectionBackground`; `teamrun.dockingPreviewBorder`, fallback `focusBorder` | #E6E6E6, #005FB8 | #383838, #4DAAFC | The area a dragged tab will occupy |
| `--tr-notification`, `--tr-notification-border` | `notifications.*` | #FFFFFF, #E5E5E5 | #1F1F1F, #454545 | Notification surface |
| `--tr-error`, `--tr-removed` | Semantic error/removal foregrounds | #A1260D | #F48771 | Errors and removed lines/counts, with text or symbols identifying their meaning |
| `--tr-added` | Semantic addition foreground | #3F6212 | #B5CEA8 | Added lines/counts and copy-success icon |
| `--tr-added-background`, `--tr-removed-background` | Respective semantic foreground mixed over the local surface | 12% foreground | 12% foreground | Diff backgrounds; normal code text remains readable |

Muted text inside a selected surface takes the surface's normal text color, and the kit's `selected-surface` mixin sets the fill and that color together, so every selected state uses it.
Use another validated token when muted text loses contrast on any other surface.
Sections 6 and 7 distinguish readable secondary text from disabled controls.

Use one interaction accent per theme; errors and additions/removals have separate semantic colors.
Section 7 governs contrast and non-color cues in every theme and mode.

Shadows are shared tokens: `--tr-shadow-large` is 0 0 0.75rem at 14% black; `--tr-shadow-xlarge` is 0 0 1.25rem at 15% black; `--tr-widget-shadow` supplies select lists.
Menus, tooltips, dialogs, search overlays and drag ghosts may use their assigned shadow.
Ordinary panel and content cards do not.
A modal backdrop uses `--tr-backdrop` at 50% black; a non-modal search overlay does not dim the window.

Nested previews, including the Gallery, resolve base and derived colors within their own scope: an element that paints a theme takes the class `tr-theme-scope`, which declares the derived tokens again so they follow its own text and semantic colors.
Framework tokens use the same sources; changing libraries requires a separate decision.

## 3. Panels and surfaces

Each tab group uses a panel card with a tab bar and active content.
Groups in a dock use the shell surface; groups in the middle use the panel surface.
Collapsed docks, and side docks shown as icons, show a strip of view icons.
Section 8 owns card geometry.

Do not add dividers below the native window row or every tab bar, or between every container.
Functional borders, table separators and code-header dividers remain allowed.

Panel cards may clip content to their corners; overlays, focus indicators and drag guides must remain visible and controls accessible.

Radius tokens: `hover` = 0.1875rem, `small` = 0.25rem, `medium` = 0.375rem, `large` = 0.5rem; `round` is only for circles and avatars.
Section 8 alone assigns component radii.

## 4. Tabs and navigation

- Show a tab bar for every panel, including a panel with one view, except the groups of a side shown as icons, which have no tab bar.
  The document strip scrolls horizontally when necessary, keeps the active tab visible and offers an overflow list.
  Dock actions remain reachable at the end of their strip.
- The settings **Left dock** and **Right dock** show that side's views as tabs, the default, or as icons.
  They are shared across devices, and Reset the layout keeps them; the bottom dock always uses tabs.
  A side shown as icons keeps a strip of its views on the window's outer edge, open or collapsed, in group order with a separator between groups.
  Clicking a view's icon opens the dock at that view; clicking the icon of the view the open dock shows collapses it.
  Each icon shows its view's title as a tooltip and is pressed while its view shows.
  A view's badge sits on its icon's top-end corner, or after its tab's title when the side shows tabs.
  An icon drags like its tab and opens its tab's menu from a right click, Shift+F10 or the context-menu key, so the keyboard moves, splits and closes a view there.
  A view dropped on a strip lands before or after the icon under the pointer, along the strip, marked by the drop line (section 8); between two groups it joins the end of the group above.
  Every group there, whatever its number of views, shows a header instead of a tab bar: the active view's title and the group's actions.
  Its views are switched, moved and split only through the strip.
- A tab shows selection and hover through its shape; the `pill` shape uses a fill.
  Selected labels use ordinary text; unselected labels use the opaque tab-text token.
  Hover must not erase the selection or keyboard-focus cue.
  A tab whose content is working can replace the close glyph with a spinner, but hovering or focusing the tab reveals its close action.
- Middle-click uses the targeted tab's close action without activating a background tab or starting autoscroll.
  Closing the active tab focuses a surviving tab/panel; section 7 requires keyboard access.
- The window row runs across the top and the status bar along the bottom.
  Between them, the window has four regions: the left, right and bottom docks and the middle.
  The bottom dock spans the window under the side docks, or sits under the middle between them; where a view is docked chooses which.
  Each region holds one or more tab groups, side by side or stacked.
  Every view can be placed in any region, including beside the documents or as a tab among them; documents, Settings among them, live in the middle only.
  The middle holds one or more document groups, side by side or stacked in any arrangement, each with its own tab bar, active document and preview tab.
  Opening a document puts it in the active document group, the one last used, and a document that is already open is activated where it is.
  Documents are never docked into a side, so no side guides appear for them.
- Dragging a view's tab shows docking guides over the content of the tab group under the pointer: the center target adds the tab to that group, and four arrows split the group, placing the tab to its left, right, top or bottom.
  A guide for each side docks the tab along the left, right or bottom side, centered in the area the tab would take there; with the bottom dock across the window, a side's area ends above it.
  The bottom side has two guides: the outer one, centered at the window's bottom edge, docks the tab along the whole bottom, and the inner one docks it under the middle between the side docks.
  The inner guide moves up to clear the outer one, and a group's plate moves clear of both.
  Hovering a target previews the area the tab will occupy; dropping away from every target changes nothing.
  Over a group's tab bar, its actions included, or its header there are no guides and no preview: the drop line (section 8) shows where the tab will go, before the tab under the pointer or after it, by which half of that tab the pointer is over in the row's reading direction, or after the last tab anywhere else on the bar, and dropping places the tab there, reordering its own group or moving it into another.
  The line after the last tab marks the start of the actions on a header, or when the tabs overflow, so it stays in view.
  Dragging a document's tab shows the same guides over a document group but none for the sides: the center target moves the tab into that group and the four arrows split the group, and views keep their own guides.
  The dragged representation may dim; its name remains available in the accessible interaction.
  Provide keyboard/menu alternatives for moving, splitting and docking views, for keeping a preview tab, for reordering documents, for splitting a document to the right or down and moving it to the next or previous group, and for focusing the next or previous group; the tab menu, the View menu and command search hold them.
- Splits resize with a handle between groups.
  A group closes when its last tab leaves, and its space returns to its neighbors; the last document group stays, empty, when it has no documents.
  The layout, including splits and their sizes, is restored after a restart.
  **Reset the layout**, in the main menu's View menu and in command search, returns to the default, with the bottom dock across the window and a single document group holding every open document.
  The commands **Bottom dock across the window** and **Bottom dock between the side docks** are the keyboard alternative to the two bottom guides.
- With no modules, the docks are hidden and the middle shows a quiet card with the product name and "No modules".
- Each strip has one italic preview tab, replaced by the next preview.
  A keep action or double-click retains it; modules may define additional keep actions.
  The setting **Preview tabs**, in Appearance's Layout group, is shared across devices and on by default; off, every document opens as an ordinary tab, including a module's request for a preview, and turning it off keeps any open preview as an ordinary tab, while turning it on changes only later opens.
  Section 7 requires keyboard equivalents.

## 5. Spacing and responsive layout

Use spacing tokens of 0.25, 0.5, 0.75, 1 and 1.5rem with section 8's component measurements.

A hover or selected fill around a label in a bar or a group of pills, such as a tab, a toolbar button, a menu-bar item, a status bar item or a choice pill, leaves the pill padding of 0.375rem between its contents and the fill on each side, so fills side by side match.
An icon-only button is a square with no side padding.
The rows of a menu, list, tree or dropdown fill their column and keep 0.5rem.

- Overlays fit within the window 0.5rem inside its edges, below the window row and above the status bar; an overlay anchored in the window row or the status bar may come within 0.5rem of that edge instead.
  Reduce preferred widths as needed; bound height and scroll content while keeping essential actions reachable.
  A popup anchored to a control (a menu, popover, select list, tooltip or the command search) closes when that control scrolls away, is removed or stops rendering.
- Fields/selects shrink to their container; settings rows and dialog actions wrap or stack.
  Errors wrap within their owner.
  Truncated labels retain their full accessible name.
- Prose wraps; code and genuinely two-dimensional tables/diffs may scroll horizontally within their own region.
  A long string must not widen the document card or the entire window.
- Prefer enough room for the document before the docks.
  As the window narrows:
  1. The middle shrinks to 30rem, or to the narrower width the person left by dragging a side dock's sash.
  2. The side docks shrink to their minimum, the right first.
  3. The side docks collapse to their strips, the right first.
     A dock collapsed this way is closed by the layout, not by the user.
  4. On the vertical axis, the bottom dock shrinks and then collapses against the document's own minimum height, with no preferred height and no reopen margin.
- As the window widens, only docks the layout closed reopen, the left first.
  Each reopens once the middle would keep its width from step 1 plus a 2rem margin, so a window resized around the point doesn't open and close a dock repeatedly.
- Choosing a view from the strip of a dock the layout closed, or showing that dock from the View menu or its key, opens that dock.
  The other side dock collapses instead, and the middle may go down to the document's own minimum.
  The dock stays open while the window resizes, until the window is wide enough that the dock would stay open by the reopen rule anyway, or the user hides it; then the docks follow the narrowing order again.
  The View menu shows a dock the layout closed as hidden.
- When the layout closes a dock that holds the focus, the focus moves to that dock's strip, on its active view.
- Dragging a side dock's sash may take the middle down to the document's own minimum.
  A middle the drag leaves under 30rem becomes the width the docks give way to, kept with the layout, until a drag leaves the middle at 30rem or more again.
  A drag moves only its own dock's edge: an open side dock on the other side that shows narrower than its saved size keeps the width it shows.
- Preserve the user's saved dock and split sizes so they return when space becomes available.
  Groups in a split keep a minimum size and share the rest of their region in proportion.
  If preferred minima cannot fit, collapse docks into reachable controls rather than overflowing the window or producing negative pane sizes.
  Nothing scrolls sideways; below the window's minimum size the middle may go under its own minimum.
- Resize within available window bounds.
  Navigation, hidden-dock controls and dialog actions stay reachable at the smallest supported window, 40rem × 30rem at the default text size, and at enlarged zoom; drafts, selections and reading position survive layout changes.
- Native window controls and application overlay controls occupy separate usable regions.
  An overlay's own controls must never be covered by the operating system's close/minimize controls.

## 6. Interaction states

- **Hover:** use the appropriate row, toolbar or button hover token.
  A checkbox or field does not need an extra hover fill.
  Hover-only actions also appear on keyboard focus and remain usable while the pointer moves to them.
- **Pointer:** buttons, links, tabs, selectable rows and menu items use a hand cursor; editable text uses the text cursor, resize handles use their resize cursor, and disabled controls use the default cursor.
- **Selection:** rows, tabs and choice pills use the selected surface; keyboard-active options use the active-list pair.
  A checked checkbox shows its mark.
  Section 7 governs semantics and non-color cues.
- **Focus:** editable fields use the accent border; an invalid field keeps its error border while focused.
  Other controls have a visible keyboard-focus outline that survives hover and selection and is not clipped or hidden behind overlays.
  Use a contrast-safe alternative or a two-color treatment when the accent blends into a control's fill.
  Menu keyboard focus remains distinct through its active row and semantic state.
- **Disabled:** a genuinely unavailable control may dim, but it must not respond to activation.
  Explain the reason where useful.
  Readable status text and unselected tabs are not disabled controls and must retain sufficient contrast.
- **Working:** show local progress and cancellation where supported.
  Keep the status in the component that owns the work.
  Announce significant progress and completion accessibly without announcing every timer tick or streamed token.
- **Errors:** show a clear message with an applicable recovery action.
  Preserve drafts and selections on recoverable failures: a field keeps an entry it rejects as typed, also after focus leaves it, marked invalid with its error associated, and stores nothing until the person corrects it; Escape in the field puts the stored value back.
  Do not depend on red coloring or a transient toast to explain why an operation failed.
- **Dragging:** show the source, valid targets and the intended destination.
  Clear previews, insertion lines and highlights on drop, cancellation, blur, loss of the target, or when the pointer leaves the window.
  Respect reduced-motion preferences for rearrangement animations.

## 7. Accessibility

- Operable UI text, placeholders, tooltips and informative secondary text meet at least 4.5:1 contrast at normal sizes.
  Large text follows the applicable 3:1 threshold.
  Disabled-control exceptions apply only to genuinely inoperable controls, not unselected tabs or historical information.
  Measure the composited foreground/background pair in every relevant state.
  See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Essential control boundaries, state indicators and focus cues meet at least 3:1 against adjacent colors where required for identification.
  Decorative separators are not substitutes for an identifiable control.
  Color alone does not communicate success, error, availability or identity.
  See [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Use semantic controls, accessible names and associated labels.
  Icon-only actions expose their purpose.
  Errors and help text are associated with their inputs; a tooltip or placeholder is not the only label.
  Expose selected, expanded, checked, pressed and disabled states through the appropriate semantics.
- The shell's default keys follow common desktop conventions; menus show them:

  | Command | Windows and Linux | macOS |
  |---|---|---|
  | Show all commands | Ctrl+Shift+P | ⇧⌘P |
  | Open Settings | Ctrl+, | ⌘, |
  | Close the tab | Ctrl+W | ⌘W |
  | Show the next tab | Ctrl+Tab, Ctrl+PageDown | ⌃⇥, ⌥⌘→ |
  | Show the previous tab | Ctrl+Shift+Tab, Ctrl+PageUp | ⌃⇧⇥, ⌥⌘← |
  | Show or hide the left dock | Ctrl+B | ⌘B |
  | Show or hide the bottom dock | Ctrl+J | ⌘J |
  | Show or hide the right dock | Ctrl+Alt+B | ⌥⌘B |

  The next and previous tab move through the current group's tabs and wrap at either end.
  Other shell commands have no default key.
- All operations are usable by keyboard with a predictable focus order.
  Tabs, lists, menus and completion use their established keyboard patterns; activation and dismissal cannot depend on middle-click, double-click, drag or a context menu alone.
- Toolbars and icon strips follow the [toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/).
  Each strip is one tab stop that returns to the item last focused, or the first.
  The arrow keys along its axis move between items, past separators and onto disabled items, which stay focusable and mark themselves disabled.
  Home and End go to the first and last item, and a strip wraps at its ends only where its component says so.
  Enter, Space and the other axis's arrows stay with the item, so a dropdown opens with Down.
- A menu bar follows the [menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
  It is one tab stop; Left and Right move between its menus, Down, Enter and Space open one, and while one is open, Left and Right inside it, or the pointer entering another item, open the neighboring menu.
  On Windows and Linux, while no modal dialog is open, F10 or Alt pressed and released alone focuses the menu bar, or the Menu icon button when the menus are one, and Escape, once no menu is open, returns the focus to where it was.
- Modal dialogs receive appropriate initial focus, contain focus while open, make the rest of the window inert, so it takes no focus and is hidden from assistive technology, while toasts are still announced, and return focus to the opener or a sensible surviving control when closed.
  Escape dismisses a dismissible overlay; forms with unsaved work use an explicit discard policy.
  Non-modal search and popovers do not accidentally trap focus.
  See the [modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Dialogs are the shell's own, drawn in the window.
  The exceptions are a window whose page has stopped or no longer responds, because the page cannot draw then, and a desktop whose main process has failed, because the window's dialogs run through it: the desktop asks with the operating system's message box, in the product's voice, with the safe choice as default.
- Pointer targets are at least 24 by 24 CSS pixels or meet a documented spacing/equivalent-control exception.
  A target sized in rem keeps this minimum when the root is small.
  Visual glyphs, hover pads and hit regions can differ, but hit regions must not overlap adjacent controls.
  A narrow resize sash needs adequate hit spacing or an equivalent adequately sized pointer control, plus keyboard operation.
  Do not restore large framework hit regions that obscure neighboring controls.
  See [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Tooltips open on focus as well as hover, can be dismissed without moving focus and stay available while the user moves the pointer over them.
  Place it 0.5rem above the visible anchor unless its component names another side, flip when needed and keep it within the overlay bounds of section 5.
  Reposition or dismiss it when the anchor scrolls or becomes clipped.
  Tooltips contain descriptions; use a popover or dialog for interactive content.
  See [hover/focus content](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html).
- Enlarged text, zoom, high-contrast/forced-color modes and reduced motion remain usable.
  Do not hide focus or selection cues when a custom theme or color preference changes.
  Provide text alternatives for images and meaningful status announcements without repeatedly stealing focus.

## 8. Component metrics and behavior

This table assigns geometry and radius tokens under sections 1, 3 and 7, with the default theme's values.
A control that offers shapes names each one.
Widths are preferred maxima unless marked as minimums.

| Component | Default geometry | Text role | Surface and behavior |
|---|---|---|---|
| Window row | As high as its tallest control, an icon button or the 24px pointer target, with 0.25rem above and below: 2rem at the default panel size | Panel; title 600 | Shell; window controls, the active document's breadcrumb and the top bar's actions, ending with the shell's **Search commands**, with no divider beneath; the actions are icon buttons outside the drag region, named and labelled by their titles. On Windows and Linux the row starts with the menus, as the shared setting **Menus** (`shell.menuBar`) chooses: a menu bar of the main menu's menus, the default; a Menu icon button, outside the drag region, whose menu lists them as submenus; or nothing, which leaves no menus in the row. A menu bar the row cannot fit, leaving 6rem for the drag region after the actions, folds into the Menu icon button until the row can hold it; folding has no setting. The top bar actions that ask for the start of the row follow the menus there, before the drag region |
| Status bar | 1.5rem high; 0.5rem side inset; items are 1.25rem high pills 0.25rem below the panels above and 0.25rem above the window's edge, with the pill padding on each side, 0.25rem apart; hover radius | Label | Shell; items on the left and right, with no divider above; an item with a command is a button with toolbar hover, meeting section 7's target size through its spacing; truncated text keeps its full text in the tooltip and accessible name |
| Module failures item | Status-bar item; 1rem error icon 0.25rem from its text | Label | Shown at the status bar's right end only while a module is failed or blocked; the error icon with text such as "1 module didn't start", never color alone; opens the Modules document with the first such module selected |
| Notifications item | Status-bar item; 1rem bell 0.25rem from its count | Label | Always shown at the status bar's right end, before the module failures item; the bell, or the silenced bell while Do not disturb is on, with the unread count of modules not turned off when there is one and "9+" above nine; its accessible name gives the count and Do not disturb; opens the notifications popover, which marks everything read |
| Panel card | 1px border; large radius; 0.25rem gaps and outer side/bottom margin | Inherited | Shell for groups in a dock, panel for groups in the middle; meets the window row above |
| Dock sizing | Default 26rem left, 25rem right and 16.25rem bottom; preferred minimum 10rem on its resize axis; collapsed strip, or the strip of a side shown as icons, 2.75rem; a dock the layout closed reopens 2rem past the point it closed at | Inherited | Preserve saved sizes; shrink to the minimum and then collapse, right before left, to keep the middle at 30rem or the narrower middle the person dragged to (section 5); a sash stops where the middle would go under the document's own minimum; a bottom dock across the window never takes a side dock below its minimum height |
| Split | Groups at least 10rem wide and 6.25rem high; a 0.25rem sash between them | Inherited | Groups share the rest of the split by their saved proportions and shrink in proportion to their minimums when those cannot fit |
| Document area | Preferred minimum 13.75rem across and down; the middle keeps 30rem across, or the narrower width the person dragged it to, before the side docks keep their sizes | Inherited | Priority when allocating pane space; effective size must fit the usable window |
| Page padding | At the sides of every page, three tab insets and the pill padding, 0.75rem, so its content box starts where its group's first tab icon does in every theme; at the top and bottom, by where the page shows rather than what it is, 1rem in the middle or a dialog and 0.5rem in a dock | Inherited | The shell pads every page by default, inside its scrolling area so the end of the content keeps the bottom padding; a page's text and controls start at that padding, on the tab icon's edge, and a page that turns it off, such as a terminal or Settings, keeps its own edges and its own scrollbar, with no gutter reserved around it, so its scroller reaches the panel's edge ([ARCHITECTURE.md](ARCHITECTURE.md#content-padding)) |
| Tab bar | 2rem minimum high; inset 0.125rem from the card's start and end, the first tab and the last action each a further 0.125rem in, so each stands 0.25rem from its edge in either writing direction; a header's title starts where a tab's icon starts | Panel | One per card; tabs scroll sideways under the thin scrollbar, a vertical wheel scrolls them across, and the selected tab is revealed clear of the actions; the panel actions stay pinned at the end, after the overflow list's button while tabs don't fit, with the dock's hide action on its top-right group |
| Tab | Shape `pill`: 2rem minimum high; up to 16rem wide; 1.5rem pill; 0.125rem side inset; the pill padding on both sides of the pill; 1.5rem action slot reaching 0.25rem into the end padding, so the close glyph stands the pill padding from the end as the icon does from the start; 1.25rem close pad; small radius | Panel | Selected/hover fill; selected text or opaque tab text; the icon never shrinks and a long label truncates, keeping its full title as its accessible name and in a tooltip below the tab shown only while truncated; accessible close target fits the action slot |
| Drop line | Twice the border width thick and 1.5rem long, the height of a button or a tab's pill, centred on the item and on its edge: across a row between tabs, toolbars and the icons of a horizontal strip, across a column between the icons of a vertical strip, at the item's inline start before it and its inline end after it in either writing direction. A new toolbar row's line is as wide as the row, in the middle of the gap between rows | None | Accent; one kit style, `tr-drop-line`, draws it for tabs, dock strips, toolbars and tree rows (as wide as the row, from its text inset), shown while a dragged item would land there and ignoring the pointer |
| Tree row | 1.625rem minimum high; 0.5rem text inset; 1rem icon; 0.5rem icon gap; small radius; rows 0.25rem apart; child indentation 1.75rem | Panel | The kit's tree, a named tree of rows that wrap long labels. Hover surface, and the selected fill on the current row, which is marked selected; a twistie, rotated while open, only when the tree has branches; the label or twistie toggles a branch's children and chooses the row. One Tab stop, which returns to the row last focused, or lands on the current row, or on the first row when none is current or focused; Up and Down move, Right opens a branch or enters it, Left closes it or goes to its parent, Home and End jump, typing finds a row by its label, Enter or Space chooses. A movable tree (the owner applies the move it reports) moves rows by pointer or keyboard through one path: a drag starts once the pointer is 4px from where it went down, the kit's one drag threshold; the row under the pointer takes a drop line before or after it, drawn in the middle of the gap between rows, or the accent outline to drop into a branch (the middle half of a branch's row); the bottom of an open branch's row takes the line above its first child, at the child's indent, where the row lands; a row can't go onto itself or its own descendants, which show neither line nor outline, and releasing there changes nothing; a closed branch the pointer rests on opens after 0.5s, and a tree in a scrolling area scrolls it while the pointer is within a row's height of its top or bottom; Escape, lost window focus, a cancelled pointer or release outside the rows ends the drag; the click that ends a drag chooses nothing. Alt with Up or Down moves the focused row among its siblings, Alt with Right moves it into the branch before it as that branch's last child, opening that branch if it is closed, and Alt with Left moves it out to just after its parent (Right and Left swap in a right-to-left layout); a move that can't happen does nothing and is not announced, and other modifiers leave the key to the tree and the shell. A row dropped into a closed branch opens it too. The focus stays on the moved row, by keyboard or pointer, and the move is announced politely as "Moved Notes to position 2 of 3" or "Moved Notes into Project, position 3 of 3" |
| Section header | 1.75rem high for one line: the label's line with equal space above and below it, the same however many lines the label wraps to; text inset 0.5rem (the space-2 step), where a tree row's icon starts; 0.75rem (the space-3 step) above every header that is not the first element in its container | Label, 600 | No fill and no line. Groups are separated by space, never by lines: the space above a header is more than twice the space below it, so the label belongs to its own rows. A list keeps its headers and their rows as siblings in one container, and removes rather than hides an element before its first header. A heading of level 3 unless the owner gives another; a long label wraps |
| Configuration table | Rows grow, their cells lined up on their first line's baseline, so text sits level with the labels of the row's buttons; 0.5rem cell padding, except on the outer side of each row's first and last cells, so the text and the actions sit on the ends of the lines; the heading's row, the explanation and the table 0.75rem apart; the free-text column at least a text field wide, 12.5rem | Panel; heading and column headers 600 | The kit's configuration table, which every Settings page that lists items uses: an optional heading, which names the table, with actions such as Add at the end of its row, then an explanation, or, without a heading, the explanation at the start of the actions' row, level with their labels, with the actions wrapping under it before it gets narrower than a text field; then the owner's table with semantic column headers, a line under the header and every row, and actions named for their row, such as Remove EDITOR. Every column keeps to one line except the free-text column the owner marks, which takes the rest of the width and wraps. It scrolls sideways only when the table can shrink no further, with room left for a focus outline at its edges |
| Menu | Sized to its rows, up to the window's width less 1rem; large radius; 1px border; 0.25rem vertical padding; section-label padding 0.5rem 0.75rem 0.25rem | Panel; section labels muted | Menu surface and large shadow; opens below its trigger, aligned with its start or end, or at the pointer as a context menu, also from the menu key or Shift+F10; kept within the overlay bounds and scrolling under the thin scrollbar when bounded, never sideways. A menu that opens under a resting pointer ignores it until the pointer moves, so it neither highlights a row nor opens a submenu by itself. A submenu opens on hover or Right flush against its menu's edge, its first row level with its trigger row, and flips to the other side at the window's edge. Arrow keys, Home, End and type-ahead move between rows and Enter runs one; Left or Escape closes a submenu back to its row, and Escape, Tab or a click outside closes the menu, returning focus to its trigger. The overflow list starts with Close all and a separator, then each tab's icon and title, truncated with a tooltip, the current tab marked; it is at most 20 rows or 60% of the window high and no wider than a popover |
| Menu item | 1.625rem minimum high; fill inset 0.25rem from the menu's sides; 0.5rem text padding; 1rem icon; 0.5rem icon gap; a row without an icon keeps the icon's space, so every label lines up; medium radius; a submenu row ends with a 1rem chevron in the trailing column; 1px separator with 0.3125rem spacing | Panel | Hover, keyboard-active and open-submenu rows fill; the current row uses the selected fill; one of a set of choices is a radio row and an on/off setting a checkbox row, each ending with a 1rem check mark while checked; labels don't wrap; a row that runs a command with a key shows the key's label, muted, in the menu's trailing column, which every row's key, check mark and chevron share, right-aligned and at least 2rem after the widest label, in every menu; disabled rows are dimmed, focusable and inoperable |
| Tooltip | Up to 43.75rem wide, viewport-clamped; 0.125rem vertical/0.5rem horizontal padding; hover radius; 0.5rem from its anchor | Label, tooltip line height | Hover-widget surface, 1px border and large shadow; shows at once on hover or keyboard focus and hides when the pointer leaves the anchor and the tooltip, on a press, Escape or blur; a truncation tooltip shows only while its text is cut short; placement and dismissal from sections 6 and 7 |
| Scrollbar | 0.375rem thick; round thumb; transparent track; no arrows | — | Every scrolling area, with no class to opt in, fades its thumb in while the pointer is over it and while it scrolls by any means (wheel, keyboard, script or a focus change), and fades it out once the pointer has left and 1s has passed since the last scroll, without the fade when reduced motion is preferred; the thumb becomes more opaque while dragged; revealing it never shifts content or changes the area's text color |
| Popover | Preferred width 27.5rem, viewport-clamped; large radius; 1px border; 0.75rem padding; 0.5rem gaps | Panel; title 600 | Menu surface, border and large shadow; the kit's popover surface, opened by the kit's popover trigger, which every popover uses and which exposes `aria-haspopup="dialog"` and its expanded state, above the control and end-aligned unless it asks otherwise; anchored to its control and kept in the viewport, scrolling when its content is taller; non-modal: focus moves into it, Escape or a click outside closes it, scrolling around its control or its control stopping rendering closes it, and Escape returns focus to the control |
| Toast | Preferred width 22.5rem, viewport-clamped; large radius; 1px border; 0.75rem padding; 0.5rem apart | Panel; title 600 | Notification surface and border with the large shadow; at the window's bottom right, 0.5rem above the status bar and from the edge; at most three, newest at the bottom, the rest queued. Its row matches the notifications popover's, with text clamped to three lines and a Close icon button. Information and success close after 8 s, paused while hovered or holding focus; warnings, errors and work in progress stay until closed. It never takes focus. Toasts shown at once are announced together through a live region at the document's root, outside the window: politely, or assertively when any of them is an error, so they are heard while a modal dialog holds the window inert |
| Notifications popover | Popover geometry; rows 0.5rem apart, each a 1rem severity icon, the body and a dismiss icon button; checkbox 1.125rem | Panel; titles 600; module and time muted | The title Notifications with a secondary Clear all, disabled while every notification reports work in progress; a Do not disturb checkbox; then rows newest first. The icon names the severity, error in the error color and success in the added color, never color alone. A title whose notification opens something is a link-colored button. Optional text, a progress bar, the module's name and the time, and secondary action buttons, disabled while their command is not registered, follow. "No notifications" when the list is empty; the list scrolls within the overlay bounds |
| Dialog | Preferred width 27.5rem; large radius; title padding 1.375rem 2rem 0.75rem 1.25rem; body 0 2rem 0 1.25rem; actions 1.25rem 0.5rem 0.5rem with 0.5rem gaps. Large: 80% of the window each way, at least 30rem by 20rem unless the overlay bounds are smaller; a title bar padded 0.5rem 0.5rem 0.5rem 1.25rem with a bottom border, the title on one truncated line and a Close icon button; a body without padding; no actions | Panel; title 600 | Dialog surface, 1px border, extra-large shadow and modal backdrop; content/actions reflow; the body scrolls under the thin scrollbar within the overlay bounds, while a large dialog's content lays itself out. Escape asks its owner to dismiss it unless a control inside already handled it, as does Close, and a click on the backdrop does nothing, and the focus stays where it was |
| Startup card | Dialog width; large radius; 1px border; 1.5rem padding, centered in the workspace's place with 1.5rem around it | Panel; title 600; details muted | Panel surface; a polite status region. It takes the workspace's place until the runtime is first ready. While the runtime starts again it covers the workspace over the modal backdrop, the workspace beneath stays as it was but is inert, controls that run commands outside it are disabled, view dialogs close, and the window announces it politely |
| Quit question | Dialog geometry; list inset 1.5rem | Panel; title 600; "and N more" muted | Asked when the last window closes while work is in progress: the title Work is still running, the work as a list of at most five and "and N more", then Wait for it to finish, or stop it now, with the primary Wait, then quit, focused, and secondary Stop the work and quit and Cancel; Escape cancels. Waiting changes the title to Waiting for the work to finish, keeps the list current, leaves out Wait, then quit, and moves focus to Cancel |
| View dialog | Large dialog | Its view's | Shows a view or document that the shell or a module asks for, titled with its tab label, on the panel surface. Focus goes to the view's first control once it has loaded, or else stays on Close; Escape or Close returns the view to where it was, and focus to the control that opened it, or to the view's tab when that control is gone. It closes when its view's module goes away or the tab it came from closes, and when another document opens or is activated from it, which then shows in its tab with focus. Its module's keys and the Edit keys run in it, from the keyboard and the macOS menu bar, but not the shell's other commands. Only the shell and modules open one, and never beside another dialog |
| Sash | 0.25rem visual gap; three 0.125rem grip dots spaced 0.3125rem; an in-use bar as wide as the gap, centered and as long as the sash | Accessible resize label | Grip at 30% normal foreground. In use, a bar in the sash-active color replaces the grip: after 300ms hover, at once while dragging and on keyboard focus. It hides when the pointer leaves unless the sash is dragged, and when focus leaves; it fades in 150ms, without the fade when reduced motion is preferred. Keyboard resize exposes the affected pane and size |
| Quick input (search) | Preferred width 37.5rem; 0.375rem top margin; padding 0.375rem 0.375rem 0.25rem; results 0.25rem below a 1.625rem field with 0.375rem padding, at most half the window's height, or ten rows when that is more, within the viewport; menu-item rows, so a result without an icon keeps the icon's space and every title starts at the same left edge; a menu separator before every section but the first; large radius | Panel; details, keys and section labels muted | Quick-input surface, border and extra-large shadow; non-modal and viewport-clamped, scrolling its results under the thin scrollbar. The field is a combobox over a listbox, focused on opening, with the first result active; typing filters and makes the first result active again; Up, Down, Home, End, Page Up and Page Down move the active result, and a change to the results keeps it where the person put it while it is listed, until the query changes, and otherwise makes the first result active; the active result stays in view by scrolling the results alone, never the page around them, and uses the selected fill, Enter or a click chooses it, and Escape or a click outside closes it, returning focus to where it was. With Shift, Ctrl, Alt or Meta held, those keys go to the field instead, so Shift+Home selects the query. Each result shows its icon, its title, a detail and its key, and the first result of a section ends with the section's label, which is part of its name, so screen readers read it; Home shows the first label again. A match is marked where it falls, in the title or the detail, in the list highlight at weight 600, with the text unchanged around it; the result count is announced as a status. Command search opens it centred below the window row with every enabled command and every enabled main-menu row that applies and passes arguments, and no row that runs its command without arguments, since that command is listed once under its own title. The commands recently run from command search come first, newest first, as many as **Recent commands** (`shell.recentCommandCount`, in Appearance's Command search group, shared across devices, 0 to 20) asks, 5 by default and none at 0, the first labelled "recently used"; a separator follows, and the others follow by title and then by category, which is the detail, the first labelled "other commands". Each row shows once. A query drops the separator and the labels and keeps the rows whose title, or whose category followed by a space and the title, contains it as one run of characters, ignoring case, the recent ones first, newest first, then the others by title; the first such run is marked, in the title when the title alone contains it. The detail names the command's module or the product, and a menu row's menu path, such as File › New from template, with no key where the row passes arguments |
| Button | 1.625rem minimum high; 0.5rem side padding; small radius; never wider than its container | Label | Primary or secondary button tokens; no ripple/state layer; adequate hit region without overlapping controls. An icon sits before the label, outside it and 0.25rem from it, and never shrinks. A label too long for the button starts after its start padding or icon and ends with an ellipsis, and a button whose label may not fit takes a tooltip with the full label, shown while it is cut |
| Text field | 1.625rem minimum high; preferred width 12.5rem; 0.375rem inner padding; small radius | Panel | Input tokens; labelled; focus border; an invalid entry (`aria-invalid`) takes the error border, focused or not; wraps validation text outside the input. Its context menu, from a right click, the menu key or Shift+F10, is the shell's text field menu: Cut, Copy, Paste and Select all, each disabled when the field does not allow it, such as Copy without a selection or Paste into a read-only field. Rich text gets the same menu, and so does any field a module draws that does not open its own |
| Select | 1.625rem minimum high; preferred width 20rem; small radius | Panel | Field styling; arrow in readable foreground; shrinks to its container. A value that matches no option shows as itself, and its list opens with no option marked |
| Dropdown list | 1.625rem minimum rows; 0.25rem inner padding; 0.5rem row side padding; small radius | Panel | Dropdown surface, 1px border and widget shadow; chosen/keyboard row uses active-list pair; no decorative check mark; the list never scrolls sideways, and an option too long for it ends with an ellipsis, keeping its full text as its name and, while cut short, its tooltip, below the list or, without room there, above it, so it covers no option |
| Checkbox | 1.125rem visual square, centred on the label's first line however many lines the label wraps to; 0.5rem label gap; hover radius; a drawn tick in a 1rem icon square, centred in the box | Panel label | Label participates in the hit target; border and check mark remain identifiable; disabled dims the box and its tick |
| Choice pills (toggle group) | 1.375rem minimum visual height; the pill padding on each side; 0.25rem gaps, wrapping onto further lines when they do not fit; small radius | Panel, 600 | A named radio group of radios: the checked pill, or the first when none is checked, is the one Tab stop, and the arrow keys, Home and End move the choice and the focus together, wrapping at the ends. The checked pill takes the selected fill and a hovered one the toolbar hover fill, so it still shows on a hovered Settings row; a long title wraps inside the pill, which never grows wider than its group; no border or check mark; keyboard focus is an outline inside the pill |
| Settings item | Padding 0.75rem 0.875rem 1.125rem; description gap 0.1875rem; control gap 0.5625rem; medium radius | Panel; title 600 | Subtle hover surface; text and controls wrap. A Choice setting of two to four options shows them as choice pills, and one of a single option or more than four shows a select. A modules setting shows a checkbox per module in module order; Notifications from modules labels each "<Module> notifications", checked while its notifications are on |
| Action setting | Settings-item geometry; the button follows the description at the control gap | Panel; title 600 | The title, name and description as on other settings, then a secondary button with the setting's label that runs its command, such as one that opens the module's own document, disabled while its command is not registered, as for a module that failed or is blocked. It holds no value, so it never shows the Modified marker or Reset |
| Settings heading | Automatic height; 0.625rem space below and none above, so a page's first heading, or a search's first result, has its top level with the page list's first item; no inset of its own: it starts at the Settings content edge (Settings document) | Settings group heading, 600 | Heading foreground; grows with its proportional line height |
| Settings document | Search field above, from the page list's start to the Settings content edge at the column's end, so it follows the column below its reading width; page list 12.5rem wide beside a content column at most 50rem wide; 1rem top padding, 1.5rem start padding, and 1.5rem end padding inside the search row and the column. The column insets every page's content by the Settings content inset, 0.9375rem, at both ends, once for all pages, built-in, a module's and the Gallery: headings, descriptions, Settings items with their hover surface, tables with their separators, the actions above and in a table and the Gallery's scope frames all start and end at that content edge; an item's own padding insets its text and controls from its hover surface's edges | Panel | A document in the middle group; the page list and the content scroll separately, the search row and the page list staying in place. The content scrolls from the page list to the panel's end edge with a stable scrollbar gutter, as a document tab does, so its scrollbar sits at that edge and the wheel scrolls it anywhere beside the column. Wherever it lists a setting or a command, its id shows under its title in the label size, muted, such as `shell.theme` under Theme and `shell.splitTabUp` under Split the tab up, and a long id wraps within its cell. Where the document is narrower than 37rem, so the content column would get less than 20rem beside the list, a Settings pages select replaces the list at the start of the search row and the content takes the whole width; the select and the search field share the row, each on its own line when either would get less than 10rem, and while searching the select shows Search results. When Settings switches between the list and the select while either has focus, focus moves to the one now shown, on the current page. While the window is open it keeps its page, its search and both scroll positions when its tab becomes active again or moves to another group; once its tab closes, it opens again on its first page |
| Settings page list | A tree of the pages, without branches | Panel | The current page is the tree's current row; while searching, no page is current and choosing one ends the search |
| Modules document | Header above; module list 20rem wide beside details at most 45rem wide, 1.5rem apart; 1rem top and 1.5rem side padding | Panel; title in the settings group heading role, 600 | A document in the middle group, opened once by **Modules…** in the main menu's View menu and command search, or by the module failures item with the first module that didn't start selected. The header shows the title and, muted, the product and its version. The list and the details scroll separately and follow the modules whenever the runtime starts again, showing the last list until the runtime reports the modules again and keeping the selected module while it remains and otherwise showing the first |
| Modules list | Rows 0.25rem apart with 0.5rem padding; small radius | Panel; id and version in the label role, muted | Every module in module order: its name and state on the first line, then its id with its version 0.5rem after it, each name and id on one line, truncated with its full text in a tooltip while cut short, the version never cut, then its description on at most two lines; hover surface; the selected row uses the selected fill and is marked current. Active is muted text; failed and blocked show the 1rem error icon and the state's name, never color alone |
| Module details | Label column and value column, 0.5rem by 1rem apart | Panel; name in the title role, 600; id in the label role, muted; labels and a cause muted | The selected module's name, id and description, wrapping; then its version, its state at panel size with its cause, the module that blocks it, the modules it depends on and the modules that depend on it, each a link that selects that module and moves the focus to its row, an id the list lacks as plain text, or "None". A module that is not active then offers secondary buttons Copy details, which copies the build and the module's id, version, state and cause and says Copied for two seconds, and Open log folder; a folder that cannot open is reported in a status line. Under **Contributes**, its commands, settings, menus, views and notification kinds by kind, each name with its title where the window knows one, or a sentence saying it has none of them |
| Settings search | Text-field geometry | Panel | Filters every page by title, description, name and an action's label as the person types; matches use the list highlight, underlined; results are grouped under their pages' headings, then their groups; with no match a sentence says so |
| Modified marker | 0.625rem filled dot before the setting's title | — | Accent foreground; named "Modified" with the same tooltip, so its shape and name carry it, not its color; shown with the row's Reset while a value is stored; choosing the default by hand is a reset, so the marker and Reset disappear |
| Shortcut row | Configuration-table row with the columns Command, From, Key and the actions; the key is a secondary button; actions 0.5rem apart, at the row's end | Panel; owner muted; collision and notices in the label size | The command's title follows the Modified marker while the person bound it, and From names its module or the product. Choosing the key, or Enter on it, records a new one: the key reads "Press the new key", then the modifiers held, such as Ctrl+Shift+…, keeps the focus, and takes the first other key without running any command. Escape, Tab or the focus leaving ends recording; recording any key the command has changes nothing. On Windows and Linux Ctrl records as Mod; on macOS Cmd records as Mod and Control as Ctrl. A refused key keeps the old one and says why under it, such as "Ctrl+C belongs to editing", "A key needs Ctrl, Alt or a function key" or "The Windows key can't be part of a shortcut". A key another command holds reads "Ctrl+K is used by Close the tab" with the primary Use it here and the secondary Cancel, and either returns the focus to the key. Remove shows while the command has a key and Reset while it has a binding; Reset all shortcuts stands beside the explanation above the table, enabled while any binding is stored. A default key another command holds, such as one Use it here took from a command that keeps another default or a collision that arose later, reads "Ctrl+K is taken by <title>" under the refused command's key |
| Icon button | 1.375rem visual pad around a 1rem glyph; small radius | Accessible name | Toolbar hover; pointer hit region at least 24px unless a documented exception applies |
| View badge | 1rem high pill with 0.25rem side padding, at least 1rem wide; a 0.5rem dot without a count; 0.625rem text, 600 | Hidden; its description joins the view's accessible name | Primary-button fill and text; a count up to 99, then 99+ |
| Menu bar | A horizontal strip of menu-bar items; no surface of its own | Accessible name | One tab stop with the menubar keyboard of section 7; a folded bar stays in the row, hidden and inert, so its width is known |
| Menu-bar item | 24px high hit target; the pill padding on each side; 1.375rem high pill with a small radius | Panel | Toolbar hover while hovered or while its menu is open; keyboard focus outline; opens its menu below it, aligned with its start; shows no chevron |
| Toolbar | A horizontal or vertical strip; its items keep their own geometry | Accessible name | No surface of its own; one tab stop with the keyboard of section 7; items added or removed while it shows join or leave it; dragging belongs to the strip's owner |
| Toolbar band | Rows as high as a button, 1.5rem, stacked under the window row with no divider, 0.25rem apart and 0.25rem above the panels, so the window row's controls, each row's buttons and the panels stand 0.25rem apart; 0.5rem side inset; 0.5rem between toolbars | Panel | Window surface; shown only while a toolbar has an item, and then only the rows that have one; rows never scroll sideways, so a toolbar that does not fit moves its last sections into its More actions menu, and keeps at least its grip and one button; when a resize moves the focused button into that menu, focus moves to More actions. Its context menu, on space no toolbar covers, lists the toolbars as checkbox rows, as View's Toolbars submenu does; a toolbar's own context menu is its grip's menu |
| Toolbar grip | 0.25rem wide, as high as the buttons of its toolbar (1.5rem) and centred in its row, so the grips of consecutive rows stand 0.25rem apart, with 0.0625rem after it; exactly three dots, each 0.125rem across, as the sash grip's dots are, 0.2rem apart and centred in the grip, so they stand clear of its top and bottom | A button named Move toolbar, not a tab stop | Dots at 30% of the icon color, full on hover and, with an accent outline, on focus; a click opens its menu, which the Menu key or Shift+F10 opens from any item of the toolbar, with Move left, Move right, Move to the row above, Move to the row below and Hide toolbar rows, each disabled where it cannot apply, then a Toolbars submenu with the checkbox rows of View's Toolbars; hiding a toolbar moves the focus to the grip of the toolbar that took its place, else the previous one's, else Search commands; pressing and moving it starts a drag; the pointer moves the toolbar to another place in its row, to another row, or, in the top or bottom quarter of a row, to a new row above or below it, shown by the drop line (section 8) at the drop position; Escape or losing focus cancels |
| Toolbar button | 1.5rem square, as high as a tab's pill, or at least 1.5rem wide with the pill padding on each side when it shows a label; a 1rem glyph; small radius; a 1rem chevron 0.125rem after the label of a dropdown | Panel | Toolbar hover; pressed fills as hover does and exposes its state; a disabled item stays focusable, is dimmed, shows no hover and marks itself aria-disabled; never wider than its toolbar; its glyph and chevron never shrink, and a label too long for its width ends with an ellipsis inside the button, with the full label in its tooltip; a toolbar's groups are 1px separators with 0.5rem each side |
| Docking guide | 2.5rem square around a 1.5rem glyph; small radius; a group's center target and split arrows share a medium-radius plate with 0.125rem gaps, moved clear of the side guides | Accessible action name | Raised surface; shown while a view's tab is dragged; primary-button fill and text for the chosen target, whose landing area is previewed with the docking-preview fill, a 1px docking-preview border and the large radius |
| Progress | 2px bar; 1rem spinner; a delayed one stays hidden for 300ms so brief work does not flash it | The bar is a progress bar named for its work, with its fraction only when known; the spinner is a status whose text names the work, shown only once the spinner is, so a delayed one is announced when it appears, and its ring is hidden from assistive technology | Progress token fill over a track of the same color at 25%, drawn by the kit's progress bar, never the native element; an unknown amount slides a bar across the track, standing still under reduced motion. The spinner is a ring of the progress color over the same faint ring, turning, and a half ring standing still under reduced motion; a working tab shows this spinner, without a label; completion/error remain understandable without animation |
| Word wrap | Icon-button geometry; 1rem wrap glyph | Accessible name Word wrap | Initially off, so code keeps its own shape; precedes Copy or diff collapse; pressed state exposed and filled as hover is; Enter/Space activate |
| Copy | Icon-button geometry; 1rem copy glyph | Accessible name Copy | Copies the exact text through the desktop's clipboard. For two seconds after, the check glyph in the added color and the name Copied, or, when the clipboard refuses the text, the copy glyph and the name Couldn't copy; either is announced politely, and copying again within the two seconds starts them again |
| Inline code | The line box of the text around it, which it never makes taller; 0.25rem side padding; small radius | Code font at the size of the text around it | The kit's inline code: inline-code token; text fully opaque; a long name wraps anywhere |
| Preview tab | Tab geometry | Panel, italic | One temporary preview per strip, which the next preview replaces in place; described to assistive technology as "Preview". A double-click, the tab menu's Keep open or a module's own keep action keeps it; moving it keeps it too. A kept preview becomes an ordinary tab, and the preview state survives a restart. With the Preview tabs setting off, no tab is a preview |
| Tree row while dragged | Tree-row geometry; small radius | Panel | Shell-color ghost, border and large shadow, at the pointer's inline end side, so the drop line stays visible; the row being moved dims to half; the rows a move displaced slide from their old places in 150ms, with no animation when reduced motion is preferred |
| Card | Automatic height; 0.75rem padding; medium radius; 1px border | Message | Raised surface; the kit's card; a long word wraps inside it rather than widen it |
| Module failure card | The kit's card, 0.5rem from the panel's edges; 1rem error icon 0.5rem from the title | Message; title 600 | Raised surface; fills a failed module's view with "<Module> didn't start" and the cause in muted text |
| Code block | Automatic height, never an inner vertical scroll; header at least 1.625rem high, with the language's text 0.75rem from its start and the Copy glyph 0.75rem from its end; the code padded 0.5rem by 0.75rem, keeping its end padding when a line is scrolled to its end, and a sideways scrollbar takes its height from the bottom padding, so the space under the last line matches the space over the first; medium radius; 1px border and header divider | Code body; the language in the label role, muted, cut with an ellipsis when too long | The kit's code block: the code-header surface over the code surface; the language, or nothing, then a toolbar named Code block actions with Word wrap and Copy, always shown. With wrap off, long lines scroll sideways inside the body and never widen what holds it; with wrap on, they wrap anywhere |
| Badge (counts, +1 -0), key chip | 1.25rem visual height and at least as wide; 0.375rem side padding; small radius; 1px border | Panel, 600; a key normal | Count badges unfilled, a count up to 99, then 99+; diff counts unfilled in the added and removed text colors with + and − signs; a key chip has the same geometry on the raised surface; failures have an explicit status |

## 9. The shared kit and modules

The shell's kit provides these typography, color, surface, spacing, interaction, accessibility and component contracts.
Feature-specific components belong to modules.

- Modules build their components, such as calendars, from kit tokens, text roles, spacing and radii under sections 6 and 7.
  Their own documents define geometry and behavior.
- Modules neither restyle kit components nor redefine shared tokens.
  Additional colors use `--tr-<module id>-<name>`, a theme key and fallback, checked in every theme and mode.
  The architecture's [identity rules](ARCHITECTURE.md#3-vocabulary-and-identity) enforce complete-name uniqueness.
- Reused components remain module-owned and may be published to dependents.
  Adding one to the kit requires a reviewed change to section 8.
- A module's theme is data under section 2, shown in the Gallery and checked like the default theme.
  It requires no change to a module or a kit control; a look that needs a new shape adds that shape to the kit first, through a reviewed change to section 8.

## 10. Implementation and verification

- Shared stylesheet/theme tokens own colors and geometry; templates use shared layout and component classes.
  Layout classes may arrange elements and consume tokens, but do not add competing literal sizes, colors or radii.
  Framework overrides must preserve semantics, focus and hit testing as well as appearance.
- The Angular CDK provides overlays, menu behavior and accessible drag.
  No utility-CSS framework is used; the kit's tokens and classes cover layout.
- The window applies a theme by setting token values and shape names at its root; the kit's styles implement every shape, and nothing else varies by theme.
  A fixture theme whose values all differ from the default theme's verifies that every kit control takes its colors and geometry from the theme.
- Docks and documents share the panel-card and tab primitives.
  A new kit control extends the component table when its contract differs; update this owner through review instead of adding a private visual exception.
- Use the framework's supported theming APIs where available.
  Verify the actual cascade and theme scope rather than assuming a particular stylesheet order or increasing specificity without examining the conflict.
- The kit's Gallery, which the window shows as a Settings page in development builds only ([architecture](ARCHITECTURE.md#2-components-and-dependency-direction)), demonstrates each reusable control's meaningful states in every theme and both modes, each theme and mode in a scope of its own.
  Include keyboard focus, selection, disabled/working/error states, long text and overlay behavior.
  Every control has a section of one layout, with 1.5rem between sections: a heading with the control's name; a grid of cells, one per state, each with a short muted caption above its specimen, in the order the default, the control's own states, disabled, focus and error; and below the grid a full-width row for long text, whose specimen is at most 12rem wide so truncation and wrapping show.
  A cell is 12.5rem wide, two cells and their gap for a wide control such as a select or a menu, or the whole row for a dialog, a popover or quick input; cells are 1rem apart and wrap onto further rows in a narrow window or at 200% zoom, keeping their width and order.
  Hover is shown statically: each kit rule for a hovered look matches the shared `$hover` selector of `styles/_states.scss`, which also matches `data-tr-state="Hover"`, so that selector ships in the product's styles, and only the Gallery sets the attribute ([architecture](ARCHITECTURE.md#10-build-installation-and-updates)).
  Focus is shown statically the same way: each kit rule for a focused look matches `$focus-visible`, or `$focus` for a text input, which also match `data-tr-state="Focus"`, so a Focus cell shows the real focus ring without being focused.
  A pressed cell appears only for a control with a pressed state.
  The overlays a scope opens (menus, select lists, tooltips) open inside that scope, so they take its theme and mode; a test fails when a component the kit exports is not shown, so a new control adds itself to the Gallery.
  Gallery coverage does not replace checks in the real parent layouts.
- Verify default and minimum/maximum font preferences, that spacing and component geometry scale with the panel size while borders keep their pixel width, relevant font fallbacks, 100% and 200% zoom, the smallest supported window, reduced motion and forced colors.
  Check that active controls, focus and dialog actions remain reachable and that code/diff scrolling does not widen the page.
- Capture relevant regions under [TESTING.md](TESTING.md#ui-screenshots-and-reports), recording theme, mode, fonts, zoom, viewport, platform and revision.
  External references include reproducible versions/settings, without requiring another person's installed editor.
- Use DOM/computed-style and contrast measurements for numerical claims, which the [desktop UI workflows](TESTING.md#desktop-ui-automation) assert on every target, plus keyboard and assistive-technology checks for interaction claims.
  Screenshots alone do not prove geometry, contrast or accessibility.
  Check composited colors in each state and test popup anchoring during scroll, resize and removal.
- [TESTING.md](TESTING.md) owns automation, target coverage, screenshots, reporting and cleanup for component and real-layout checks.
