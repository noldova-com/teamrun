/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ClientClosure, IMethodHandler, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IWindowsService } from "@noldova/teamrun.core";
import { WindowFocusedParams, WindowIdParams } from "@noldova/teamrun.protocol";

export class WindowClients implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly windows: Pick<IWindowsService, "close">;
  private readonly clients: Map<string, { readonly connection: number; readonly window: number | null }> = new Map();

  public constructor(method: IMethodHandler, windows: Pick<IWindowsService, "close">) {
    this.method = method;
    this.windows = windows;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    const payload = await this.method.handleAsync(request);
    const windowId = WindowFocusedParams.fromJson(request.payload).windowId;
    for (const [other, client] of [...this.clients])
      if (other !== windowId && !Object.isNull(request.window) && client.connection === request.connection && client.window === request.window)
        this.forget(other);
    this.clients.set(windowId, { connection: request.connection, window: request.window });
    return payload;
  }

  public close(closure: ClientClosure): void {
    for (const [windowId, client] of [...this.clients])
      if (client.connection === closure.connection && (Object.isNull(closure.window) || client.window === closure.window))
        this.forget(windowId);
  }

  private forget(windowId: string): void {
    this.clients.delete(windowId);
    this.windows.close(new WindowIdParams(windowId));
  }
}
