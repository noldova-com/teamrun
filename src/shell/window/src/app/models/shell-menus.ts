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
    new MenuPlace(Resources.appMenu, Resources.appMenuTitle, false)
  ];
  private static readonly EDITING: MenuGroup = new MenuGroup(Resources.editingGroup, Resources.editMenu, false,
    Object.values(EditAction).map(t => MenuItem.ofCommand(Resources.editCommands[t])));
  private static readonly GROUPS: readonly MenuGroup[] = [
    new MenuGroup(Resources.closeGroup, Resources.fileMenu, false, [MenuItem.ofCommand(Resources.closeTabCommand)]),
    new MenuGroup(Resources.searchGroup, Resources.viewMenu, false, [MenuItem.ofCommand(Resources.showCommandsCommand)]),
    new MenuGroup(Resources.docksGroup, Resources.viewMenu, false, Object.values(DockSide).map(t => MenuItem.ofCommand(Resources.toggleDockCommands[t]))),
    new MenuGroup(Resources.bottomDockGroup, Resources.viewMenu, true, Object.values(BottomDockSpan).map(t => MenuItem.ofCommand(Resources.bottomSpanCommands[t]))),
    new MenuGroup(Resources.layoutGroup, Resources.viewMenu, false, [MenuItem.ofCommand(Resources.resetLayoutCommand)]),
    new MenuGroup(Resources.settingsGroup, Resources.appMenu, false, [MenuItem.ofCommand(Resources.openSettingsCommand)])
  ];

  public static of(isMac: boolean): MenuDeclarations {
    return new MenuDeclarations(Resources.shellOwner, ShellMenus.PLACES, isMac ? ShellMenus.GROUPS : [ShellMenus.EDITING, ...ShellMenus.GROUPS]);
  }
}
