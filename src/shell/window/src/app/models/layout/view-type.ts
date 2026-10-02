/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../../resources";
import type { DockSide } from "../../enums/dock-side";

export class ViewType {
  public readonly name: string;
  public readonly defaultSide: DockSide;
  public readonly isShownByDefault: boolean;

  public constructor(name: string, defaultSide: DockSide, isShownByDefault: boolean) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, "name");

    this.name = name;
    this.defaultSide = defaultSide;
    this.isShownByDefault = isShownByDefault;
  }
}
