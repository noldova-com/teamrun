/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProfileException } from "./profile.exception.ts";
import type { ProfileGroup } from "./profile-group.ts";
import { ProfileNode } from "./profile.node.ts";
import { SelfTime } from "./self-time.ts";

export class CpuProfile {
  private static readonly NOT_BUSY: ReadonlySet<string> = new Set(["(idle)", "(program)", "(root)"]);
  private static readonly NOT_CODE: ReadonlySet<string> = new Set(["(idle)", "(program)", "(garbage collector)", "(root)"]);
  private static readonly MICROSECONDS_PER_MILLISECOND: number = 1000;
  private static readonly CALLER_LIMIT: number = 7;

  public readonly startTime: number;
  public readonly endTime: number;
  private readonly nodes: ReadonlyMap<number, ProfileNode>;
  private readonly parents: ReadonlyMap<number, number>;
  private readonly selfTimes: ReadonlyMap<number, number>;

  public constructor(nodes: readonly ProfileNode[], samples: readonly number[], timeDeltas: readonly number[], startTime: number, endTime: number) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.nodes = new Map(nodes.map(t => [t.id, t]));
    this.parents = new Map(nodes.flatMap(t => t.children.map(u => [u, t.id] as const)));
    const selfTimes = new Map<number, number>();
    samples.forEach((sample, index) => selfTimes.set(sample, (selfTimes.get(sample) ?? 0) + (timeDeltas[index] ?? 0) / CpuProfile.MICROSECONDS_PER_MILLISECOND));
    this.selfTimes = selfTimes;
  }

  public static parse(text: string): CpuProfile {
    const profile: unknown = JSON.parse(text);
    if (!CpuProfile.isRecord(profile) || !Array.isArray(profile["nodes"]) || !CpuProfile.isNumbers(profile["samples"]) || !CpuProfile.isNumbers(profile["timeDeltas"])
      || !Object.isNumber(profile["startTime"]) || !Object.isNumber(profile["endTime"]))
      throw new ProfileException("The file is not a CPU profile: it needs nodes, samples, timeDeltas, startTime and endTime.");
    return new CpuProfile(profile["nodes"].map(t => CpuProfile.parseNode(t)), profile["samples"], profile["timeDeltas"], profile["startTime"], profile["endTime"]);
  }

  public get spanMilliseconds(): number {
    return (this.endTime - this.startTime) / CpuProfile.MICROSECONDS_PER_MILLISECOND;
  }

  public get busyMilliseconds(): number {
    let busy = 0;
    for (const [id, milliseconds] of this.selfTimes)
      if (!CpuProfile.NOT_BUSY.has(this.nodeOf(id).functionName))
        busy += milliseconds;
    return busy;
  }

  public get sampledNodes(): readonly (readonly [ProfileNode, number])[] {
    return [...this.selfTimes].map(([id, milliseconds]) => [this.nodeOf(id), milliseconds] as const);
  }

  public inclusiveMillisecondsOf(groups: readonly ProfileGroup[]): ReadonlyMap<string, number> {
    const totals = new Map<string, number>(groups.map(t => [t.name, 0]));
    for (const [id, milliseconds] of this.selfTimes) {
      const stack = [this.nodeOf(id), ...this.callersOf(id, Number.POSITIVE_INFINITY)];
      for (const group of groups.filter(t => stack.some(u => t.includes(u))))
        totals.set(group.name, totals.get(group.name)! + milliseconds);
    }
    return totals;
  }

  public topSelfTimes(count: number): readonly SelfTime[] {
    const byLabel = new Map<string, { node: ProfileNode; milliseconds: number }>();
    for (const [id, milliseconds] of this.selfTimes) {
      const node = this.nodeOf(id);
      if (CpuProfile.NOT_CODE.has(node.functionName))
        continue;
      const found = byLabel.get(node.label);
      byLabel.set(node.label, { node: found?.node ?? node, milliseconds: (found?.milliseconds ?? 0) + milliseconds });
    }
    return [...byLabel.values()].sort((a, b) => b.milliseconds - a.milliseconds).slice(0, count)
      .map(t => new SelfTime(t.node, t.milliseconds, this.callersOf(t.node.id, CpuProfile.CALLER_LIMIT)));
  }

  public callersOf(id: number, limit: number): readonly ProfileNode[] {
    const callers: ProfileNode[] = [];
    for (let at = this.parents.get(id); !Object.isUndefined(at) && callers.length < limit; at = this.parents.get(at))
      callers.push(this.nodeOf(at));
    return callers;
  }

  private nodeOf(id: number): ProfileNode {
    const node = this.nodes.get(id);
    if (Object.isUndefined(node))
      throw new ProfileException(`The profile samples node ${id}, which it doesn't list.`);
    return node;
  }

  private static parseNode(value: unknown): ProfileNode {
    const frame = CpuProfile.isRecord(value) ? value["callFrame"] : undefined;
    const children = CpuProfile.isRecord(value) ? value["children"] ?? [] : undefined;
    if (!CpuProfile.isRecord(value) || !Object.isNumber(value["id"]) || !CpuProfile.isRecord(frame) || !CpuProfile.isNumbers(children)
      || !Object.isString(frame["functionName"]) || !Object.isString(frame["url"]) || !Object.isNumber(frame["lineNumber"]) || !Object.isNumber(frame["columnNumber"]))
      throw new ProfileException("A profile node needs an id, a call frame with functionName, url, lineNumber and columnNumber, and child ids.");
    return new ProfileNode(value["id"], frame["functionName"], frame["url"], frame["lineNumber"], frame["columnNumber"], children);
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static isNumbers(value: unknown): value is readonly number[] {
    return Array.isArray(value) && value.every(t => Object.isNumber(t));
  }
}
