/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire, Module } from "node:module";

import { Assert } from "@noldova/teamrun-foundation-testing";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakePreloadElectron {
  private static readonly APPEARANCE_ARGUMENT: string = "--teamrun-appearance=";

  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private readonly exposed: Map<string, Record<string, unknown>> = new Map();

  public readonly sent: unknown[][] = [];
  public readonly invoked: unknown[][] = [];
  public readonly contextBridge: object = {
    exposeInMainWorld: (name: string, api: Record<string, unknown>): void => {
      this.exposed.set(name, api);
    }
  };

  public readonly ipcRenderer: object = {
    send: (...values: unknown[]): void => {
      this.sent.push(values);
    },
    invoke: (...values: unknown[]): Promise<unknown> => {
      this.invoked.push(values);
      return Promise.resolve(values.length);
    },
    on: (channel: string, listener: (...values: never[]) => unknown): void => this.listeners.add(channel, listener),
    removeListener: (channel: string, listener: (...values: never[]) => unknown): void => this.listeners.remove(channel, listener)
  };

  public static load(appearance: string | null = null): FakePreloadElectron {
    const electron = new FakePreloadElectron();
    const require = createRequire(import.meta.url);
    const preloadPath = require.resolve("@noldova/teamrun-shell-desktop/preload.cjs");
    const electronPath = createRequire(preloadPath).resolve("electron");
    const fake = new Module(electronPath);
    fake.filename = electronPath;
    fake.loaded = true;
    fake.exports = electron;
    const argument = Object.isNull(appearance) ? [] : [`${FakePreloadElectron.APPEARANCE_ARGUMENT}${appearance}`];
    process.argv.push(...argument);
    require.cache[electronPath] = fake;
    try {
      require(preloadPath);
    }
    finally {
      Reflect.deleteProperty(require.cache, electronPath);
      Reflect.deleteProperty(require.cache, preloadPath);
      process.argv.splice(process.argv.length - argument.length, argument.length);
    }
    return electron;
  }

  public api(name: string): Record<string, unknown> {
    const api = this.exposed.get(name);
    Assert.isDefined(api);
    return api;
  }

  public emit(channel: string, ...values: unknown[]): void {
    this.listeners.emit(channel, {}, ...values);
  }

  public count(channel: string): number {
    return this.listeners.count(channel);
  }
}
