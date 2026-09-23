/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MemoryStorage implements Storage {
  private readonly items: Map<string, string> = new Map();

  public get length(): number {
    return this.items.size;
  }

  public static install(target: Window): MemoryStorage {
    const storage = new MemoryStorage();
    Object.defineProperty(target, "localStorage", { value: storage, configurable: true });
    return storage;
  }

  public clear(): void {
    this.items.clear();
  }

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  public removeItem(key: string): void {
    this.items.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}
