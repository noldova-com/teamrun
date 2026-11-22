/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolDescriptor } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import type { MethodName } from "@noldova/teamrun.protocol";

export class SubAgentMethod {
  public readonly descriptor: IToolDescriptor;
  public readonly method: MethodName;
  public readonly paramsOf: (input: JsonObject, token: string) => JsonObject;

  public constructor(descriptor: IToolDescriptor, method: MethodName, paramsOf: (input: JsonObject, token: string) => JsonObject) {
    this.descriptor = descriptor;
    this.method = method;
    this.paramsOf = paramsOf;
  }
}
