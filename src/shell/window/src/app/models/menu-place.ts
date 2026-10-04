/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";
import type { ToolbarPlacement } from "./toolbar-placement";

export class MenuPlace {
  public readonly name: string;
  public readonly title: string;
  public readonly isMenuBar: boolean;
  public readonly icon: string | null;
  public readonly toolbar: ToolbarPlacement | null;

  public constructor(name: string, title: string, isMenuBar: boolean, icon: string | null = null, toolbar: ToolbarPlacement | null = null) {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);

    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.title = title;
    this.isMenuBar = isMenuBar;
    this.icon = icon;
    this.toolbar = toolbar;
  }
}
