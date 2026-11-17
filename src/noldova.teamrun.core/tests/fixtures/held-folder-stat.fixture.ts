/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";

import "@noldova/context.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class HeldFolderStat {
  public readonly paths: string[] = [];
  private readonly holds: Set<string> = new Set();
  private readonly failures: Map<string, string> = new Map();
  private readonly held: Map<string, PromiseWithResolvers<{ isDirectory(): boolean }>> = new Map();

  public readonly statAsync = (path: string): Promise<{ isDirectory(): boolean }> => {
    this.paths.push(path);
    ChangeSignal.notify();
    const code = this.failures.get(path);
    this.failures.delete(path);
    if (!Object.isUndefined(code))
      return Promise.reject(Object.assign(new Error(code), { code }));
    if (!this.holds.delete(path))
      return stat(path);
    const held = Promise.withResolvers<{ isDirectory(): boolean }>();
    this.held.set(path, held);
    return held.promise;
  };

  public hold(path: string): void {
    this.holds.add(path);
  }

  public release(path: string, isFolder: boolean): void {
    this.held.get(path)?.resolve({ isDirectory: () => isFolder });
    this.held.delete(path);
  }

  public failNext(path: string, code: string): void {
    this.failures.set(path, code);
  }
}
