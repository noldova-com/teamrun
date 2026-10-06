/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowsProcessApi } from "@noldova/teamrun-shell-runtime";

export class WindowsProcessApiFixture implements IWindowsProcessApi {
  public static readonly QUERY: number = 0x1000;
  public static readonly END: number = 0x1000 | 0x0001 | 0x100000;
  public static readonly GONE: number = 87;
  public static readonly DENIED: number = 5;
  private static readonly EPOCH: number = 11_644_473_600_000;

  private readonly tables: (string | Error | (() => string))[];
  private readonly starts: Map<number, number> = new Map();
  private readonly paths: Map<number, string | null> = new Map();
  private readonly handles: Map<bigint, readonly [number, number]> = new Map();
  private nextHandle: bigint = 1n;

  public readonly opened: string[] = [];
  public readonly denied: Map<number, number> = new Map();
  public readonly unreadable: Map<number, number> = new Map();
  public readonly replaced: Map<number, number> = new Map();
  public listings: number = 0;
  public rest: () => string = () => "";

  public constructor(tables: readonly (string | Error | (() => string))[] = []) {
    this.tables = [...tables];
  }

  public get openHandles(): number {
    return this.handles.size;
  }

  public static toFileTime(milliseconds: number): bigint {
    return BigInt(milliseconds + WindowsProcessApiFixture.EPOCH) * 10_000n;
  }

  public listProcesses(): readonly (readonly [number, number])[] {
    this.listings++;
    const table = this.tables.shift() ?? this.rest;
    if (table instanceof Error)
      throw table;
    const rows = (typeof table === "function" ? table() : table).split("\n").filter(t => t !== "").map(t => t.split("\t"));
    for (const [processId, , started, executable] of rows) {
      this.starts.set(Number(processId), Number(started));
      this.paths.set(Number(processId), executable === "" || executable === undefined ? null : executable);
    }
    return rows.map(([processId, parentId]) => [Number(processId), Number(parentId)] as const);
  }

  public openProcess(processId: number, access: number): bigint | number {
    this.opened.push(`${processId} ${access}`);
    if (this.denied.get(processId) === access)
      return WindowsProcessApiFixture.DENIED;
    if (access === WindowsProcessApiFixture.END ? !WindowsProcessApiFixture.isRunning(processId) : !this.starts.has(processId))
      return WindowsProcessApiFixture.GONE;
    const handle = this.nextHandle++;
    this.handles.set(handle, [processId, access]);
    return handle;
  }

  public readCreationTime(handle: bigint): bigint | null {
    const [processId, access] = this.open(handle);
    const started = this.starts.get(processId);
    if (this.unreadable.get(processId) === access || started === undefined)
      return null;
    return WindowsProcessApiFixture.toFileTime(this.replaced.get(processId) === access ? started + 3_600_000 : started);
  }

  public readImagePath(handle: bigint): string | null {
    return this.paths.get(this.find(handle)) ?? null;
  }

  public terminateProcess(handle: bigint): boolean {
    try {
      return process.kill(this.find(handle), "SIGKILL");
    }
    catch {
      return false;
    }
  }

  public hasExited(handle: bigint): boolean {
    return !WindowsProcessApiFixture.isRunning(this.find(handle));
  }

  public closeHandle(handle: bigint): void {
    this.find(handle);
    this.handles.delete(handle);
  }

  private static isRunning(processId: number): boolean {
    try {
      return process.kill(processId, 0);
    }
    catch {
      return false;
    }
  }

  private find(handle: bigint): number {
    return this.open(handle)[0];
  }

  private open(handle: bigint): readonly [number, number] {
    const opened = this.handles.get(handle);
    if (opened === undefined)
      throw new Error(`The handle ${handle} is not open.`);
    return opened;
  }
}
