/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AriaLivePoliteness, FocusOrigin } from "@angular/cdk/a11y";

import "@noldova/teamrun-foundation-core";
import { ModuleState, NotificationSeverity } from "@noldova/teamrun-shell-protocol";
import { DockingDirection, OverlaySide } from "@noldova/teamrun-shell-ui";

import { BottomDockSpan } from "./app/enums/bottom-dock-span";
import { DockSide } from "./app/enums/dock-side";
import { EditAction } from "./app/enums/edit-action";
import { PanelEdge } from "./app/enums/panel-edge";
import { SplitAxis } from "./app/enums/split-axis";
import { ToolbarMove } from "./app/enums/toolbar-move";
import { productName } from "../../../generated/product";

export class Resources {
  public static readonly contributionNamePattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly regExpSpecialPattern: RegExp = /[.*+?^${}()|[\]\\]/gu;
  public static readonly windowPartContextToken: string = "The window part's context";
  public static readonly windowPartSourcesToken: string = "The build's window parts";
  public static readonly documentsGroupId: number = 0;
  public static readonly layoutFormatVersion: number = 1;
  public static readonly panelGap: number = 0.25;
  public static readonly panelMargin: number = 0.25;
  public static readonly dockMinimumSize: number = 10;
  public static readonly dockStripSize: number = 2.75;
  public static readonly documentMinimumSize: number = 13.75;
  public static readonly groupMinimumLengths: Readonly<Record<SplitAxis, number>> = {
    [SplitAxis.Horizontal]: 10,
    [SplitAxis.Vertical]: 6.25
  };
  public static readonly defaultDockSizes: Readonly<Record<DockSide, number>> = {
    [DockSide.Left]: 26,
    [DockSide.Right]: 25,
    [DockSide.Bottom]: 16.25
  };
  public static readonly dockEdges: Readonly<Record<DockSide, PanelEdge>> = {
    [DockSide.Left]: PanelEdge.Left,
    [DockSide.Right]: PanelEdge.Right,
    [DockSide.Bottom]: PanelEdge.Bottom
  };
  public static readonly edgeAxes: Readonly<Record<PanelEdge, SplitAxis>> = {
    [PanelEdge.Left]: SplitAxis.Horizontal,
    [PanelEdge.Right]: SplitAxis.Horizontal,
    [PanelEdge.Top]: SplitAxis.Vertical,
    [PanelEdge.Bottom]: SplitAxis.Vertical
  };
  public static readonly leadingEdges: readonly PanelEdge[] = [PanelEdge.Left, PanelEdge.Top];
  public static readonly layoutSaveDelay: number = 500;
  public static readonly unavailableCode: string = "Unavailable";
  public static readonly primaryButton: number = 0;
  public static readonly dragThreshold: number = 4;
  public static readonly escapeKey: string = "Escape";
  public static readonly pointerMoveEvent: "pointermove" = "pointermove";
  public static readonly pointerUpEvent: "pointerup" = "pointerup";
  public static readonly pointerCancelEvent: "pointercancel" = "pointercancel";
  public static readonly keyDownEvent: "keydown" = "keydown";
  public static readonly blurEvent: "blur" = "blur";
  public static readonly draggingClass: string = "tr-tab-dragging";
  public static readonly dropGroupSelector: string = "[data-drop-group]";
  public static readonly dropGroupData: string = "dropGroup";
  public static readonly dropSideSelector: string = "[data-drop-side]";
  public static readonly dropSideData: string = "dropSide";
  public static readonly dropSpanData: string = "dropSpan";
  public static readonly dropTabsSelector: string = "[data-drop-tabs]";
  public static readonly dropPlateSelector: string = "[data-drop-plate]";
  public static readonly directionSelector: string = "[data-direction]";
  public static readonly directionData: string = "direction";
  public static readonly tabIndexSelector: string = "[data-tab-index]";
  public static readonly tabIndexData: string = "tabIndex";
  public static readonly dropBeforeSelector: string = "[data-drop-before]";
  public static readonly dropBeforeData: string = "dropBefore";
  public static readonly dropAfterData: string = "dropAfter";
  public static readonly dropAxisData: string = "dropAxis";
  public static readonly dropTargetSeparator: string = ":";
  public static readonly tabKeySelector: string = "[data-tab-key]";
  public static readonly tabKeyData: string = "tabKey";
  public static readonly tabGroupSelector: string = "tr-tab-group";
  public static readonly tabGroupData: string = "group";
  public static readonly tabCloseSelector: string = ".tr-tab-close";
  public static readonly selectedTabSelector: string = ".tr-tab-selected";
  public static readonly revealOptions: ScrollIntoViewOptions = { block: "nearest", inline: "nearest" };
  public static readonly arrowLeftKey: string = "ArrowLeft";
  public static readonly arrowRightKey: string = "ArrowRight";
  public static readonly homeKey: string = "Home";
  public static readonly endKey: string = "End";
  public static readonly dockingGuideSize: number = 2.5;
  public static readonly sideDirections: Readonly<Record<DockSide, DockingDirection>> = {
    [DockSide.Left]: DockingDirection.Left,
    [DockSide.Right]: DockingDirection.Right,
    [DockSide.Bottom]: DockingDirection.Bottom
  };
  public static readonly edgeDirections: Readonly<Record<PanelEdge, DockingDirection>> = {
    [PanelEdge.Left]: DockingDirection.Left,
    [PanelEdge.Right]: DockingDirection.Right,
    [PanelEdge.Top]: DockingDirection.Top,
    [PanelEdge.Bottom]: DockingDirection.Bottom
  };
  public static readonly dockingPlateGap: number = 0.125;
  public static readonly dockingPlateClearance: number = 0.25;
  public static readonly viewGlyph: string = "web_asset";
  public static readonly documentGlyph: string = "description";
  public static readonly moduleFailureGlyph: string = "error";
  public static readonly copyGlyph: string = "content_copy";
  public static readonly copiedGlyph: string = "check";
  public static readonly logFolderGlyph: string = "folder_open";
  public static readonly panelActionsGlyph: string = "more_horiz";
  public static readonly moveToGlyph: string = "drive_file_move";
  public static readonly splitGlyph: string = "splitscreen";
  public static readonly dockGlyph: string = "dock_to_right";
  public static readonly closeGlyph: string = "close";
  public static readonly closeOthersGlyph: string = "tab_close";
  public static readonly keepGlyph: string = "keep";
  public static readonly closeToTheRightGlyph: string = "tab_close_right";
  public static readonly closeAllGlyph: string = "clear_all";
  public static readonly moveEarlierGlyph: string = "arrow_back";
  public static readonly moveLaterGlyph: string = "arrow_forward";
  public static readonly resetLayoutGlyph: string = "restart_alt";
  public static readonly panelActionsLabel: string = "Panel actions";
  public static readonly overflowGlyph: string = "expand_more";
  public static readonly overflowLabel: string = "Show all tabs";
  public static readonly moveToLabel: string = "Move to";
  public static readonly splitLabel: string = "Split";
  public static readonly dockLabel: string = "Dock";
  public static readonly closeTabLabel: string = "Close";
  public static readonly keepLabel: string = "Keep open";
  public static readonly closeOthersLabel: string = "Close others";
  public static readonly closeToTheRightLabel: string = "Close to the right";
  public static readonly closeAllLabel: string = "Close all";
  public static readonly moveEarlierLabel: string = "Move left";
  public static readonly moveLaterLabel: string = "Move right";
  public static readonly resetLayoutLabel: string = "Reset the layout";
  public static readonly bottomSpanCommands: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "shell.spanBottomDock",
    [BottomDockSpan.Between]: "shell.fitBottomDockBetween"
  };
  public static readonly bottomSpanGlyphs: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "width_full",
    [BottomDockSpan.Between]: "width_normal"
  };
  public static readonly bottomSpanLabels: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "Bottom dock across the window",
    [BottomDockSpan.Between]: "Bottom dock between the side docks"
  };
  public static readonly documentsGroupLabel: string = "Documents";
  public static readonly moveToNextGroupLabel: string = "Move to next group";
  public static readonly moveToPreviousGroupLabel: string = "Move to previous group";
  public static readonly focusNextGroupLabel: string = "Focus next group";
  public static readonly focusPreviousGroupLabel: string = "Focus previous group";
  public static readonly groupLabelJoiner: string = ", ";
  public static readonly splitLabels: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "Split left",
    [PanelEdge.Right]: "Split right",
    [PanelEdge.Top]: "Split up",
    [PanelEdge.Bottom]: "Split down"
  };
  public static readonly splitGlyphs: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "arrow_back",
    [PanelEdge.Right]: "arrow_forward",
    [PanelEdge.Top]: "arrow_upward",
    [PanelEdge.Bottom]: "arrow_downward"
  };
  public static readonly dockRowLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Left dock",
    [DockSide.Right]: "Right dock",
    [DockSide.Bottom]: "Bottom dock"
  };
  public static readonly dockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Dock left",
    [DockSide.Right]: "Dock right",
    [DockSide.Bottom]: "Dock at the bottom"
  };
  public static readonly dockGlyphs: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "dock_to_left",
    [DockSide.Right]: "dock_to_right",
    [DockSide.Bottom]: "dock_to_bottom"
  };
  public static readonly closeTabCommand: string = "shell.closeTab";
  public static readonly keepTabCommand: string = "shell.keepTab";
  public static readonly closeOtherTabsCommand: string = "shell.closeOtherTabs";
  public static readonly closeTabsToTheRightCommand: string = "shell.closeTabsToTheRight";
  public static readonly closeAllTabsCommand: string = "shell.closeAllTabs";
  public static readonly moveTabLeftCommand: string = "shell.moveTabLeft";
  public static readonly moveTabRightCommand: string = "shell.moveTabRight";
  public static readonly resetLayoutCommand: string = "shell.resetLayout";
  public static readonly nextTabCommand: string = "shell.nextTab";
  public static readonly previousTabCommand: string = "shell.previousTab";
  public static readonly openSettingsCommand: string = "shell.openSettings";
  public static readonly openSettingsTitle: string = "Settings…";
  public static readonly showInDialogCommand: string = "shell.showInDialog";
  public static readonly showInDialogTitle: string = "Show in a dialog";
  public static readonly showInDialogGlyph: string = "open_in_full";
  public static readonly dialogAlreadyOpen: string = "A dialog is already open.";
  public static readonly dialogWhileReconnecting: string = "A dialog can't open while the window reconnects to the runtime.";
  public static readonly settingsDocument: string = "shell.settings";
  public static readonly settingsTitle: string = "Settings";
  public static readonly settingsGlyph: string = "settings";
  public static readonly openModulesCommand: string = "shell.openModules";
  public static readonly openModulesTitle: string = "Modules…";
  public static readonly modulesDocument: string = "shell.modules";
  public static readonly modulesTitle: string = "Modules";
  public static readonly modulesGlyph: string = "extension";
  public static readonly modifiedLabel: string = "Modified";
  public static readonly modifiedGlyph: string = "circle";
  public static readonly resetLabel: string = "Reset";
  public static readonly appearancePage: string = "Appearance";
  public static readonly themeSetting: string = "shell.theme";
  public static readonly modeSetting: string = "shell.mode";
  public static readonly interfaceFontSetting: string = "shell.interfaceFont";
  public static readonly codeFontSetting: string = "shell.codeFont";
  public static readonly panelSizeSetting: string = "shell.panelSize";
  public static readonly messageSizeSetting: string = "shell.messageSize";
  public static readonly codeSizeSetting: string = "shell.codeSize";
  public static readonly doNotDisturbSetting: string = "shell.doNotDisturb";
  public static readonly mutedModulesSetting: string = "shell.mutedModules";
  public static readonly keyBindingsSetting: string = "shell.keyBindings";
  public static readonly appearanceUnreadable: string = "The appearance preferences could not be read.";
  public static readonly notificationsPage: string = "Notifications";
  public static readonly shortcutsPage: string = "Keyboard shortcuts";
  public static readonly galleryPage: string = "Gallery";
  public static readonly galleryComponentToken: string = "GalleryComponent";
  public static readonly leadingSettingsPages: readonly string[] = [Resources.appearancePage, Resources.notificationsPage, Resources.shortcutsPage];
  public static readonly searchSettingsLabel: string = "Search settings";
  public static readonly settingsPagesLabel: string = "Settings pages";
  public static readonly noSettingsFound: string = "No settings match your search.";
  public static readonly commandColumn: string = "Command";
  public static readonly ownerColumn: string = "From";
  public static readonly keyColumn: string = "Key";
  public static readonly actionsColumn: string = "Actions";
  public static readonly noKey: string = "No key";
  public static readonly choicePillMinimum: number = 2;
  public static readonly choicePillLimit: number = 4;
  public static readonly settingErrorIdPrefix: string = "tr-setting-error-";
  public static readonly shortcutsExplanation: string = "The keys that run commands. Choose a key to record a new one; your keys apply on every device.";
  public static readonly resetAllShortcutsLabel: string = "Reset all shortcuts";
  public static readonly removeKeyLabel: string = "Remove";
  public static readonly useKeyHereLabel: string = "Use it here";
  public static readonly cancelLabel: string = "Cancel";
  public static readonly recordingHint: string = "Press the new key";
  public static readonly recordingEllipsis: string = "…";
  public static readonly unknownKeyRefused: string = "This key can't be part of a shortcut.";
  public static readonly typingKeyRefused: string = "A key needs Ctrl, Alt or a function key.";
  public static readonly macTypingKeyRefused: string = "A key needs Command, Control, Option or a function key.";
  public static readonly windowsKeyRefused: string = "The Windows key can't be part of a shortcut.";
  public static readonly superKeyRefused: string = "The Super key can't be part of a shortcut.";
  public static readonly windowsPlatform: string = "win32";
  public static readonly modifierKeys: readonly string[] = ["Control", "Shift", "Alt", "AltGraph", "Meta", "OS"];
  public static readonly macModifierSymbols: readonly string[] = ["⌃", "⌥", "⇧", "⌘"];
  public static readonly modifierNames: readonly string[] = ["Ctrl", "Alt", "Shift"];
  public static readonly modifierSeparator: string = "+";
  public static readonly tabKey: string = "Tab";
  public static readonly showAllTabsCommand: string = "shell.showAllTabs";
  public static readonly splitTabCommands: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "shell.splitTabLeft",
    [PanelEdge.Right]: "shell.splitTabRight",
    [PanelEdge.Top]: "shell.splitTabUp",
    [PanelEdge.Bottom]: "shell.splitTabDown"
  };
  public static readonly dockTabCommands: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "shell.dockTabLeft",
    [DockSide.Right]: "shell.dockTabRight",
    [DockSide.Bottom]: "shell.dockTabBottom"
  };
  public static readonly toggleDockCommands: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "shell.toggleLeftDock",
    [DockSide.Right]: "shell.toggleRightDock",
    [DockSide.Bottom]: "shell.toggleBottomDock"
  };
  public static readonly closeTabTitle: string = "Close the tab";
  public static readonly keepTabTitle: string = "Keep the tab open";
  public static readonly closeOtherTabsTitle: string = "Close the other tabs";
  public static readonly closeTabsToTheRightTitle: string = "Close the tabs to the right";
  public static readonly closeAllTabsTitle: string = "Close all tabs in the group";
  public static readonly moveTabLeftTitle: string = "Move the tab left";
  public static readonly moveTabRightTitle: string = "Move the tab right";
  public static readonly nextTabTitle: string = "Show the next tab";
  public static readonly previousTabTitle: string = "Show the previous tab";
  public static readonly nextTabGlyph: string = "keyboard_tab";
  public static readonly previousTabGlyph: string = "keyboard_tab_rtl";
  public static readonly splitTabTitles: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "Split the tab left",
    [PanelEdge.Right]: "Split the tab right",
    [PanelEdge.Top]: "Split the tab up",
    [PanelEdge.Bottom]: "Split the tab down"
  };
  public static readonly dockTabTitles: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Dock the tab left",
    [DockSide.Right]: "Dock the tab right",
    [DockSide.Bottom]: "Dock the tab at the bottom"
  };
  public static readonly toggleDockTitles: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Show or hide the left dock",
    [DockSide.Right]: "Show or hide the right dock",
    [DockSide.Bottom]: "Show or hide the bottom dock"
  };
  public static readonly tabArgument: string = "tab";
  public static readonly showCommandsCommand: string = "shell.showCommands";
  public static readonly showCommandsTitle: string = "Show all commands";
  public static readonly showCommandsGlyph: string = "search";
  public static readonly shellKeys: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["shell.showCommands", ["Mod+Shift+P"], ["Mod+Shift+P"]],
    ["shell.openSettings", ["Mod+Comma"], ["Mod+Comma"]],
    ["shell.closeTab", ["Mod+W"], ["Mod+W"]],
    ["shell.nextTab", ["Ctrl+Tab", "Ctrl+PageDown"], ["Ctrl+Tab", "Mod+Alt+ArrowRight"]],
    ["shell.previousTab", ["Ctrl+Shift+Tab", "Ctrl+PageUp"], ["Ctrl+Shift+Tab", "Mod+Alt+ArrowLeft"]],
    ["shell.toggleLeftDock", ["Mod+B"], ["Mod+B"]],
    ["shell.toggleBottomDock", ["Mod+J"], ["Mod+J"]],
    ["shell.toggleRightDock", ["Mod+Alt+B"], ["Mod+Alt+B"]]
  ];
  public static readonly commandSearchLabel: string = "Search commands";
  public static readonly commandSearchPaneClass: string = "tr-command-search-pane";
  public static readonly windowRowSelector: string = "tr-window-row";
  public static readonly detailSeparator: string = " ";
  public static readonly keyboardFocusOrigin: FocusOrigin = "keyboard";
  public static readonly mouseFocusOrigin: FocusOrigin = "mouse";
  public static readonly hideDockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Hide the left dock",
    [DockSide.Right]: "Hide the right dock",
    [DockSide.Bottom]: "Hide the bottom dock"
  };
  public static readonly dockStripSelector: string = ".tr-dock-strip";
  public static readonly horizontalOrientation: string = "horizontal";
  public static readonly regionRole: string = "region";
  public static readonly tabPanelRole: string = "tabpanel";
  public static readonly verticalOrientation: string = "vertical";
  public static readonly rightToLeft: string = "rtl";
  public static readonly previewTabsSetting: string = "shell.previewTabs";
  public static readonly dockStyleSettings: ReadonlyMap<DockSide, string> = new Map([[DockSide.Left, "shell.leftDockStyle"], [DockSide.Right, "shell.rightDockStyle"]]);
  public static readonly dockStripLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Left dock views",
    [DockSide.Right]: "Right dock views",
    [DockSide.Bottom]: "Bottom dock views"
  };
  public static readonly dockStripTooltipSides: Readonly<Record<DockSide, OverlaySide>> = {
    [DockSide.Left]: OverlaySide.end,
    [DockSide.Right]: OverlaySide.start,
    [DockSide.Bottom]: OverlaySide.above
  };
  public static readonly hideDockGlyphs: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "left_panel_close",
    [DockSide.Right]: "right_panel_close",
    [DockSide.Bottom]: "bottom_panel_close"
  };
  public static readonly resizeDockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Resize the left dock",
    [DockSide.Right]: "Resize the right dock",
    [DockSide.Bottom]: "Resize the bottom dock"
  };
  public static readonly tabIdPrefix: string = "tr-tab-";
  public static readonly tabIdSeparator: string = "-";
  public static readonly tabPanelIdPrefix: string = "tr-tab-panel-";
  public static readonly resizeSplitLabels: Readonly<Record<SplitAxis, string>> = {
    [SplitAxis.Horizontal]: "Resize the pane on the left",
    [SplitAxis.Vertical]: "Resize the pane above"
  };
  public static readonly versionField: string = "version";
  public static readonly docksField: string = "docks";
  public static readonly middleField: string = "middle";
  public static readonly rootField: string = "root";
  public static readonly sizeField: string = "size";
  public static readonly collapsedField: string = "collapsed";
  public static readonly bottomSpanField: string = "bottomSpan";
  public static readonly toolbarsField: string = "toolbars";
  public static readonly hiddenField: string = "hidden";
  public static readonly rowsParameter: string = "rows";
  public static readonly invalidToolbarLayout: string = "A toolbar arrangement names each toolbar once and has no empty row.";
  public static readonly axisField: string = "axis";
  public static readonly childrenField: string = "children";
  public static readonly weightField: string = "weight";
  public static readonly tabsField: string = "tabs";
  public static readonly activeField: string = "active";
  public static readonly previewField: string = "preview";
  public static readonly documentsField: string = "documents";
  public static readonly activeDocumentsField: string = "activeDocuments";
  public static readonly viewField: string = "view";
  public static readonly documentField: string = "document";
  public static readonly instanceField: string = "instance";
  public static readonly keySeparator: string = "/";
  public static readonly shellOwner: string = "shell";
  public static readonly contributionSeparator: string = ".";
  public static readonly nameParameter: string = "name";
  public static readonly titleParameter: string = "title";
  public static readonly iconParameter: string = "icon";
  public static readonly countParameter: string = "count";
  public static readonly descriptionParameter: string = "description";
  public static readonly badgeCountInvalid: string = "A badge's count must be a whole number from 1, or null for a dot.";
  public static readonly textParameter: string = "text";
  public static readonly tooltipParameter: string = "tooltip";
  public static readonly commandParameter: string = "command";
  public static readonly viewKind: string = "view";
  public static readonly documentKind: string = "document";
  public static readonly statusBarItemKind: string = "status bar item";
  public static readonly dynamicMenuGroupKind: string = "dynamic menu group";
  public static readonly topBarActionKind: string = "top bar action";
  public static readonly notificationKind: string = "notification kind";
  public static readonly statusBarItemEmpty: string = "A status bar item shows text, an icon or both.";
  public static readonly statusBarItemUnnamed: string = "A status bar item that shows only an icon needs a tooltip, which is also its accessible name.";
  public static readonly defaultKeyParameter: string = "defaultKey";
  public static readonly submenuParameter: string = "submenu";
  public static readonly placeParameter: string = "place";
  public static readonly itemsParameter: string = "items";
  public static readonly emptyMenuGroup: string = "A menu group has at least one item.";
  public static readonly itemsInDynamicGroup: string = "A dynamic menu group has no declared items; its owner supplies them.";
  public static readonly labelParameter: string = "label";
  public static readonly placesField: string = "places";
  public static readonly groupsField: string = "groups";
  public static readonly nameField: string = "name";
  public static readonly titleField: string = "title";
  public static readonly showsField: string = "shows";
  public static readonly shownField: string = "shown";
  public static readonly afterField: string = "after";
  public static readonly beforeField: string = "before";
  public static readonly newRowField: string = "newRow";
  public static readonly dynamicField: string = "dynamic";
  public static readonly choiceField: string = "choice";
  public static readonly showsMenuBar: string = "menuBar";
  public static readonly showsToolbar: string = "toolbar";
  public static readonly afterParameter: string = "after";
  public static readonly choiceParameter: string = "choice";
  public static readonly severalToolbarPositions: string = "A toolbar has at most one of a place after another, a place before another and a row of its own.";
  public static readonly placeField: string = "place";
  public static readonly exclusiveField: string = "exclusive";
  public static readonly itemsField: string = "items";
  public static readonly submenuField: string = "submenu";
  public static readonly commandField: string = "command";
  public static readonly argumentsField: string = "arguments";
  public static readonly menusField: string = "menus";
  public static readonly rowsField: string = "rows";
  public static readonly typeField: string = "type";
  public static readonly idField: string = "id";
  public static readonly labelField: string = "label";
  public static readonly keyField: string = "key";
  public static readonly enabledField: string = "enabled";
  public static readonly checkField: string = "check";
  public static readonly checkedField: string = "checked";
  public static readonly commandRowType: string = "command";
  public static readonly submenuRowType: string = "submenu";
  public static readonly separatorRowType: string = "separator";
  public static readonly menuRowPathSeparator: string = "/";
  public static readonly menuTitleSeparator: string = " › ";
  public static readonly menuGlyph: string = "menu";
  public static readonly focusInEvent: string = "focusin";
  public static readonly focusOutEvent: string = "focusout";
  public static readonly transientFocusSelector: string = ".cdk-overlay-container, [data-tr-chrome]";
  public static readonly textInputTypes: readonly string[] = ["text", "search", "url", "tel", "password", "email", "number"];
  public static readonly editingGroup: string = "shell.editing";
  public static readonly editCommands: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "shell.undo",
    [EditAction.Redo]: "shell.redo",
    [EditAction.Cut]: "shell.cut",
    [EditAction.Copy]: "shell.copy",
    [EditAction.Paste]: "shell.paste",
    [EditAction.SelectAll]: "shell.selectAll"
  };
  public static readonly modalCommands: readonly string[] = Object.values(Resources.editCommands);
  public static readonly editTitles: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "Undo",
    [EditAction.Redo]: "Redo",
    [EditAction.Cut]: "Cut",
    [EditAction.Copy]: "Copy",
    [EditAction.Paste]: "Paste",
    [EditAction.SelectAll]: "Select all"
  };
  public static readonly editGlyphs: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "undo",
    [EditAction.Redo]: "redo",
    [EditAction.Cut]: "content_cut",
    [EditAction.Copy]: "content_copy",
    [EditAction.Paste]: "content_paste",
    [EditAction.SelectAll]: "select_all"
  };
  public static readonly menuLabel: string = "Menu";
  public static readonly menuBarLabel: string = "Menus";
  public static readonly menuBarSetting: string = "shell.menuBar";
  public static readonly menuBarItemSelector: string = "[tr-menu-bar-item]";
  public static readonly windowRowMinimumDragWidth: number = 96;
  public static readonly altKey: string = "Alt";
  public static readonly functionKey: string = "F10";
  public static readonly ariaExpandedAttribute: string = "aria-expanded";
  public static readonly trueValue: string = "true";
  public static readonly fileMenu: string = "shell.file";
  public static readonly editMenu: string = "shell.edit";
  public static readonly viewMenu: string = "shell.view";
  public static readonly windowMenu: string = "shell.window";
  public static readonly helpMenu: string = "shell.help";
  public static readonly tabMenu: string = "shell.tab";
  public static readonly fileMenuTitle: string = "File";
  public static readonly editMenuTitle: string = "Edit";
  public static readonly viewMenuTitle: string = "View";
  public static readonly windowMenuTitle: string = "Window";
  public static readonly helpMenuTitle: string = "Help";
  public static readonly tabMenuTitle: string = "Tab";
  public static readonly closeGroup: string = "shell.close";
  public static readonly tabMoveToMenu: string = "shell.tabMoveTo";
  public static readonly tabSplitMenu: string = "shell.tabSplit";
  public static readonly tabDockMenu: string = "shell.tabDock";
  public static readonly tabArrangeGroup: string = "shell.tabArrange";
  public static readonly tabCloseGroup: string = "shell.tabClose";
  public static readonly tabDestinationsGroup: string = "shell.tabDestinations";
  public static readonly tabSplitGroup: string = "shell.tabSplitEdges";
  public static readonly tabDockGroup: string = "shell.tabDockSides";
  public static readonly moveTabToGroupCommand: string = "shell.moveTabToGroup";
  public static readonly moveTabToNextGroupCommand: string = "shell.moveTabToNextGroup";
  public static readonly moveTabToPreviousGroupCommand: string = "shell.moveTabToPreviousGroup";
  public static readonly moveTabToNextGroupTitle: string = "Move the tab to the next group";
  public static readonly moveTabToPreviousGroupTitle: string = "Move the tab to the previous group";
  public static readonly focusNextGroupCommand: string = "shell.focusNextGroup";
  public static readonly focusPreviousGroupCommand: string = "shell.focusPreviousGroup";
  public static readonly focusNextGroupTitle: string = "Focus the next group";
  public static readonly focusPreviousGroupTitle: string = "Focus the previous group";
  public static readonly focusNextGroupGlyph: string = "keyboard_double_arrow_right";
  public static readonly focusPreviousGroupGlyph: string = "keyboard_double_arrow_left";
  public static readonly groupsGroup: string = "shell.groups";
  public static readonly moveTabToGroupTitle: string = "Move the tab to another group";
  public static readonly groupArgument: string = "group";
  public static readonly searchGroup: string = "shell.search";
  public static readonly docksGroup: string = "shell.docks";
  public static readonly bottomDockGroup: string = "shell.bottomDock";
  public static readonly layoutGroup: string = "shell.layout";
  public static readonly modulesGroup: string = "shell.modules";
  public static readonly toolbarsMenu: string = "shell.toolbars";
  public static readonly toolbarsMenuTitle: string = "Toolbars";
  public static readonly noPlace: string = "";
  public static readonly toolbarListGroup: string = "shell.toolbarList";
  public static readonly viewToolbarsGroup: string = "shell.viewToolbars";
  public static readonly toggleToolbarCommand: string = "shell.toggleToolbar";
  public static readonly toggleToolbarTitle: string = "Show or hide a toolbar";
  public static readonly toolbarArgument: string = "toolbar";
  public static readonly focusToolbarsCommand: string = "shell.focusToolbars";
  public static readonly focusToolbarsTitle: string = "Focus the toolbars";
  public static readonly focusToolbarsGlyph: string = "toolbar";
  public static readonly toolbarItemSelector: string = ".tr-toolbar-item[tabindex=\"0\"]";
  public static readonly toolbarSectionSelector: string = ".tr-toolbar-ghost-section";
  public static readonly toolbarOverflowSelector: string = ".tr-toolbar-ghost-overflow";
  public static readonly toolbarFitTolerance: number = 0.5;
  public static readonly toolbarEdgeFraction: number = 4;
  public static readonly toolbarBandSelector: string = ".tr-toolbar-band";
  public static readonly toolbarRowSelector: string = ".tr-toolbar-row";
  public static readonly toolbarSelector: string = ".tr-toolbar[data-toolbar]";
  public static readonly toolbarData: string = "toolbar";
  public static readonly toolbarRowData: string = "toolbarRow";
  public static readonly toolbarIndexData: string = "toolbarIndex";
  public static readonly toolbarOverflowLabel: string = "More actions";
  public static readonly toolbarOverflowGlyph: string = "more_horiz";
  public static readonly toolbarGripLabel: string = "Move toolbar";
  public static readonly toolbarMenu: string = "shell.toolbar";
  public static readonly toolbarMenuTitle: string = "Toolbar";
  public static readonly toolbarMoveGroup: string = "shell.toolbarMove";
  public static readonly toolbarHideGroup: string = "shell.toolbarHide";
  public static readonly moveToolbarCommands: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "shell.moveToolbarLeft",
    [ToolbarMove.Right]: "shell.moveToolbarRight",
    [ToolbarMove.Up]: "shell.moveToolbarUp",
    [ToolbarMove.Down]: "shell.moveToolbarDown"
  };
  public static readonly moveToolbarTitles: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "Move the toolbar left",
    [ToolbarMove.Right]: "Move the toolbar right",
    [ToolbarMove.Up]: "Move the toolbar to the row above",
    [ToolbarMove.Down]: "Move the toolbar to the row below"
  };
  public static readonly moveToolbarLabels: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "Move left",
    [ToolbarMove.Right]: "Move right",
    [ToolbarMove.Up]: "Move to the row above",
    [ToolbarMove.Down]: "Move to the row below"
  };
  public static readonly moveToolbarGlyphs: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "arrow_back",
    [ToolbarMove.Right]: "arrow_forward",
    [ToolbarMove.Up]: "arrow_upward",
    [ToolbarMove.Down]: "arrow_downward"
  };
  public static readonly hideToolbarGlyph: string = "visibility_off";
  public static readonly hideToolbarCommand: string = "shell.hideToolbar";
  public static readonly hideToolbarTitle: string = "Hide the toolbar";
  public static readonly hideToolbarLabel: string = "Hide toolbar";
  public static readonly toolbarGripSelector: string = ".tr-toolbar-grip";
  public static readonly commandSearchButtonSelector: string = ".tr-window-row-search";
  public static readonly toolbarsSubmenuGroup: string = "shell.toolbarsSubmenu";
  public static readonly toolbarContentSectionSelector: string = ".tr-toolbar-section";
  public static readonly toolbarOverflowItemSelector: string = ".tr-toolbar-overflow";
  public static readonly toolbarGroupData: string = "group";
  public static readonly focusedSelector: string = ":focus";
  public static readonly toolbarMenuKey: string = "ContextMenu";
  public static readonly toolbarMenuShiftKey: string = "F10";
  public static readonly settingsGroup: string = "shell.settings";
  public static readonly windowPartMenusToken: string = "The build's module menus";
  public static readonly placeInput: string = "place";
  public static readonly contextInput: string = "context";
  public static readonly invalidContributionName: string = "A contribution name has the form <module id>.<name>.";
  public static readonly invalidModuleId: string = "A module id is lowercase kebab-case.";
  public static readonly windowPartLoadFailed: string = "Its window part could not be loaded.";
  public static readonly windowPartActivationFailed: string = "Its window part failed to activate.";
  public static readonly windowLogLimit: number = 65536;
  public static readonly causeSeparator: string = "\nCaused by: ";
  public static readonly invalidInstance: string = "An instance is a string that is not blank.";
  public static readonly invalidBounds: string = "Bounds need finite coordinates and a width and height that are not negative.";
  public static readonly invalidSize: string = "A size is a finite number of rem.";
  public static readonly invalidSplit: string = "A split has at least two children, one finite weight that is not negative for each and a positive total.";
  public static readonly emptyViewGroup: string = "A group of views has at least one tab.";
  public static readonly repeatedTab: string = "A tab appears only once in a layout.";
  public static readonly inactiveTab: string = "The active tab must be one of the group's tabs, and a group with tabs has one.";
  public static readonly previewOutsideGroup: string = "The preview tab must be one of the group's tabs.";
  public static readonly documentOutsideDocuments: string = "Document tabs stay in document groups.";
  public static readonly missingDocumentsGroup: string = "The middle holds at least one document group.";
  public static readonly documentsInDock: string = "Document groups stay in the middle.";
  public static readonly repeatedDock: string = "A layout has one dock for each side.";
  public static readonly repeatedNodeId: string = "Each group and split in a layout has its own id.";
  public static readonly repeatedViewType: string = "A view or document type is registered once.";
  public static readonly unknownTab: string = "A tab names a view or a document.";
  public static readonly invalidLayoutPart: string = "The value does not describe a valid part of a layout.";
  public static readonly unknownNode: string = "A node is a split, with children, or a group, with tabs.";
  public static readonly productName: string = productName;
  public static readonly appMenu: string = "shell.app";
  public static readonly appMenuTitle: string = Resources.productName;
  public static readonly noModules: string = "No modules";
  public static readonly copyDetailsLabel: string = "Copy details";
  public static readonly copiedLabel: string = "Copied";
  public static readonly openLogFolderLabel: string = "Open log folder";
  public static readonly logFolderNotOpened: string = "The log folder could not be opened.";
  public static readonly copiedDuration: number = 2000;
  public static readonly detailsSeparator: string = "\n";
  public static readonly moduleStateLabels: Readonly<Record<ModuleState, string>> = {
    [ModuleState.Active]: "Active",
    [ModuleState.Failed]: "Failed",
    [ModuleState.Blocked]: "Blocked"
  };
  public static readonly moduleStateTitle: string = "State";
  public static readonly blockedByTitle: string = "Blocked by";
  public static readonly dependenciesTitle: string = "Depends on";
  public static readonly dependentsTitle: string = "Needed by";
  public static readonly noModulesNamed: string = "None";
  public static readonly contributionsTitle: string = "Contributes";
  public static readonly noContributions: string = "No commands, settings, menus, views or notification kinds.";
  public static readonly commandsKind: string = "commands";
  public static readonly settingsKind: string = "settings";
  public static readonly moduleContributionKinds: readonly (readonly [string, string])[] = [
    [Resources.commandsKind, "Commands"],
    [Resources.settingsKind, "Settings"],
    ["menus", "Menus"],
    ["views", "Views"],
    ["notifications", "Notification kinds"]
  ];
  public static readonly moduleSelector: string = "[data-module]";
  public static readonly moduleData: string = "module";
  public static readonly bridgeName: string = "teamrun";
  public static readonly macPlatform: string = "darwin";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly kindField: string = "kind";
  public static readonly productVersionField: string = "productVersion";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly detailsField: string = "details";
  public static readonly payloadField: string = "payload";
  public static readonly failureField: string = "failure";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly unknownStartupState: string = "The startup state is not one the window knows.";
  public static readonly moveAsideAction: string = "moveAside";
  public static readonly waitAction: string = "wait";
  public static readonly stopWorkAction: string = "stopWork";
  public static readonly retryAction: string = "retry";
  public static readonly startingTitle: string = `Starting ${Resources.productName}…`;
  public static readonly preShellDataTitle: string = `Data from an earlier ${Resources.productName}`;
  public static readonly preShellDataText: string =
    `This release does not open data that an earlier ${Resources.productName} wrote. Moving it aside keeps all of it in a new folder beside it, ` +
    `changes and deletes nothing, and starts ${Resources.productName} with an empty data folder.`;
  public static readonly moveAside: string = "Move aside";
  public static readonly workInProgressTitle: string = `An older ${Resources.productName} is still working`;
  public static readonly workInProgressText: string = `This ${Resources.productName} replaces it. Wait for this work to finish, or stop it now.`;
  public static readonly waitForWork: string = "Wait for it";
  public static readonly stopWork: string = "Stop the work";
  public static readonly waitingTitle: string = `Waiting for the older ${Resources.productName}`;
  public static readonly waitingText: string = `${Resources.productName} starts when this work finishes.`;
  public static readonly newerBuildTitle: string = `A newer ${Resources.productName} is running`;
  public static readonly failedTitle: string = `${Resources.productName} could not start`;
  public static readonly tryAgain: string = "Try again";
  public static readonly missingBridge: string = "The window needs the desktop's bridge, which the preload provides.";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly isWaitingField: string = "isWaiting";
  public static readonly quitTitle: string = "Work is still running";
  public static readonly quitText: string = `${Resources.productName} is still working on:`;
  public static readonly quitHint: string = "Wait for it to finish, or stop it now.";
  public static readonly quitWaitingTitle: string = "Waiting for the work to finish";
  public static readonly quitWaitingText: string = `${Resources.productName} quits when this work finishes:`;
  public static readonly waitThenQuit: string = "Wait, then quit";
  public static readonly stopWorkAndQuit: string = "Stop the work and quit";
  public static readonly cancel: string = "Cancel";
  public static readonly quitListLimit: number = 5;
  public static readonly waitFocusSelector: string = "[data-tr-quit=Wait]";
  public static readonly cancelReference: string = "cancel";

  public static formatMoreWork(count: number): string {
    return `and ${count} more`;
  }

  public static formatModulesDidNotStart(count: number): string {
    return count === 1 ? "1 module didn't start" : `${count} modules didn't start`;
  }

  public static formatModuleDidNotStart(displayName: string): string {
    return `${displayName} didn't start`;
  }

  public static formatProductVersion(productVersion: string): string {
    return `${Resources.productName} ${productVersion}`;
  }

  public static formatBuildDetails(productVersion: string, fingerprint: string): string {
    return `${Resources.productName} ${productVersion}, build ${fingerprint}`;
  }

  public static formatModuleDetails(moduleId: string, state: string, cause: string | null): string {
    return Object.isNull(cause) ? `${moduleId}: ${state}` : `${moduleId}: ${state}: ${cause}`;
  }

  public static formatModuleBlocked(dependency: string): string {
    return `It depends on ${dependency}, which is not active.`;
  }

  public static formatForeignContribution(moduleId: string, name: string): string {
    return `The module ${moduleId} may contribute only names of its own, not ${name}.`;
  }

  public static formatCommandNotFound(name: string): string {
    return `No command named ${name} is registered; its module may not be active.`;
  }

  public static formatUndeclaredCommand(moduleId: string, name: string): string {
    return `The module ${moduleId} does not declare the command ${name}.`;
  }

  public static readonly notificationsGlyph: string = "notifications";
  public static readonly notificationsOffGlyph: string = "notifications_off";
  public static readonly notificationsTitle: string = "Notifications";
  public static readonly clearAllLabel: string = "Clear all";
  public static readonly doNotDisturbLabel: string = "Do not disturb";
  public static readonly noNotifications: string = "No notifications";
  public static readonly dismissLabel: string = "Dismiss";
  public static readonly unreadLimit: number = 9;
  public static readonly toastLimit: number = 3;
  public static readonly politeAnnouncement: AriaLivePoliteness = "polite";
  public static readonly assertiveAnnouncement: AriaLivePoliteness = "assertive";
  public static readonly announcementSeparator: string = ". ";
  public static readonly hoverSelector: string = ":hover";
  public static readonly toastDuration: number = 8000;
  public static readonly toastKindInterval: number = 5000;
  public static readonly closeToastLabel: string = "Close";
  public static readonly severityGlyphs: Readonly<Record<NotificationSeverity, string>> = {
    [NotificationSeverity.Info]: "info",
    [NotificationSeverity.Success]: "check_circle",
    [NotificationSeverity.Warning]: "warning",
    [NotificationSeverity.Error]: "error"
  };
  public static readonly severityNames: Readonly<Record<NotificationSeverity, string>> = {
    [NotificationSeverity.Info]: "Information",
    [NotificationSeverity.Success]: "Success",
    [NotificationSeverity.Warning]: "Warning",
    [NotificationSeverity.Error]: "Error"
  };

  public static formatUnreadCount(count: number): string {
    return count > Resources.unreadLimit ? `${Resources.unreadLimit}+` : String(count);
  }

  public static formatNotificationsLabel(unread: number, isQuiet: boolean): string {
    const state = isQuiet ? ", Do not disturb" : "";
    return unread === 0 ? `Notifications${state}` : `Notifications, ${unread} unread${state}`;
  }

  public static formatDocumentsGroup(position: number): string {
    return `${Resources.documentsGroupLabel} ${position}`;
  }

  public static formatBadged(label: string, badge: string): string {
    return `${label}, ${badge}`;
  }

  public static formatUndeclaredContribution(moduleId: string, kind: string, name: string): string {
    return `The module ${moduleId} does not declare the ${kind} ${name}.`;
  }

  public static formatContributionRegistered(kind: string, name: string): string {
    return `The ${kind} ${name} is already registered.`;
  }

  public static formatCommandRegistered(name: string): string {
    return `The command ${name} is already registered.`;
  }

  public static formatForeignMenu(place: string): string {
    return `A module may open only its own menus and those of the modules it depends on, not ${place}.`;
  }

  public static formatForeignName(moduleId: string, name: string): string {
    return `The module ${moduleId} may use only its own methods and events and those of the modules it depends on, not ${name}.`;
  }

  public static formatNewerBuild(version: string): string {
    return `${Resources.productName} ${version} is using this data folder. Use that ${Resources.productName} instead.`;
  }

  public static formatUnregisteredView(name: string): string {
    return `No view named "${name}" is registered.`;
  }

  public static formatUnsupportedVersion(version: number): string {
    return `Layout format version ${version} is not supported; this build reads version ${Resources.layoutFormatVersion}.`;
  }

  public static formatModuleNotifications(displayName: string): string {
    return `${displayName} notifications`;
  }

  public static formatResetLabel(title: string): string {
    return `Reset ${title}`;
  }

  public static formatNumberRange(minimum: number | null, maximum: number | null, step: number | null): string {
    return step === 1 ? `Enter a whole number from ${minimum} to ${maximum}.` : `Enter a number from ${minimum} to ${maximum} in steps of ${step}.`;
  }

  public static formatKeyTaken(key: string, keptBy: string): string {
    return `${key} is taken by ${keptBy}`;
  }

  public static formatKeyUsed(key: string, holder: string): string {
    return `${key} is used by ${holder}`;
  }

  public static formatKeyReserved(key: string, owner: string): string {
    return `${key} belongs to ${owner}`;
  }

  public static formatChangeKeyLabel(title: string, key: string): string {
    return `Change the key of ${title}, now ${key}`;
  }

  public static formatRecordingLabel(title: string, hint: string): string {
    return `${hint} for ${title}`;
  }

  public static formatRemoveKeyLabel(title: string): string {
    return `Remove the key of ${title}`;
  }

  public static formatForeignDocument(moduleId: string, name: string): string {
    return `The module "${moduleId}" can open only its own documents, not "${name}".`;
  }

  public static formatUnregisteredDocument(name: string): string {
    return `No document named "${name}" is registered.`;
  }

  public static formatDraggedTab(label: string): string {
    return `Moving ${label}`;
  }
}
