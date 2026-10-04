/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { ProcessRequest } from "../../models/process-request.js";
import { Resources } from "../../resources.js";

export class ProcessEnvironment {
  private readonly isCaseInsensitive: boolean;
  private readonly entries: Map<string, string> = new Map();

  private constructor(isCaseInsensitive: boolean) {
    this.isCaseInsensitive = isCaseInsensitive;
  }

  public get values(): NodeJS.ProcessEnv {
    return Object.fromEntries(this.entries);
  }

  public static create(platform: string, runtime: NodeJS.ProcessEnv, request: ProcessRequest): ProcessEnvironment {
    const isWindows = platform === Resources.windowsPlatform;
    const environment = new ProcessEnvironment(isWindows);
    const inherited = isWindows ? Resources.windowsEnvironmentNames : Resources.posixEnvironmentNames;
    for (const name of [...Resources.sharedEnvironmentNames, ...inherited, ...request.inherit]) {
      const key = environment.findKey(Object.keys(runtime), name);
      const value = Object.isUndefined(key) ? undefined : runtime[key];
      if (!Object.isUndefined(value))
        environment.set(name, value);
    }
    for (const [name, value] of Object.entries(request.environment))
      environment.set(name, value);
    return environment;
  }

  public read(name: string): string | undefined {
    const key = this.findKey([...this.entries.keys()], name);
    return Object.isUndefined(key) ? undefined : this.entries.get(key);
  }

  private set(name: string, value: string): void {
    const key = this.findKey([...this.entries.keys()], name);
    if (!Object.isUndefined(key))
      this.entries.delete(key);
    this.entries.set(name, value);
  }

  private findKey(keys: readonly string[], name: string): string | undefined {
    return this.isCaseInsensitive ? keys.find(t => t.toUpperCase() === name.toUpperCase()) : keys.find(t => t === name);
  }
}
