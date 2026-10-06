/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BottomDockSpan } from "../enums/bottom-dock-span";
import { DockSide } from "../enums/dock-side";
import { EditAction } from "../enums/edit-action";
import { PanelEdge } from "../enums/panel-edge";
import { ToolbarMove } from "../enums/toolbar-move";
import { MenuDeclarations } from "./menu-declarations";
import { MenuGroup } from "./menu-group";
import { MenuItem } from "./menu-item";
import { MenuPlace } from "./menu-place";
import { Resources } from "../../resources";

export class ShellMenus {
  private static readonly PLACES: readonly MenuPlace[] = [
    new MenuPlace(Resources.fileMenu, Resources.fileMenuTitle, true),
    new MenuPlace(Resources.editMenu, Resources.editMenuTitle, true),
    new MenuPlace(Resources.viewMenu, Resources.viewMenuTitle, true),
    new MenuPlace(Resources.windowMenu, Resources.windowMenuTitle, true),
    new MenuPlace(Resources.helpMenu, Resources.helpMenuTitle, true),
    new MenuPlace(Resources.tabMenu, Resources.tabMenuTitle, false),
    new MenuPlace(Resources.fieldMenu, Resources.fieldMenuTitle, false),
    new MenuPlace(Resources.tabMoveToMenu, Resources.moveToLabel, false, Resources.moveToGlyph),
    new MenuPlace(Resources.tabSplitMenu, Resources.splitLabel, false, Resources.splitGlyph),
    new MenuPlace(Resources.tabDockMenu, Resources.dockLabel, false, Resources.dockGlyph),
    new MenuPlace(Resources.toolbarsMenu, Resources.toolbarsMenuTitle, false),
    new MenuPlace(Resources.toolbarMenu, Resources.toolbarMenuTitle, false),
    new MenuPlace(Resources.appMenu, Resources.appMenuTitle, false)
  ];
  private static readonly EDITING: MenuGroup = new MenuGroup(Resources.editingGroup, Resources.editMenu, false,
    Object.values(EditAction).map(t => MenuItem.ofCommand(Resources.editCommands[t])));
  private static readonly FIELD_EDITING: MenuGroup = new MenuGroup(Resources.fieldEditingGroup, Resources.fieldMenu, false,
    Resources.fieldEditActions.map(t => MenuItem.ofCommand(Resources.editCommands[t])));
  private static readonly GROUPS: readonly MenuGroup[] = [
    new MenuGroup(Resources.closeGroup, Resources.fileMenu, false, [MenuItem.ofCommand(Resources.closeTabCommand)]),
    new MenuGroup(Resources.searchGroup, Resources.viewMenu, false, [MenuItem.ofCommand(Resources.showCommandsCommand)]),
    new MenuGroup(Resources.modulesGroup, Resources.viewMenu, false, [MenuItem.ofCommand(Resources.openModulesCommand)]),
    new MenuGroup(Resources.docksGroup, Resources.viewMenu, false,
      Object.values(DockSide).map(t => MenuItem.ofCommand(Resources.toggleDockCommands[t], {}, Resources.dockRowLabels[t]))),
    new MenuGroup(Resources.bottomDockGroup, Resources.viewMenu, true, Object.values(BottomDockSpan).map(t => MenuItem.ofCommand(Resources.bottomSpanCommands[t]))),
    new MenuGroup(Resources.groupsGroup, Resources.viewMenu, false, [
      MenuItem.ofCommand(Resources.splitTabCommands[PanelEdge.Right], {}, Resources.splitLabels[PanelEdge.Right]),
      MenuItem.ofCommand(Resources.splitTabCommands[PanelEdge.Bottom], {}, Resources.splitLabels[PanelEdge.Bottom]),
      MenuItem.ofCommand(Resources.moveTabToNextGroupCommand, {}, Resources.moveToNextGroupLabel),
      MenuItem.ofCommand(Resources.moveTabToPreviousGroupCommand, {}, Resources.moveToPreviousGroupLabel),
      MenuItem.ofCommand(Resources.focusNextGroupCommand, {}, Resources.focusNextGroupLabel),
      MenuItem.ofCommand(Resources.focusPreviousGroupCommand, {}, Resources.focusPreviousGroupLabel)
    ]),
    new MenuGroup(Resources.viewToolbarsGroup, Resources.viewMenu, false, [MenuItem.ofSubmenu(Resources.toolbarsMenu)]),
    MenuGroup.dynamic(Resources.toolbarListGroup, Resources.toolbarsMenu, false),
    new MenuGroup(Resources.toolbarMoveGroup, Resources.toolbarMenu, false,
      Object.values(ToolbarMove).map(t => MenuItem.ofCommand(Resources.moveToolbarCommands[t], {}, Resources.moveToolbarLabels[t]))),
    new MenuGroup(Resources.toolbarHideGroup, Resources.toolbarMenu, false, [MenuItem.ofCommand(Resources.hideToolbarCommand, {}, Resources.hideToolbarLabel)]),
    new MenuGroup(Resources.toolbarsSubmenuGroup, Resources.toolbarMenu, false, [MenuItem.ofSubmenu(Resources.toolbarsMenu)]),
    new MenuGroup(Resources.layoutGroup, Resources.viewMenu, false, [MenuItem.ofCommand(Resources.resetLayoutCommand)]),
    new MenuGroup(Resources.tabArrangeGroup, Resources.tabMenu, false, [
      MenuItem.ofCommand(Resources.keepTabCommand, {}, Resources.keepLabel),
      MenuItem.ofSubmenu(Resources.tabMoveToMenu),
      MenuItem.ofSubmenu(Resources.tabSplitMenu),
      MenuItem.ofSubmenu(Resources.tabDockMenu),
      MenuItem.ofCommand(Resources.moveTabLeftCommand, {}, Resources.moveEarlierLabel),
      MenuItem.ofCommand(Resources.moveTabRightCommand, {}, Resources.moveLaterLabel),
      MenuItem.ofCommand(Resources.moveTabToNextGroupCommand, {}, Resources.moveToNextGroupLabel),
      MenuItem.ofCommand(Resources.moveTabToPreviousGroupCommand, {}, Resources.moveToPreviousGroupLabel)
    ]),
    new MenuGroup(Resources.tabCloseGroup, Resources.tabMenu, false, [
      MenuItem.ofCommand(Resources.closeTabCommand, {}, Resources.closeTabLabel),
      MenuItem.ofCommand(Resources.closeOtherTabsCommand, {}, Resources.closeOthersLabel),
      MenuItem.ofCommand(Resources.closeTabsToTheRightCommand, {}, Resources.closeToTheRightLabel),
      MenuItem.ofCommand(Resources.closeAllTabsCommand, {}, Resources.closeAllLabel)
    ]),
    MenuGroup.dynamic(Resources.tabDestinationsGroup, Resources.tabMoveToMenu, false),
    new MenuGroup(Resources.tabSplitGroup, Resources.tabSplitMenu, false,
      Object.values(PanelEdge).map(t => MenuItem.ofCommand(Resources.splitTabCommands[t], {}, Resources.splitLabels[t]))),
    new MenuGroup(Resources.tabDockGroup, Resources.tabDockMenu, false,
      Object.values(DockSide).map(t => MenuItem.ofCommand(Resources.dockTabCommands[t], {}, Resources.dockLabels[t]))),
    new MenuGroup(Resources.settingsGroup, Resources.appMenu, false, [MenuItem.ofCommand(Resources.openSettingsCommand)]),
    new MenuGroup(Resources.commandLineGroup, Resources.appMenu, false, [MenuItem.ofCommand(Resources.installCommandCommand)])
  ];

  public static of(isMac: boolean): MenuDeclarations {
    return new MenuDeclarations(Resources.shellOwner, ShellMenus.PLACES, isMac ? [ShellMenus.FIELD_EDITING, ...ShellMenus.GROUPS] : [ShellMenus.EDITING, ShellMenus.FIELD_EDITING, ...ShellMenus.GROUPS]);
  }
}
