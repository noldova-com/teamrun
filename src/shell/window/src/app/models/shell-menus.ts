/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuDeclarations } from "./menu-declarations";
import { MenuPlace } from "./menu-place";
import { Resources } from "../../resources";

export class ShellMenus {
  public static readonly declarations: MenuDeclarations = new MenuDeclarations(Resources.shellOwner, [
    new MenuPlace(Resources.fileMenu, Resources.fileMenuTitle, true),
    new MenuPlace(Resources.editMenu, Resources.editMenuTitle, true),
    new MenuPlace(Resources.viewMenu, Resources.viewMenuTitle, true),
    new MenuPlace(Resources.windowMenu, Resources.windowMenuTitle, true),
    new MenuPlace(Resources.helpMenu, Resources.helpMenuTitle, true),
    new MenuPlace(Resources.tabMenu, Resources.tabMenuTitle, false)
  ], []);
}
