/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { IWindowPart } from "../interfaces/i-window-part";
import { Resources } from "../../resources";

export class WindowPartSource {
  public readonly moduleId: string;
  public readonly displayName: string;
  public readonly dependencies: readonly string[];
  public readonly viewNames: readonly string[];
  public readonly commandNames: readonly string[];
  public readonly notificationKinds: readonly string[];
  public readonly load: () => Promise<IWindowPart>;

  public constructor(
    moduleId: string,
    displayName: string,
    dependencies: readonly string[],
    viewNames: readonly string[],
    commandNames: readonly string[],
    notificationKinds: readonly string[],
    load: () => Promise<IWindowPart>) {
    if (!Resources.moduleIdPattern.test(moduleId))
      throw new ArgumentException(Resources.invalidModuleId, "moduleId");

    this.moduleId = moduleId;
    this.displayName = displayName;
    this.dependencies = [...dependencies];
    this.viewNames = [...viewNames];
    this.commandNames = [...commandNames];
    this.notificationKinds = [...notificationKinds];
    this.load = load;
  }
}
