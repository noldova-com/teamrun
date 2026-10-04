/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { FocusOrigin } from "@angular/cdk/a11y";

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
    "border-width",
    "shadow-large",
    "shadow-xlarge",
    "backdrop",
    "panel-card-gap",
    "tab-height",
    "tab-pill",
    "tab-inset",
    "tab-max-width",
    "scrollbar-size",
    "tab-label-inset",
    "tab-action-allowance",
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
    "menu-padding",
    "menu-label-padding",
    "menu-item-height",
    "menu-item-inset",
    "menu-item-padding",
    "menu-trail-gap",
    "toolbar-row",
    "toolbar-button",
    "toolbar-button-padding",
    "toolbar-gap",
    "menu-separator-spacing",
    "tooltip-width",
    "tooltip-padding",
    "popover-width",
    "dialog-width",
    "dialog-title-padding",
    "dialog-body-padding",
    "dialog-actions-padding",
    "quick-input-width",
    "quick-input-margin",
    "quick-input-padding",
    "quick-input-gap",
    "field-height",
    "field-padding",
    "window-row-height",
    "status-bar-height",
    "status-bar-inset",
    "status-bar-item-padding",
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
    "settings-search-width",
    "settings-pages-width",
    "settings-content-width",
    "dropdown-padding",
    "dropdown-row-height",
    "dropdown-row-padding",
    "settings-item-padding",
    "settings-item-description-gap",
    "settings-item-control-gap",
    "settings-heading-space",
    "settings-heading-inset"
  ];
  public static readonly shapes: ReadonlyMap<string, readonly string[]> = new Map([["tab", ["pill"]]]);
  public static readonly defaultThemeId: string = "shell.default";
  public static readonly defaultThemeName: string = "Default";
  public static readonly colorSchemeProperty: string = "color-scheme";
  public static readonly lightScheme: string = "light";
  public static readonly darkScheme: string = "dark";
  public static readonly darkSchemeQuery: string = "(prefers-color-scheme: dark)";
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
  public static readonly keyboardFocusOrigin: FocusOrigin = "keyboard";
  public static readonly mouseFocusOrigin: FocusOrigin = "mouse";
  public static readonly menuPaneClass: string = "tr-menu-pane";
  public static readonly popoverClass: string = "tr-popover";
  public static readonly popoverPaneClass: string = "tr-popover-pane";
  public static readonly dialogPaneClass: string = "tr-dialog-pane";
  public static readonly dialogBackdropClass: string = "tr-dialog-backdrop";
  public static readonly dialogTitleIdPrefix: string = "tr-dialog-title-";
  public static readonly dialogTitleIdToken: string = "tr-dialog-title-id";
  public static readonly noLimit: string = "none";
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
  public static readonly quickInputListSelector: string = ".tr-quick-input-list";
  public static readonly quickInputOptionSelector: string = "[role=option]";
  public static readonly revealOptions: ScrollIntoViewOptions = { block: "nearest" };
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
  public static readonly selectGlyph: string = "expand_more";
  public static readonly menuItemRole: string = "menuitem";
  public static readonly menuItemRadioRole: string = "menuitemradio";
  public static readonly menuItemCheckboxRole: string = "menuitemcheckbox";
  public static readonly contextMenuKey: string = "ContextMenu";
  public static readonly menuKey: string = "F10";
  public static readonly clickEvent: string = "click";
  public static readonly auxclickEvent: string = "auxclick";
  public static readonly mouseenterEvent: "mouseenter" = "mouseenter";
  public static readonly pointermoveEvent: "pointermove" = "pointermove";
  public static readonly hoverSelector: string = ":hover";
  public static readonly secondaryButton: number = 2;
  public static readonly truncationSelector: string = "[data-truncates]";
  public static readonly chromeAttribute: string = "data-tr-chrome";
  public static readonly chromeSelector: string = "[data-tr-chrome]";
  public static readonly topChrome: string = "top";
  public static readonly bottomChrome: string = "bottom";
  public static readonly overlayGapLook: string = "space-2";
  public static readonly windowRowLook: string = "window-row-height";
  public static readonly statusBarLook: string = "status-bar-height";
  public static readonly middleButton: number = 1;
  public static readonly primaryButton: number = 0;

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
