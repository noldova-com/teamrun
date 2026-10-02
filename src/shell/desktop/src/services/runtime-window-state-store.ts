/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { type QualifiedName, type Response, type WindowStateKey, WindowStateValue, WindowStateWrite } from "@noldova/teamrun-shell-protocol";

import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IWindowStateStore } from "../interfaces/i-window-state-store.js";
import { WindowStateException } from "../exceptions/window-state.exception.js";
import { Resources } from "../resources.js";

export class RuntimeWindowStateStore implements IWindowStateStore {
  private readonly connection: () => IRuntimeConnection | null;
  private readonly key: WindowStateKey;
  private readonly readMethod: QualifiedName;
  private readonly writeMethod: QualifiedName;

  public constructor(connection: () => IRuntimeConnection | null, key: WindowStateKey, readMethod: QualifiedName, writeMethod: QualifiedName) {
    this.connection = connection;
    this.key = key;
    this.readMethod = readMethod;
    this.writeMethod = writeMethod;
  }

  public async readAsync(): Promise<JsonObject | null> {
    const response = await this.callAsync(this.readMethod, this.key.toJson());
    return WindowStateValue.fromJson(response.payload).value;
  }

  public async writeAsync(value: JsonObject): Promise<void> {
    await this.callAsync(this.writeMethod, new WindowStateWrite(this.key, value).toJson());
  }

  private async callAsync(method: QualifiedName, payload: JsonObject): Promise<Response> {
    const connection = this.connection();
    if (Object.isNull(connection))
      throw new WindowStateException(Resources.runtimeNotConnected);
    const response = await connection.callAsync(method, payload);
    if (!Object.isUndefined(response.failure))
      throw new WindowStateException(Resources.formatWindowStateFailed(method.text, response.failure.message));
    return response;
  }
}
