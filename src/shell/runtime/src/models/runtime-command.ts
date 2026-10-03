/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { CommandInfo, KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../interfaces/method-handler.js";
import { Resources } from "../resources.js";

export class RuntimeCommand {
  public readonly info: CommandInfo;
  public readonly handler: IMethodHandler;

  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, handler: IMethodHandler) {
    this.info = new CommandInfo(
      QualifiedName.parse(name, Resources.nameParameterName),
      title,
      icon,
      Object.isNull(defaultKey) ? null : KeyChord.parseDefault(defaultKey, Resources.defaultKeyParameterName));
    this.handler = handler;
  }
}
