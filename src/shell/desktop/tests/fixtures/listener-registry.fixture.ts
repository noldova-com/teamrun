/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ListenerRegistry {
  private readonly listeners: Map<string, ((...values: unknown[]) => unknown)[]> = new Map();

  public add(name: string, listener: (...values: never[]) => unknown): void {
    this.listeners.set(name, [...this.listeners.get(name) ?? [], listener as (...values: unknown[]) => unknown]);
  }

  public count(name: string): number {
    return this.listeners.get(name)?.length ?? 0;
  }

  public emit(name: string, ...values: unknown[]): unknown[] {
    return (this.listeners.get(name) ?? []).map(t => t(...values));
  }
}
