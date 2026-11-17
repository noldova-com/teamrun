/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AppLook, type IAppDescriptions } from "@noldova/teamrun.core";

import type { IComputerUseApps } from "../interfaces/i-computer-use-apps.js";
import { Resources } from "../resources.js";

export class RuntimeAppDescriptions implements IAppDescriptions {
  private readonly find: () => IComputerUseApps | null;

  public constructor(find: () => IComputerUseApps | null) {
    this.find = find;
  }

  public static isApps(service: object): service is IComputerUseApps {
    return "describeAsync" in service && typeof service.describeAsync === "function";
  }

  public async describeAsync(app: string, signal: AbortSignal = new AbortController().signal): Promise<AppLook | null> {
    const apps = this.find();
    if (Object.isNull(apps))
      return null;
    const description = await apps.describeAsync(app, signal);
    if (Object.isNull(description))
      return null;
    return new AppLook(description.name, Object.isNull(description.icon) ? null : Buffer.from(description.icon).toString(Resources.appIconEncoding));
  }
}
