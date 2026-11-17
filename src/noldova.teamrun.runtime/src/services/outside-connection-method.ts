/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMethodHandler } from "@noldova/desktop.runtime";
import type { JsonValue } from "@noldova/context.json";
import type { OutsideConnection } from "@noldova/teamrun.protocol";

export class OutsideConnectionMethod implements IMethodHandler {
  private readonly act: () => Promise<OutsideConnection>;

  public constructor(act: () => Promise<OutsideConnection>) {
    this.act = act;
  }

  public async handleAsync(): Promise<JsonValue> {
    return (await this.act()).toJson();
  }
}
