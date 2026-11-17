/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class AppLook {
  public readonly name: string;
  public readonly icon: string | null;

  public constructor(name: string, icon: string | null) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameterName);

    this.name = name;
    this.icon = icon;
  }
}
