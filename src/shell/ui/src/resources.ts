/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { AriaLivePoliteness, FocusOrigin } from "@angular/cdk/a11y";

import "@noldova/teamrun-foundation-core";

import { CodeTokenKind } from "./app/enums/code-token-kind";
import { CopyState } from "./app/enums/copy-state";
import { DockingDirection } from "./app/enums/docking-direction";
import { OverlayAlignment } from "./app/enums/overlay-alignment";
import { SashOrientation } from "./app/enums/sash-orientation";
import { ToolbarOrientation } from "./app/enums/toolbar-orientation";
import { ColorToken } from "./app/models/color-token";

export class Resources {
  public static readonly colorTokens: readonly ColorToken[] = [
    new ColorToken("--tr-window", "sideBar.background"),
    new ColorToken("--tr-panel", "editor.background"),
    new ColorToken("--tr-raised", "teamrun.raisedBackground", "editorWidget.background"),
    new ColorToken("--tr-code", "teamrun.codeBackground", "sideBar.background"),
    new ColorToken("--tr-code-header", "teamrun.codeHeaderBackground", "editorWidget.background"),
    new ColorToken("--tr-code-comment", "teamrun.codeCommentForeground"),
    new ColorToken("--tr-code-keyword", "teamrun.codeKeywordForeground"),
    new ColorToken("--tr-code-control", "teamrun.codeControlForeground"),
    new ColorToken("--tr-code-string", "teamrun.codeStringForeground"),
    new ColorToken("--tr-code-number", "teamrun.codeNumberForeground"),
    new ColorToken("--tr-code-type", "teamrun.codeTypeForeground"),
    new ColorToken("--tr-code-function", "teamrun.codeFunctionForeground"),
    new ColorToken("--tr-code-variable", "teamrun.codeVariableForeground"),
    new ColorToken("--tr-code-regex", "teamrun.codeRegexForeground"),
    new ColorToken("--tr-code-meta", "teamrun.codeMetaForeground"),
    new ColorToken("--tr-text", "foreground"),
    new ColorToken("--tr-text-muted", "teamrun.mutedForeground", "descriptionForeground"),
    new ColorToken("--tr-icon-color", "icon.foreground", "foreground"),
    new ColorToken("--tr-card-border", "surface.border", "widget.border"),
    new ColorToken("--tr-border", "sideBarSectionHeader.border"),
    new ColorToken("--tr-accent", "focusBorder"),
    new ColorToken("--tr-sash-active", "sash.hoverBorder", "focusBorder"),
    new ColorToken("--tr-link", "textLink.foreground"),
    new ColorToken("--tr-hover", "list.hoverBackground"),
    new ColorToken("--tr-selected", "list.inactiveSelectionBackground", "list.activeSelectionBackground"),
    new ColorToken("--tr-toolbar-hover", "toolbar.hoverBackground"),
    new ColorToken("--tr-scrollbar", "scrollbarSlider.background"),
    new ColorToken("--tr-scrollbar-active", "scrollbarSlider.hoverBackground", "scrollbarSlider.background"),
    new ColorToken("--tr-title-bar", "titleBar.activeBackground"),
    new ColorToken("--tr-title-bar-text", "titleBar.activeForeground"),
    new ColorToken("--tr-input", "input.background"),
    new ColorToken("--tr-input-border", "input.border"),
    new ColorToken("--tr-input-text", "input.foreground"),
    new ColorToken("--tr-placeholder", "input.placeholderForeground"),
    new ColorToken("--tr-button", "button.background"),
    new ColorToken("--tr-button-text", "button.foreground"),
    new ColorToken("--tr-button-hover", "button.hoverBackground"),
    new ColorToken("--tr-button-secondary", "button.secondaryBackground"),
    new ColorToken("--tr-button-secondary-text", "button.secondaryForeground"),
    new ColorToken("--tr-button-secondary-hover", "button.secondaryHoverBackground"),
    new ColorToken("--tr-dropdown", "dropdown.background", "input.background"),
    new ColorToken("--tr-dropdown-border", "dropdown.border", "input.border"),
    new ColorToken("--tr-dropdown-list", "dropdown.listBackground", "input.background"),
    new ColorToken("--tr-list-active", "list.activeSelectionBackground"),
    new ColorToken("--tr-list-active-text", "list.activeSelectionForeground"),
    new ColorToken("--tr-list-highlight", "list.highlightForeground"),
    new ColorToken("--tr-button-border", "button.border"),
    new ColorToken("--tr-setting-title", "settings.headerForeground", "foreground"),
    new ColorToken("--tr-hover-widget", "editorHoverWidget.background", "editorWidget.background"),
    new ColorToken("--tr-hover-widget-border", "editorHoverWidget.border", "widget.border"),
    new ColorToken("--tr-quick-input", "quickInput.background", "editorWidget.background"),
    new ColorToken("--tr-menu-separator", "menu.separatorBackground", "widget.border"),
    new ColorToken("--tr-widget-shadow", "widget.shadow"),
    new ColorToken("--tr-widget-border", "widget.border", "surface.border"),
    new ColorToken("--tr-dialog", "dialog.background", "editorWidget.background"),
    new ColorToken("--tr-menu", "menu.background"),
    new ColorToken("--tr-menu-text", "menu.foreground"),
    new ColorToken("--tr-menu-border", "menu.border"),
    new ColorToken("--tr-checkbox", "checkbox.background"),
    new ColorToken("--tr-checkbox-border", "checkbox.border"),
    new ColorToken("--tr-badge", "badge.background"),
    new ColorToken("--tr-badge-text", "badge.foreground"),
    new ColorToken("--tr-progress", "progressBar.background", "focusBorder"),
    new ColorToken("--tr-notification", "notifications.background"),
    new ColorToken("--tr-notification-border", "notifications.border"),
    new ColorToken("--tr-error", "errorForeground"),
    new ColorToken("--tr-removed", "teamrun.removedForeground", "errorForeground"),
    new ColorToken("--tr-added", "teamrun.addedForeground"),
    new ColorToken("--tr-docking-preview", "teamrun.dockingPreviewBackground", "list.inactiveSelectionBackground"),
    new ColorToken("--tr-docking-preview-border", "teamrun.dockingPreviewBorder", "focusBorder")
  ];
  public static readonly lookTokens: readonly string[] = [
    "radius-hover",
    "radius-small",
    "radius-medium",
    "radius-large",
    "space-1",
    "space-2",
    "space-3",
    "space-4",
    "space-6",
    "pill-padding",
    "border-width",
    "shadow-large",
    "shadow-xlarge",
    "backdrop",
    "panel-card-gap",
    "panel-card-margin",
    "dock-left-width",
    "dock-right-width",
    "dock-bottom-height",
    "dock-min-size",
    "dock-strip-size",
    "document-min-size",
    "group-min-width",
    "group-min-height",
    "tab-height",
    "tab-pill",
    "tab-inset",
    "tab-max-width",
    "scrollbar-size",
    "tab-action-slot",
    "tab-close",
    "icon",
    "icon-button",
    "sash",
    "sash-grip",
    "sash-grip-spacing",
    "docking-guide",
    "docking-guide-icon",
    "docking-plate-gap",
    "view-badge",
    "view-badge-dot",
    "view-badge-padding",
    "view-badge-text",
    "chip",
    "chip-padding",
    "spinner",
    "choice-pill",
    "choice-pill-gap",
    "menu-padding",
    "menu-label-padding",
    "menu-item-height",
    "menu-item-inset",
    "menu-item-padding",
    "menu-trail-gap",
    "band-gap",
    "toolbar-button",
    "toolbar-gap",
    "toolbar-grip-gap",
    "menu-separator-spacing",
    "tooltip-width",
    "tooltip-padding",
    "popover-width",
    "dialog-width",
    "dialog-title-padding",
    "dialog-body-padding",
    "dialog-actions-padding",
    "dialog-large-width",
    "dialog-large-height",
    "dialog-large-min-width",
    "dialog-large-min-height",
    "dialog-large-header-padding",
    "quick-input-width",
    "quick-input-margin",
    "quick-input-padding",
    "quick-input-gap",
    "field-height",
    "field-padding",
    "window-row-height",
    "status-bar-height",
    "status-bar-item-height",
    "status-bar-item-gap",
    "button-height",
    "button-padding",
    "checkbox-size",
    "toast-width",
    "text-field-width",
    "select-width",
    "number-field-width",
    "setting-marker",
    "tree-row-height",
    "tree-indent",
    "section-header-height",
    "content-padding-inline",
    "document-padding-block",
    "view-padding-block",
    "settings-pages-width",
    "settings-content-width",
    "modules-list-width",
    "modules-detail-width",
    "dropdown-padding",
    "dropdown-row-height",
    "dropdown-row-padding",
    "settings-item-padding",
    "settings-item-description-gap",
    "settings-item-control-gap",
    "settings-heading-space",
    "settings-content-inset",
    "code-header-height"
  ];
  public static readonly shapes: ReadonlyMap<string, readonly string[]> = new Map([["tab", ["pill"]]]);
  public static readonly defaultThemeId: string = "shell.default";
  public static readonly defaultThemeName: string = "Default";
  public static readonly colorSchemeProperty: string = "color-scheme";
  public static readonly lightScheme: string = "light";
  public static readonly darkScheme: string = "dark";
  public static readonly darkSchemeQuery: string = "(prefers-color-scheme: dark)";
  public static readonly sectionHeaderLevel: number = 3;
  public static readonly changeEvent: "change" = "change";
  public static readonly defaultRootSize: number = 16;
  public static readonly defaultPanelSize: number = 13;
  public static readonly defaultMessageSize: number = 14;
  public static readonly defaultCodeSize: number = 14;
  public static readonly minimumTextSize: number = 12;
  public static readonly maximumTextSize: number = 18;
  public static readonly panelSizeParameter: string = "panelSize";
  public static readonly messageSizeParameter: string = "messageSize";
  public static readonly codeSizeParameter: string = "codeSize";
  public static readonly fontSizeProperty: string = "font-size";
  public static readonly messageSizeVariable: string = "--tr-text-message";
  public static readonly codeSizeVariable: string = "--tr-text-code";
  public static readonly sansFontVariable: string = "--tr-font-sans";
  public static readonly monoFontVariable: string = "--tr-font-mono";
  public static readonly noldovaSansFonts: string = "\"Noldova Sans\", system-ui, \"Segoe UI\", Roboto, sans-serif";
  public static readonly systemSansFonts: string = "system-ui, \"Segoe UI\", Roboto, sans-serif";
  public static readonly noldovaMonoFonts: string = "\"Noldova Mono\", ui-monospace, \"Cascadia Mono\", Consolas, monospace";
  public static readonly systemMonoFonts: string = "ui-monospace, \"Cascadia Mono\", Consolas, monospace";
  public static readonly closeGlyph: string = "close";
  public static readonly dockingGlyphs: Readonly<Record<DockingDirection, string>> = {
    [DockingDirection.Center]: "tab",
    [DockingDirection.Left]: "arrow_back",
    [DockingDirection.Right]: "arrow_forward",
    [DockingDirection.Top]: "arrow_upward",
    [DockingDirection.Bottom]: "arrow_downward"
  };
  public static readonly dockingLabels: Readonly<Record<DockingDirection, string>> = {
    [DockingDirection.Center]: "Add to this group",
    [DockingDirection.Left]: "Place on the left",
    [DockingDirection.Right]: "Place on the right",
    [DockingDirection.Top]: "Place above",
    [DockingDirection.Bottom]: "Place below"
  };
  public static readonly progressMinimum: number = 0;
  public static readonly progressMaximum: number = 1;
  public static readonly sashHoverDelay: number = 300;
  public static readonly sashKeyboardStep: number = 8;
  public static readonly sashDecreaseKeys: Readonly<Record<SashOrientation, string>> = {
    [SashOrientation.Vertical]: "ArrowLeft",
    [SashOrientation.Horizontal]: "ArrowUp"
  };
  public static readonly sashIncreaseKeys: Readonly<Record<SashOrientation, string>> = {
    [SashOrientation.Vertical]: "ArrowRight",
    [SashOrientation.Horizontal]: "ArrowDown"
  };
  public static readonly verticalOrientation: string = "vertical";
  public static readonly badgeLimit: number = 99;
  public static readonly badgeOverflow: string = "99+";
  public static readonly chipAddedSign: string = "+";
  public static readonly chipRemovedSign: string = "−";
  public static readonly revealDelay: number = 300;
  public static readonly choicePillSelector: string = ".tr-choice-pill";
  public static readonly choicePillTargets: ReadonlyMap<string, (current: number, last: number) => number> = new Map<string, (current: number, last: number) => number>([
    ["ArrowRight", (current, last) => current >= last ? 0 : current + 1],
    ["ArrowDown", (current, last) => current >= last ? 0 : current + 1],
    ["ArrowLeft", (current, last) => current <= 0 ? last : current - 1],
    ["ArrowUp", (current, last) => current <= 0 ? last : current - 1],
    ["Home", () => 0],
    ["End", (_current, last) => last]
  ]);
  public static readonly horizontalOrientation: string = "horizontal";
  public static readonly toolbarDirection: "ltr" = "ltr";
  public static readonly toolbarMoveKeys: Readonly<Record<ToolbarOrientation, readonly string[]>> = {
    [ToolbarOrientation.Horizontal]: ["ArrowLeft", "ArrowRight", "Home", "End"],
    [ToolbarOrientation.Vertical]: ["ArrowUp", "ArrowDown", "Home", "End"]
  };
  public static readonly tooltipShowDelay: number = 0;
  public static readonly tooltipHideDelay: number = 0;
  public static readonly tooltipPaneClass: string = "tr-tooltip-pane";
  public static readonly zeroPixels: string = "0px";
  public static readonly tooltipTextInput: string = "text";
  public static readonly overlayAlignmentFactors: Readonly<Record<OverlayAlignment, number>> = {
    [OverlayAlignment.Center]: 0.5,
    [OverlayAlignment.Start]: 0,
    [OverlayAlignment.End]: 1
  };
  public static readonly resizeEvent: string = "resize";
  public static readonly pointerLeaveEvent: "pointerleave" = "pointerleave";
  public static readonly scrollEvent: string = "scroll";
  public static readonly scrollingAttribute: string = "data-tr-scrolling";
  public static readonly scrollRevealDelay: number = 1000;
  public static readonly keyboardFocusOrigin: FocusOrigin = "keyboard";
  public static readonly mouseFocusOrigin: FocusOrigin = "mouse";
  public static readonly programFocusOrigin: FocusOrigin = "program";
  public static readonly menuPaneClass: string = "tr-menu-pane";
  public static readonly popoverClass: string = "tr-popover";
  public static readonly popoverPaneClass: string = "tr-popover-pane";
  public static readonly dialogPaneClass: string = "tr-dialog-pane";
  public static readonly dialogBackdropClass: string = "tr-dialog-backdrop";
  public static readonly dialogTitleIdPrefix: string = "tr-dialog-title-";
  public static readonly dialogTitleIdToken: string = "tr-dialog-title-id";
  public static readonly dialogCloseLabel: string = "Close";
  public static readonly dialogMaximizeLabel: string = "Maximize";
  public static readonly dialogRestoreLabel: string = "Restore";
  public static readonly dialogMaximizeGlyph: string = "crop_square";
  public static readonly dialogRestoreGlyph: string = "filter_none";
  public static readonly dialogCloseSelector: string = ".tr-dialog-close";
  public static readonly noLimit: string = "none";
  public static readonly inertAttribute: string = "inert";
  public static readonly ariaLiveAttribute: string = "aria-live";
  public static readonly popoverAttribute: string = "popover";
  public static readonly dropdownPaneClass: string = "tr-dropdown-pane";
  public static readonly listboxSelector: string = "[role=listbox]";
  public static readonly tabKey: string = "Tab";
  public static readonly spaceKey: string = " ";
  public static readonly valueAttribute: string = "data-value";
  public static readonly previewDescription: string = "Preview";
  public static readonly submenuGlyph: string = "chevron_right";
  public static readonly twistieGlyph: string = "chevron_right";
  public static readonly toolbarChevronGlyph: string = "expand_more";
  public static readonly menuPopup: string = "menu";
  public static readonly trueValue: string = "true";
  public static readonly quickInputIdPrefix: string = "tr-quick-input-";
  public static readonly quickInputOptionSeparator: string = "-option-";
  public static readonly quickInputFieldSelector: string = ".tr-quick-input-field";
  public static readonly quickInputOptionSelector: string = "[role=option]";
  public static readonly arrowDownKey: string = "ArrowDown";
  public static readonly arrowUpKey: string = "ArrowUp";
  public static readonly homeKey: string = "Home";
  public static readonly endKey: string = "End";
  public static readonly pageDownKey: string = "PageDown";
  public static readonly pageUpKey: string = "PageUp";
  public static readonly enterKey: string = "Enter";
  public static readonly escapeKey: string = "Escape";
  public static readonly keydownEvent: "keydown" = "keydown";
  public static readonly checkedGlyph: string = "check";
  public static readonly wordWrapGlyph: string = "wrap_text";
  public static readonly wordWrapLabel: string = "Word wrap";
  public static readonly codeBlockActionsLabel: string = "Code block actions";
  public static readonly copyGlyphs: Readonly<Record<CopyState, string>> = {
    [CopyState.Ready]: "content_copy",
    [CopyState.Copied]: "check",
    [CopyState.Failed]: "content_copy"
  };
  public static readonly copyLabels: Readonly<Record<CopyState, string>> = {
    [CopyState.Ready]: "Copy",
    [CopyState.Copied]: "Copied",
    [CopyState.Failed]: "Couldn't copy"
  };
  public static readonly copyFeedbackDuration: number = 2000;
  public static readonly codeThemeName: string = "teamrun";
  public static readonly codePlainMarker: string = "plain";
  public static readonly codeLengthLimit: number = 100_000;
  public static readonly codeLineLengthLimit: number = 2000;
  public static readonly codeLoadFailureHold: number = 10_000;
  public static readonly codeHighlightPrefix: string = "tr-code-";
  public static readonly codePlainScopes: readonly string[] = ["keyword.operator", "punctuation"];
  public static readonly codeTokenScopes: Readonly<Record<CodeTokenKind, readonly string[]>> = {
    [CodeTokenKind.Comment]: ["comment", "punctuation.definition.comment"],
    [CodeTokenKind.Keyword]: ["keyword", "storage", "constant.language", "variable.language", "keyword.operator.new", "keyword.operator.expression", "keyword.operator.word",
      "keyword.operator.wordlike", "keyword.operator.logical.python"],
    [CodeTokenKind.Control]: ["keyword.control"],
    [CodeTokenKind.String]: ["string", "punctuation.definition.string", "markup.deleted"],
    [CodeTokenKind.Number]: ["constant.numeric", "keyword.other.unit", "markup.inserted"],
    [CodeTokenKind.Type]: ["entity.name.type", "entity.name.class", "entity.name.namespace", "entity.other.inherited-class", "support.type", "support.class"],
    [CodeTokenKind.Function]: ["entity.name.function", "support.function"],
    [CodeTokenKind.Variable]: ["variable", "meta.object-literal.key", "support.variable", "support.type.property-name", "entity.other.attribute-name"],
    [CodeTokenKind.Regex]: ["string.regexp"],
    [CodeTokenKind.Meta]: ["meta.preprocessor", "punctuation.decorator", "entity.name.tag", "markup.heading", "entity.name.section", "meta.diff.header", "meta.diff.range"]
  };
  public static readonly selectGlyph: string = "expand_more";
  public static readonly selectListSelector: string = ".tr-select-list";
  public static readonly menuItemRole: string = "menuitem";
  public static readonly menuItemRadioRole: string = "menuitemradio";
  public static readonly menuItemCheckboxRole: string = "menuitemcheckbox";
  public static readonly contextMenuKey: string = "ContextMenu";
  public static readonly menuKey: string = "F10";
  public static readonly clickEvent: string = "click";
  public static readonly auxclickEvent: string = "auxclick";
  public static readonly mouseenterEvent: "mouseenter" = "mouseenter";
  public static readonly mousedownEvent: "mousedown" = "mousedown";
  public static readonly pointermoveEvent: "pointermove" = "pointermove";
  public static readonly hoverSelector: string = ":hover";
  public static readonly secondaryButton: number = 2;
  public static readonly truncationSelector: string = "[data-truncates]";
  public static readonly regExpSpecialPattern: RegExp = /[.*+?^${}()|[\]\\]/gu;
  public static readonly chromeAttribute: string = "data-tr-chrome";
  public static readonly chromeSelector: string = "[data-tr-chrome]";
  public static readonly topChrome: string = "top";
  public static readonly bottomChrome: string = "bottom";
  public static readonly overlayGapLook: string = "space-2";
  public static readonly panelMarginLook: string = "panel-card-margin";
  public static readonly windowRowLook: string = "window-row-height";
  public static readonly statusBarLook: string = "status-bar-height";
  public static readonly middleButton: number = 1;
  public static readonly primaryButton: number = 0;
  public static readonly arrowLeftKey: string = "ArrowLeft";
  public static readonly arrowRightKey: string = "ArrowRight";
  public static readonly pointerupEvent: "pointerup" = "pointerup";
  public static readonly pointercancelEvent: "pointercancel" = "pointercancel";
  public static readonly lostpointercaptureEvent: "lostpointercapture" = "lostpointercapture";
  public static readonly primaryButtons: number = 1;
  public static readonly blurEvent: "blur" = "blur";
  public static readonly treeItemSelector: string = "[role=treeitem]";
  public static readonly politeAnnouncement: AriaLivePoliteness = "polite";
  public static readonly assertiveAnnouncement: AriaLivePoliteness = "assertive";
  public static readonly treeHoverOpenDelay: number = 500;
  public static readonly treeGhostOffset: number = 12;
  public static readonly treeScrollStep: number = 8;
  public static readonly treeScrollInterval: number = 16;
  public static readonly treeDropEdge: number = 0.25;
  public static readonly treeShiftDuration: number = 150;
  public static readonly treeShiftEasing: string = "ease-out";
  public static readonly treeMoveKeys: string = "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight";
  public static readonly virtualListEstimate: number = 120;
  public static readonly virtualListPageSize: number = 50;
  public static readonly virtualListCapacity: number = 150;
  public static readonly virtualListOverscan: number = 600;
  public static readonly virtualListPrefetch: number = 400;
  public static readonly virtualListRowAttribute: string = "data-tr-row";
  public static readonly virtualListImageTag: "img" = "img";
  public static readonly virtualListLoading: string = "Loading…";
  public static readonly virtualListFailed: string = "These items couldn't load.";
  public static readonly virtualListRetry: string = "Retry";
  public static readonly virtualListIdPrefix: string = "tr-virtual-list-";
  public static readonly virtualListFollowDistance: number = 120;
  public static readonly virtualListJumpLabel: string = "Jump to latest";
  public static readonly virtualListJumpGlyph: string = "arrow_downward";
  public static readonly virtualListTabbableSelector: string = "a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable=\"true\"]";
  public static readonly configurationTableHeadingLevel: number = 3;
  public static readonly scrollOverflow: RegExp = /auto|scroll/u;
  public static readonly reducedMotionQuery: string = "(prefers-reduced-motion: reduce)";
  public static readonly rightToLeftSelector: string = ":dir(rtl)";

  public static formatLookVariable(name: string): string {
    return `--tr-${name}`;
  }

  public static formatShapeAttribute(control: string): string {
    return `data-tr-${control}-shape`;
  }

  public static formatMissingThemeValue(themeId: string, name: string): string {
    return `The theme "${themeId}" has no value for "${name}".`;
  }

  public static formatTextSizeOutOfRange(parameterName: string, size: number): string {
    return `The ${parameterName} must be from ${Resources.minimumTextSize} to ${Resources.maximumTextSize} CSS pixels; ${size} is outside that range.`;
  }

  public static formatTreeMoved(label: string, parentLabel: string | null, position: number, count: number): string {
    return `Moved ${label} ${Object.isNull(parentLabel) ? "to" : `into ${parentLabel},`} position ${position} of ${count}`;
  }

  public static formatTreeMoveRefused(id: string, parentId: string): string {
    return `The row "${id}" cannot move into "${parentId}": that parent is missing or inside the row.`;
  }

  public static formatVirtualListRowSelector(index: number): string {
    return `[data-tr-row="${index}"] > .tr-virtual-list-row`;
  }

  public static formatVirtualListLabelId(id: string, index: number): string {
    return `${id}-${index}-label`;
  }

  public static formatVirtualListDescriptionId(id: string, index: number): string {
    return `${id}-${index}-description`;
  }

  public static formatTreeRowMissing(id: string): string {
    return `The tree has no row "${id}".`;
  }

  public static formatVirtualListLengthInvalid(length: number): string {
    return `A list's length must be a whole number of 0 or more, not ${length}.`;
  }

  public static formatVirtualListEstimateInvalid(estimate: number): string {
    return `A row's estimated height must be a number of pixels above 0, not ${estimate}.`;
  }

  public static formatVirtualListInsertInvalid(at: number, count: number, length: number): string {
    return `${count} items can't be inserted at ${at} in a list of ${length}; the count must be a whole number of 1 or more and the place from 0 to the length.`;
  }

  public static formatVirtualListRangeInvalid(at: number, count: number, length: number): string {
    return `${count} items from ${at} are not in a list of ${length}; the count must be a whole number of 1 or more and every item inside the list.`;
  }

  public static formatVirtualListReadMismatch(start: number, end: number, count: number): string {
    return `A read of the ${end - start} items from ${start} to ${end - 1} answered ${count}.`;
  }

  public static formatVirtualListHeightInvalid(height: number): string {
    return `A row's height must be a number of pixels of 0 or more, not ${height}.`;
  }

  public static formatBadgeCount(count: number): string {
    return count > Resources.badgeLimit ? Resources.badgeOverflow : String(count);
  }

  public static formatBadged(label: string, badge: string): string {
    return `${label}, ${badge}`;
  }

  public static formatCloseTab(label: string): string {
    return `Close ${label}`;
  }

  public static formatResultCount(count: number): string {
    if (count === 0)
      return "No results";
    return count === 1 ? "1 result" : `${count} results`;
  }
}
