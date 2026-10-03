/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ModuleState } from "@noldova/teamrun-shell-protocol";
import { DockingDirection, OverlaySide } from "@noldova/teamrun-shell-ui";

import { DockSide } from "./app/enums/dock-side";
import { PanelEdge } from "./app/enums/panel-edge";
import { SplitAxis } from "./app/enums/split-axis";
import { productName } from "../../../generated/product";

export class Resources {
  public static readonly contributionNamePattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
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
  public static readonly popoverPaneClass: string = "tr-popover-pane";
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
  public static readonly dropTabsSelector: string = "[data-drop-tabs]";
  public static readonly dropPlateSelector: string = "[data-drop-plate]";
  public static readonly directionSelector: string = "[data-direction]";
  public static readonly directionData: string = "direction";
  public static readonly tabIndexSelector: string = "[data-tab-index]";
  public static readonly tabIndexData: string = "tabIndex";
  public static readonly tabKeySelector: string = "[data-tab-key]";
  public static readonly tabKeyData: string = "tabKey";
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
  public static readonly documentsGroupLabel: string = "Documents";
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
  public static readonly hideDockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Hide the left dock",
    [DockSide.Right]: "Hide the right dock",
    [DockSide.Bottom]: "Hide the bottom dock"
  };
  public static readonly dockStripSelector: string = ".tr-dock-strip";
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
  public static readonly resizeSplitLabel: string = "Resize the split";
  public static readonly versionField: string = "version";
  public static readonly docksField: string = "docks";
  public static readonly middleField: string = "middle";
  public static readonly rootField: string = "root";
  public static readonly sizeField: string = "size";
  public static readonly collapsedField: string = "collapsed";
  public static readonly axisField: string = "axis";
  public static readonly childrenField: string = "children";
  public static readonly weightField: string = "weight";
  public static readonly tabsField: string = "tabs";
  public static readonly activeField: string = "active";
  public static readonly previewField: string = "preview";
  public static readonly documentsField: string = "documents";
  public static readonly viewField: string = "view";
  public static readonly documentField: string = "document";
  public static readonly instanceField: string = "instance";
  public static readonly keySeparator: string = "/";
  public static readonly contributionSeparator: string = ".";
  public static readonly nameParameter: string = "name";
  public static readonly titleParameter: string = "title";
  public static readonly iconParameter: string = "icon";
  public static readonly defaultKeyParameter: string = "defaultKey";
  public static readonly invalidContributionName: string = "A contribution name has the form <module id>.<name>.";
  public static readonly invalidModuleId: string = "A module id is lowercase kebab-case.";
  public static readonly windowPartLoadFailed: string = "Its window part could not be loaded.";
  public static readonly windowPartActivationFailed: string = "Its window part failed to activate.";
  public static readonly invalidInstance: string = "An instance is a string that is not blank.";
  public static readonly invalidBounds: string = "Bounds need finite coordinates and a width and height that are not negative.";
  public static readonly invalidSize: string = "A size is a finite number of rem.";
  public static readonly invalidSplit: string = "A split has at least two children, one finite weight that is not negative for each and a positive total.";
  public static readonly emptyViewGroup: string = "A group of views has at least one tab.";
  public static readonly repeatedTab: string = "A tab appears only once in a layout.";
  public static readonly inactiveTab: string = "The active tab must be one of the group's tabs, and a group with tabs has one.";
  public static readonly previewOutsideGroup: string = "The preview tab must be one of the group's tabs.";
  public static readonly documentOutsideDocuments: string = "Document tabs stay in the documents group.";
  public static readonly missingDocumentsGroup: string = "The middle holds exactly one documents group.";
  public static readonly documentsInDock: string = "The documents group stays in the middle.";
  public static readonly repeatedDock: string = "A layout has one dock for each side.";
  public static readonly repeatedNodeId: string = "Each group and split in a layout has its own id.";
  public static readonly repeatedViewType: string = "A view or document type is registered once.";
  public static readonly unknownTab: string = "A tab names a view or a document.";
  public static readonly invalidLayoutPart: string = "The value does not describe a valid part of a layout.";
  public static readonly unknownNode: string = "A node is a split, with children, or a group, with tabs.";
  public static readonly productName: string = productName;
  public static readonly noModules: string = "No modules";
  public static readonly moduleFailuresTitle: string = "Modules that didn't start";
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

  public static formatModulesDidNotStart(count: number): string {
    return count === 1 ? "1 module didn't start" : `${count} modules didn't start`;
  }

  public static formatModuleDidNotStart(displayName: string): string {
    return `${displayName} didn't start`;
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

  public static formatCommandRegistered(name: string): string {
    return `The command ${name} is already registered.`;
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
