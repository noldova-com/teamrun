/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import "@noldova/context.core";
import { type ProcessIdentity, ProcessTreeEndOptions } from "@noldova/context.processes";
import type { ILog, ITimer } from "@noldova/teamrun.core";

import type { IContextProcessTree } from "../../interfaces/i-context-process-tree.js";
import type { IOrphanSweep } from "../../interfaces/i-orphan-sweep.js";
import type { IPowershellSession } from "../../interfaces/i-powershell-session.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import { ListedProcess } from "../../models/listed-process.js";
import { OrphanSearch } from "../../models/orphan-search.js";
import { ProcessCommand } from "../../models/process-command.js";
import { ProcessListRow } from "../../models/process-list-row.js";
import { Resources } from "../../resources.js";
import type { CommandRunner } from "./command-runner.js";
import { ContextProcessTree } from "./context-process-tree.js";
import { StopSession } from "./stop-session.js";
import { ProbeLog } from "./probe-log.js";

export class ProcessTree implements IProcessTree, IOrphanSweep {
  private readonly platform: string;
  private readonly runner: CommandRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly timeout: number;
  private readonly timer: ITimer;
  private readonly grace: number;
  private readonly kill: (processId: number, signal: NodeJS.Signals | 0) => void;
  private readonly session: IPowershellSession | null;
  private readonly read: (path: string) => string;
  private readonly log: ILog | null;
  private readonly contextTree: IContextProcessTree;

  public constructor(platform: string, runner: CommandRunner, environment: NodeJS.ProcessEnv, timeout: number, timer: ITimer, grace: number,
    kill: (processId: number, signal: NodeJS.Signals | 0) => void = (processId, signal) => { process.kill(processId, signal); },
    session: IPowershellSession | null = null, read: (path: string) => string = path => readFileSync(path, Resources.utf8Encoding), log: ILog | null = null,
    contextTree: IContextProcessTree = new ContextProcessTree()) {
    this.platform = platform;
    this.runner = runner;
    this.environment = environment;
    this.timeout = timeout;
    this.timer = timer;
    this.grace = grace;
    this.kill = kill;
    this.session = session;
    this.read = read;
    this.log = log;
    this.contextTree = contextTree;
  }

  public endTree(processId: number, startedBy: number, ancestorId: number): Promise<boolean> {
    return ProbeLog.timed(`endTree ${String(processId)}`, () => this.endTreeCore(processId, startedBy, ancestorId));
  }

  private async endTreeCore(processId: number, startedBy: number, ancestorId: number): Promise<boolean> {
    const windows = this.platform === Resources.windowsPlatform;
    const stop = new StopSession(this.session);
    const listing = await this.run(null, Resources.psProcessListArguments, stop).catch(() => null);
    const start = listing?.get(processId)?.start;
    if (Object.isNullOrUndefined(listing) || Object.isUndefined(start) || !(start <= startedBy) || !ProcessTree.descends(listing, processId, ancestorId))
      return false;
    if (windows) {
      await this.endOnWindows(listing, new Map([[processId, start]]), stop);
      return true;
    }
    await this.end(await this.freeze(listing, new Map([[processId, start]])));
    return true;
  }

  public endOwnTree(processId: number, startedBy: number): Promise<boolean> {
    return ProbeLog.timed(`endOwnTree ${String(processId)}`, () => this.endOwnTreeCore(processId, startedBy));
  }

  private async endOwnTreeCore(processId: number, startedBy: number): Promise<boolean> {
    const root = await this.rootOf(processId);
    if (Object.isUndefined(root) || !(root.startTime <= startedBy))
      return false;
    return this.contextTree.endAsync(root, this.endOptions()).then(() => true, (error: Error) => this.endFailed(processId, error));
  }

  public async endDescendants(processId: number): Promise<void> {
    if (this.platform === Resources.windowsPlatform)
      return;
    const root = await this.rootOf(processId);
    if (!Object.isUndefined(root))
      await this.contextTree.endDescendantsAsync(root, this.endOptions()).catch((error: Error) => this.endFailed(processId, error));
  }

  public endLeftovers(processId: number, launched: number, exited: number): Promise<void> {
    return ProbeLog.timed(`endLeftovers ${String(processId)}`, () => this.endLeftoversCore(processId, launched, exited));
  }

  private async endLeftoversCore(processId: number, launched: number, exited: number): Promise<void> {
    if (this.platform === Resources.windowsPlatform) {
      const stop = new StopSession(this.session);
      const listing = await this.run(null, Resources.psProcessListArguments, stop).catch(() => null);
      const left = new Map([...listing ?? []].filter(([, t]) => t.parent === processId && t.start >= launched && t.start <= exited)
        .map(([id, t]) => [id, t.start]));
      if (!Object.isNull(listing) && left.size > 0)
        await this.endOnWindows(listing, left, stop);
      return;
    }
    const groups = await this.run(null, Resources.psProcessGroupArguments).catch(() => null);
    if (Object.isNull(groups) || groups.has(processId))
      return;
    await this.waitForEnd([...groups].filter(([, t]) => t.parent === processId && t.start + Resources.psStartTolerance > launched)
      .map(([id]) => id).filter(id => this.signal(id, Resources.killSignal)));
  }

  public async endOrphaned(processId: number, isRunning: () => boolean, threadIds: readonly string[], stop: () => Promise<void>): Promise<readonly number[]> {
    const listing = await this.run().catch(() => null);
    const start = listing?.get(processId)?.start;
    if (Object.isNullOrUndefined(listing) || Object.isUndefined(start) || !isRunning()) {
      await stop();
      return [];
    }
    const roots = new Set([...listing].filter(([id, t]) => t.parent === processId && t.start >= start && threadIds.includes(this.threadOf(id) ?? String.empty))
      .map(([id]) => id));
    if (roots.size === 0) {
      await stop();
      return [];
    }
    const before = ProcessTree.treeOf(listing, new Map([[processId, start]]));
    await stop();
    let found = await this.orphansOf(processId, roots, listing, before, new OrphanSearch(listing, new Map<number, number>(), false));
    for (let waited = 0; waited < this.grace && !Object.isNull(found) && !found.rootsGone; waited += Resources.processTreeGracePoll) {
      await this.timer.delayAsync(Resources.processTreeGracePoll, new AbortController().signal);
      found = await this.orphansOf(processId, roots, listing, before, found);
    }
    if (Object.isNull(found) || found.orphans.size === 0)
      return [];
    await this.end(await this.freeze(found.listing, found.orphans));
    return [...found.orphans.keys()];
  }

  private async rootOf(processId: number): Promise<ProcessIdentity | undefined> {
    if (!(processId > 0))
      return undefined;
    return this.contextTree.readAsync(processId).catch((error: Error) => {
      this.endFailed(processId, error);
      return undefined;
    });
  }

  private endOptions(): ProcessTreeEndOptions {
    return new ProcessTreeEndOptions(this.platform === Resources.windowsPlatform ? 0 : this.grace, this.timeout);
  }

  private endFailed(processId: number, error: Error): boolean {
    this.log?.write(Resources.formatTreeEndFailed(processId, error.name));
    return false;
  }

  private threadOf(processId: number): string | null {
    try {
      return this.read(Resources.formatProcessEnvironmentPath(processId)).split(Resources.processEnvironmentSeparator)
        .find(t => t.startsWith(Resources.codexThreadEntryPrefix))?.slice(Resources.codexThreadEntryPrefix.length) ?? null;
    }
    catch {
      return null;
    }
  }

  private async orphansOf(processId: number, roots: ReadonlySet<number>, first: ReadonlyMap<number, ProcessListRow>,
    before: ReadonlyMap<number, number>, last: OrphanSearch): Promise<OrphanSearch | null> {
    const listing = await this.run().catch(() => null);
    if (Object.isNull(listing))
      return last;
    if (listing.get(processId)?.start !== before.get(processId))
      return null;
    const alive = (id: number): boolean => listing.get(id)?.start === before.get(id);
    const gone = new Set([...roots].filter(id => !alive(id)));
    const orphans = new Map([...before].filter(([id]) => id !== processId && alive(id) && ProcessTree.under(first, processId, id, gone)
      && !ProcessTree.descends(listing, id, processId)));
    return new OrphanSearch(listing, orphans, gone.size === roots.size);
  }

  private async end(frozen: ReadonlyMap<number, number>): Promise<void> {
    for (const id of frozen.keys())
      this.signal(id, Resources.terminateSignal);
    for (const id of frozen.keys())
      this.signal(id, Resources.continueSignal);
    await this.waitForEnd([...frozen.keys()]);
    const left = await this.run().catch(() => null);
    if (!Object.isNull(left))
      for (const id of (await this.freeze(left, frozen)).keys())
        this.signal(id, Resources.killSignal);
  }

  private async waitForEnd(processIds: readonly number[]): Promise<void> {
    for (let waited = 0; waited < this.grace && processIds.some(t => this.signal(t, 0)); waited += Resources.processTreeGracePoll)
      await this.timer.delayAsync(Resources.processTreeGracePoll, new AbortController().signal);
  }

  private async freeze(listing: ReadonlyMap<number, ProcessListRow>, known: ReadonlyMap<number, number>): Promise<Map<number, number>> {
    const frozen = new Map<number, number>();
    const tried = new Map<number, number>();
    let tree = new Map(known);
    let current: ReadonlyMap<number, ProcessListRow> | null = listing;
    for (let round = 0; !Object.isNull(current) && round < Resources.processTreeFreezeRounds; round++) {
      tree = ProcessTree.treeOf(current, tree);
      const found = ProcessTree.listed(current, tree).filter(t => tried.get(t.id) !== t.start);
      if (found.length === 0)
        break;
      for (const listed of found) {
        tried.set(listed.id, listed.start);
        if (this.signal(listed.id, Resources.stopSignal))
          frozen.set(listed.id, listed.start);
      }
      current = await this.run().catch(() => null);
    }
    return frozen;
  }

  private async endOnWindows(listing: ReadonlyMap<number, ProcessListRow>, known: ReadonlyMap<number, number>,
    stop: StopSession): Promise<void> {
    let tree = new Map(known);
    let current: ReadonlyMap<number, ProcessListRow> = listing;
    for (let round = 1; round <= Resources.processTreeFreezeRounds; round++) {
      tree = ProcessTree.treeOf(current, tree);
      const found = ProcessTree.listed(current, tree);
      if (found.length === 0)
        return;
      try {
        current = await this.run(Resources.formatProcessEndScript(found.map(t => t.id), found.map(t => t.start)), Resources.psProcessListArguments, stop);
      }
      catch (error: unknown) {
        this.log?.write(Resources.formatTreeEndRoundFailed(round, error instanceof Error ? error.name : typeof error));
        return;
      }
    }
    const left = ProcessTree.listed(current, ProcessTree.treeOf(current, tree));
    if (left.length > 0)
      this.log?.write(Resources.formatTreeLeftListed(left));
  }

  private async run(endScript: string | null = null, listArguments: readonly string[] = Resources.psProcessListArguments,
    stop: StopSession = new StopSession(null)): Promise<ReadonlyMap<number, ProcessListRow>> {
    const windows = this.platform === Resources.windowsPlatform;
    const script = endScript ?? Resources.powershellProcessListScript;
    const fresh = async (timeout: number): Promise<string> => {
      const command = windows ? new ProcessCommand(Resources.powershellExecutable, [...Resources.powershellCommandArguments, script])
        : new ProcessCommand(Resources.psExecutable, listArguments);
      return (await this.runner.run(command, { ...this.environment, ...Resources.processListEnvironment }, timeout)).stdout;
    };
    const session = stop.session;
    const limit = Math.min(Resources.powershellSessionAnswerLimit, Math.floor(this.timeout / 2));
    const kind = endScript === null ? "list" : "end";
    const stdout = windows && !Object.isNull(session) ? await ProbeLog.timed(`session ${kind} limit=${String(limit)}`, () => session.run(script, limit)).catch(async () => {
      stop.leave();
      return ProbeLog.timed(`fresh-after-session ${kind} limit=${String(this.timeout - limit)}`, () => fresh(this.timeout - limit));
    }) : await ProbeLog.timed(`fresh ${kind} limit=${String(this.timeout)}`, () => fresh(this.timeout));
    return new Map([...stdout.matchAll(Resources.processParentPattern)]
      .map(t => [Number(t[1]), new ProcessListRow(Number(t[2]), windows ? Number(t[3]) : Date.parse(String(t[3])))]));
  }

  private signal(processId: number, signal: NodeJS.Signals | 0): boolean {
    try {
      this.kill(processId, signal);
      return true;
    }
    catch {
      return false;
    }
  }

  private static treeOf(listing: ReadonlyMap<number, ProcessListRow>, known: ReadonlyMap<number, number>): Map<number, number> {
    const tree = new Map(known);
    for (const [id, started] of tree) {
      const listed = listing.get(id);
      if (!Object.isUndefined(listed) && listed.start !== started)
        continue;
      for (const [child, entry] of listing)
        if (entry.parent === id && entry.start >= started)
          tree.set(child, entry.start);
    }
    return tree;
  }

  private static listed(listing: ReadonlyMap<number, ProcessListRow>, tree: ReadonlyMap<number, number>): ListedProcess[] {
    return [...tree].filter(([id, started]) => listing.get(id)?.start === started).map(([id, started]) => new ListedProcess(id, started));
  }

  private static under(listing: ReadonlyMap<number, ProcessListRow>, processId: number, id: number,
    roots: ReadonlySet<number>): boolean {
    for (let current = listing.get(id)?.parent; !Object.isUndefined(current) && current !== processId; current = listing.get(current)?.parent)
      if (roots.has(current))
        return true;
    return false;
  }

  private static descends(listing: ReadonlyMap<number, ProcessListRow>, processId: number, ancestorId: number): boolean {
    const seen = new Set<number>();
    for (let id = processId, entry = listing.get(id); !Object.isUndefined(entry) && !seen.has(id); id = entry.parent, entry = listing.get(id)) {
      seen.add(id);
      const parent = listing.get(entry.parent);
      if (Object.isUndefined(parent) || !(parent.start <= entry.start))
        return false;
      if (entry.parent === ancestorId)
        return true;
    }
    return false;
  }
}
