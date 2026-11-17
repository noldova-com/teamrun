/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type EnvironmentInjector, type Signal, type WritableSignal, signal } from "@angular/core";

import {
  type TerminalRun, TerminalRunBusy, TerminalRunNotFoundException, TerminalRunNotTypedException, TerminalRunOutcome, type TerminalRunOutput, TerminalRunTarget,
  type TerminalShellKind
} from "@noldova/terminal.window";
import { ShellRunState } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import type { IBusyRun } from "../interfaces/i-busy-run";
import type { IInlineTerminal } from "../interfaces/i-inline-terminal";
import type { IKeptRuns } from "../interfaces/i-kept-runs";
import type { IRunPlace } from "../interfaces/i-run-place";
import type { IRunState } from "../interfaces/i-run-state";
import type { IRunStarter } from "../interfaces/i-run-starter";
import type { IStoredRun } from "../interfaces/i-stored-run";

export class InlineTerminals {
  private readonly starter: IRunStarter;
  private readonly open: (sessionId: string, injector: EnvironmentInjector, rows: number) => IInlineTerminal;
  private readonly terminals: Map<string, { readonly sessionId: string; terminal: IInlineTerminal | null; focuses: boolean; rows: number }> = new Map();
  private readonly latest: Map<string, { readonly run: TerminalRun; readonly place: IRunPlace | null }> = new Map();
  private readonly placed: WritableSignal<ReadonlyMap<string, IRunPlace>> = signal(new Map());
  private readonly busy: WritableSignal<ReadonlyMap<string, IBusyRun>> = signal(new Map());
  private readonly stored: WritableSignal<ReadonlyMap<string, readonly IStoredRun[]>> = signal(new Map());
  private readonly states: WritableSignal<ReadonlyMap<string, readonly IRunState[]>> = signal(new Map());
  private readonly closedAt: Map<string, number> = new Map();
  private readonly kept: IKeptRuns | null;
  private readonly loaded: Set<string> = new Set();
  private closings: number = 0;
  private disposedAt: number = 0;
  private shownOwner: string | null = null;

  public constructor(starter: IRunStarter, open: (sessionId: string, injector: EnvironmentInjector, rows: number) => IInlineTerminal,
    kept: IKeptRuns | null = null) {
    this.starter = starter;
    this.open = open;
    this.kept = kept;
  }

  public get places(): Signal<ReadonlyMap<string, IRunPlace>> {
    return this.placed.asReadonly();
  }

  public async runAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    place: IRunPlace | null = null): Promise<void> {
    await this.startAsync(owner, command, folder, shellKinds, place, TerminalRunBusy.Refuse);
  }

  public async answerBusyAsync(owner: string, stop: boolean): Promise<void> {
    const waiting = this.busy().get(owner);
    if (waiting === undefined)
      return;
    await this.startAsync(owner, waiting.command, waiting.folder, waiting.shellKinds, waiting.place, stop ? TerminalRunBusy.Interrupt : null);
  }

  public blocksOf(owner: string, messageId: string): ReadonlyMap<string, ReadonlySet<number>> {
    const places = [this.placed().get(owner), this.busy().get(owner)?.place, ...(this.stored().get(owner) ?? []).map(t => t.place)];
    const blocks = new Map<string, Set<number>>();
    for (const place of places)
      if (place?.messageId === messageId)
        blocks.set(place.site, (blocks.get(place.site) ?? new Set()).add(place.block));
    return blocks;
  }

  public statesOf(owner: string, messageId: string): ReadonlyMap<string, ReadonlyMap<number, ShellRunState>> {
    const states = new Map<string, Map<number, ShellRunState>>();
    for (const { place, state } of this.states().get(owner) ?? [])
      if (place.messageId === messageId)
        states.set(place.site, (states.get(place.site) ?? new Map<number, ShellRunState>()).set(place.block, state));
    return states;
  }

  public isLiveAt(owner: string, place: IRunPlace): boolean {
    return InlineTerminals.isSame(this.placed().get(owner), place);
  }

  public isBusyAt(owner: string, place: IRunPlace): boolean {
    return InlineTerminals.isSame(this.busy().get(owner)?.place, place);
  }

  public outputAt(owner: string, place: IRunPlace): TerminalRunOutput | null {
    return this.stored().get(owner)?.find(t => InlineTerminals.isSame(t.place, place))?.output ?? null;
  }

  public of(owner: string): IInlineTerminal | null {
    return this.terminals.get(owner)?.terminal ?? null;
  }

  public attach(owner: string, place: IRunPlace, host: HTMLElement, injector: EnvironmentInjector): void {
    const current = this.terminals.get(owner);
    if (current === undefined || !this.isLiveAt(owner, place))
      return;
    current.terminal ??= this.open(current.sessionId, injector, current.rows);
    host.append(current.terminal.element);
    current.terminal.setShown(owner === this.shownOwner);
    if (current.focuses) {
      current.focuses = false;
      current.terminal.focus();
    }
  }

  public detach(owner: string, host: HTMLElement): void {
    const current = this.terminals.get(owner);
    const terminal = current?.terminal ?? null;
    if (current === undefined || Object.isNull(terminal) || terminal.element.parentElement !== host)
      return;
    current.focuses ||= terminal.element.contains(document.activeElement);
    terminal.setShown(false);
    terminal.element.remove();
  }

  public fit(owner: string, historyHeight: number): void {
    const current = this.terminals.get(owner);
    if (current === undefined || Object.isNull(current.terminal))
      return;
    const terminal = current.terminal;
    const rowHeight = terminal.rowHeight();
    if (rowHeight === 0)
      return;
    const half = Math.min(Resources.inlineTerminalRows, Math.floor(historyHeight / 2 / rowHeight + Resources.inlineTerminalRowTolerance));
    const held = Math.floor(historyHeight / rowHeight + Resources.inlineTerminalRowTolerance) - 1;
    const rows = Math.max(1, Math.min(held, Math.max(Resources.inlineTerminalMinimumRows, half)));
    if (rows === current.rows)
      return;
    current.rows = rows;
    terminal.setMaximumRows(rows);
  }

  public show(owner: string | null): void {
    this.shownOwner = owner;
    for (const [key, { terminal }] of this.terminals)
      terminal?.setShown(key === owner && terminal.element.isConnected);
    if (!Object.isNull(owner))
      void this.loadAsync(owner);
  }

  public close(owner: string): void {
    this.closedAt.set(owner, ++this.closings);
    this.loaded.delete(owner);
    this.terminals.get(owner)?.terminal?.dispose();
    this.terminals.delete(owner);
    this.latest.delete(owner);
    this.place(owner, null);
    this.unbusy(owner);
    this.stored.set(InlineTerminals.without(this.stored(), owner));
    this.states.set(InlineTerminals.without(this.states(), owner));
  }

  public dispose(): void {
    this.disposedAt = ++this.closings;
    this.loaded.clear();
    for (const { terminal } of this.terminals.values())
      terminal?.dispose();
    this.terminals.clear();
    this.latest.clear();
    this.placed.set(new Map());
    this.busy.set(new Map());
    this.stored.set(new Map());
    this.states.set(new Map());
  }

  private async startAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[], place: IRunPlace | null,
    whenBusy: TerminalRunBusy | null): Promise<void> {
    const current = this.terminals.get(owner);
    const target = current === undefined || Object.isNull(whenBusy) ? null : new TerminalRunTarget(current.sessionId, whenBusy);
    const before = this.placed().get(owner) ?? null;
    const opened = this.closings;
    this.unbusy(owner);
    let run: TerminalRun;
    try {
      run = await this.starter.startRunAsync(owner, command, folder, shellKinds, target, t => this.adopt(owner, t, place, opened));
    }
    catch (error) {
      if (Object.isNull(target) || !(error instanceof TerminalRunNotTypedException))
        throw error;
      if (error.reason !== TerminalRunOutcome.Busy && error.reason !== TerminalRunOutcome.Ended)
        throw error;
      if (error.reason === TerminalRunOutcome.Busy) {
        const entry = this.terminals.get(owner);
        if (entry === undefined)
          return;
        entry.focuses = false;
        this.place(owner, before);
        if (!Object.isNull(place))
          this.busy.set(new Map([...this.busy(), [owner, { place, command, folder, shellKinds }]]));
        return;
      }
      run = await this.starter.startRunAsync(owner, command, folder, shellKinds, null, t => this.adopt(owner, t, place, opened));
    }
    if (this.isClosedSince(owner, opened))
      return;
    if (!Object.isNull(place))
      this.track(owner, place, run);
    const earlier = this.latest.get(owner);
    this.latest.set(owner, { run, place });
    if (earlier !== undefined && !Object.isNull(earlier.place) && !InlineTerminals.isSame(earlier.place, place))
      await this.storeAsync(owner, earlier.place, earlier.run);
  }

  private adopt(owner: string, sessionId: string, place: IRunPlace | null, opened: number): void {
    if (this.isClosedSince(owner, opened))
      return;
    const current = this.terminals.get(owner);
    if (current?.sessionId === sessionId) {
      current.focuses = true;
      if (!Object.isNull(current.terminal) && InlineTerminals.isSame(this.placed().get(owner), place)) {
        current.focuses = false;
        current.terminal.focus();
      }
    }
    else {
      current?.terminal?.dispose();
      this.terminals.set(owner, { sessionId, terminal: null, focuses: true, rows: current?.rows ?? Resources.inlineTerminalRows });
    }
    this.place(owner, place);
  }

  private async storeAsync(owner: string, place: IRunPlace, run: TerminalRun): Promise<void> {
    let output: TerminalRunOutput;
    try {
      output = await this.starter.readRunOutputAsync(run);
    }
    catch (error) {
      if (error instanceof TerminalRunNotFoundException)
        return;
      throw error;
    }
    if (output.lines.length === 0 || !this.terminals.has(owner) || this.isLiveAt(owner, place))
      return;
    const kept = (this.stored().get(owner) ?? []).filter(t => !InlineTerminals.isSame(t.place, place));
    this.stored.set(new Map([...this.stored(), [owner, [...kept, { place, output }]]]));
    this.kept?.save(owner, { place, output });
  }

  private async loadAsync(owner: string): Promise<void> {
    const kept = this.kept;
    if (Object.isNull(kept) || this.loaded.has(owner))
      return;
    this.loaded.add(owner);
    const opened = this.closings;
    const runs = await kept.listAsync(owner);
    if (this.isClosedSince(owner, opened))
      return;
    const current = this.stored().get(owner) ?? [];
    const added = runs.filter(t => !this.isLiveAt(owner, t.place) && !current.some(u => InlineTerminals.isSame(u.place, t.place)));
    if (added.length > 0)
      this.stored.set(new Map([...this.stored(), [owner, [...added, ...current]]]));
  }

  private track(owner: string, place: IRunPlace, run: TerminalRun): void {
    const kept = (this.states().get(owner) ?? []).filter(t => !InlineTerminals.isSame(t.place, place));
    this.states.set(new Map([...this.states(), [owner, [...kept, { place, run, state: ShellRunState.Running }]]]));
    void run.ended.then(() => this.end(owner, run));
  }

  private end(owner: string, run: TerminalRun): void {
    const entries = this.states().get(owner) ?? [];
    if (entries.some(t => t.run === run))
      this.states.set(new Map([...this.states(), [owner, entries.map(t => t.run === run ? { ...t, state: ShellRunState.Ended } : t)]]));
  }

  private place(owner: string, place: IRunPlace | null): void {
    const places = new Map(this.placed());
    if (Object.isNull(place))
      places.delete(owner);
    else
      places.set(owner, place);
    this.placed.set(places);
    const kept = this.stored().get(owner);
    if (!Object.isNull(place) && kept?.some(t => InlineTerminals.isSame(t.place, place)) === true)
      this.stored.set(new Map([...this.stored(), [owner, kept.filter(t => !InlineTerminals.isSame(t.place, place))]]));
  }

  private isClosedSince(owner: string, opened: number): boolean {
    return (this.closedAt.get(owner) ?? 0) > opened || this.disposedAt > opened;
  }

  private unbusy(owner: string): void {
    if (this.busy().has(owner))
      this.busy.set(InlineTerminals.without(this.busy(), owner));
  }

  private static without<T>(map: ReadonlyMap<string, T>, key: string): ReadonlyMap<string, T> {
    const left = new Map(map);
    left.delete(key);
    return left;
  }

  private static isSame(first: IRunPlace | null | undefined, second: IRunPlace | null | undefined): boolean {
    return first?.messageId === second?.messageId && first?.site === second?.site && first?.block === second?.block;
  }
}
