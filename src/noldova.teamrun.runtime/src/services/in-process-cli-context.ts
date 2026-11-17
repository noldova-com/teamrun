/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliCommandHandler, ICliPartContext, ICliSecrets } from "@noldova/desktop.cli";
import { type IMethodHandler, type IModuleSecrets, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

import { RuntimePartException } from "../exceptions/runtime-part.exception.js";
import { Resources } from "../resources.js";

export class InProcessCliContext implements ICliPartContext {
  public readonly moduleId: string;
  public readonly commands: Map<string, ICliCommandHandler> = new Map();
  public readonly secrets: ICliSecrets;
  private readonly methods: ReadonlyMap<string, IMethodHandler>;

  public constructor(moduleId: string, methods: ReadonlyMap<string, IMethodHandler>, secrets: IModuleSecrets) {
    this.moduleId = moduleId;
    this.methods = methods;
    this.secrets = {
      saveAsync: async (name, value, signal) => {
        signal.throwIfAborted();
        await secrets.saveAsync(name, value);
      },
      removeAsync: async (name, signal) => {
        signal.throwIfAborted();
        await secrets.removeAsync(name);
      },
      isSetAsync: async (name, signal) => {
        signal.throwIfAborted();
        return secrets.isSetAsync(name);
      }
    };
  }

  public registerCommand(name: string, handler: ICliCommandHandler): void {
    this.commands.set(name, handler);
  }

  public async requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    const handler = this.methods.get(method);
    if (Object.isUndefined(handler))
      throw new RuntimePartException(Resources.formatNoMethodForTools(method));

    return handler.handleAsync(new RequestContext(Resources.toolsClient, payload, signal, Resources.toolsConnection));
  }
}
