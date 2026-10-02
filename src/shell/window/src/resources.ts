/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "./app/enums/dock-side";
import { PanelEdge } from "./app/enums/panel-edge";
import { SplitAxis } from "./app/enums/split-axis";

export class Resources {
  public static readonly contributionNamePattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
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
  public static readonly documentsField: string = "documents";
  public static readonly viewField: string = "view";
  public static readonly documentField: string = "document";
  public static readonly instanceField: string = "instance";
  public static readonly keySeparator: string = "/";
  public static readonly invalidContributionName: string = "A contribution name has the form <module id>.<name>.";
  public static readonly invalidInstance: string = "An instance is a string that is not blank.";
  public static readonly invalidBounds: string = "Bounds need finite coordinates and a width and height that are not negative.";
  public static readonly invalidSize: string = "A size is a finite number of rem.";
  public static readonly invalidSplit: string = "A split has at least two children, one finite weight that is not negative for each and a positive total.";
  public static readonly emptyViewGroup: string = "A group of views has at least one tab.";
  public static readonly repeatedTab: string = "A tab appears only once in a layout.";
  public static readonly inactiveTab: string = "The active tab must be one of the group's tabs, and a group with tabs has one.";
  public static readonly documentOutsideDocuments: string = "Document tabs stay in the documents group.";
  public static readonly missingDocumentsGroup: string = "The middle holds exactly one documents group.";
  public static readonly documentsInDock: string = "The documents group stays in the middle.";
  public static readonly repeatedDock: string = "A layout has one dock for each side.";
  public static readonly repeatedNodeId: string = "Each group and split in a layout has its own id.";
  public static readonly repeatedViewType: string = "A view or document type is registered once.";
  public static readonly unknownTab: string = "A tab names a view or a document.";
  public static readonly invalidLayoutPart: string = "The value does not describe a valid part of a layout.";
  public static readonly unknownNode: string = "A node is a split, with children, or a group, with tabs.";
  public static readonly productName: string = "TeamRun";
  public static readonly noModules: string = "No modules";
  public static readonly bridgeName: string = "teamrun";
  public static readonly macPlatform: string = "darwin";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly missingBridge: string = "The window needs the desktop's bridge, which the preload provides.";

  public static formatUnregisteredView(name: string): string {
    return `No view named "${name}" is registered.`;
  }

  public static formatUnsupportedVersion(version: number): string {
    return `Layout format version ${version} is not supported; this build reads version ${Resources.layoutFormatVersion}.`;
  }
}
