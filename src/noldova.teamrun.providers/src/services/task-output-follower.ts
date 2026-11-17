/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readSync, statSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";

import "@noldova/context.core";
import { type ITimer, NodeTimer } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";
import { CommandOutputDecoder } from "./command-output-decoder.js";

export class TaskOutputFollower {
  private readonly path: string;
  private readonly write: (text: string) => void;
  private readonly timer: ITimer;
  private readonly interval: number;
  private readonly maximumBytes: number;
  private following: AbortController | null = null;
  private decoder: StringDecoder = new StringDecoder(Resources.utf8Encoding);
  private offset: number = 0;
  private file: { device: bigint; inode: bigint } | null = null;
  private held: string = String.empty;
  private context: number = 0;
  private shownContext: number = 0;
  private last: string = String.empty;
  private sent: boolean = false;

  public constructor(path: string, write: (text: string) => void, timer: ITimer = new NodeTimer(), interval: number = Resources.taskOutputFollowInterval,
    maximumBytes: number = Resources.maximumTaskOutputBytes) {
    this.path = path;
    this.write = write;
    this.timer = timer;
    this.interval = interval;
    this.maximumBytes = maximumBytes;
  }

  public get isFollowing(): boolean {
    return !Object.isNull(this.following);
  }

  public start(): void {
    this.read(false);
    this.following = new AbortController();
    void this.follow(this.following.signal);
  }

  public stop(): void {
    this.following?.abort();
    this.following = null;
  }

  public finish(): void {
    this.stop();
    this.read(true);
    this.flush(this.decoder.end());
  }

  public reads(path: string): boolean {
    try {
      const stats = statSync(path, { bigint: true });
      return !Object.isNull(this.file) && stats.dev === this.file.device && stats.ino === this.file.inode;
    }
    catch {
      return false;
    }
  }

  private async follow(signal: AbortSignal): Promise<void> {
    while (await this.waitAsync(signal))
      this.read(false);
  }

  private async waitAsync(signal: AbortSignal): Promise<boolean> {
    try {
      await this.timer.delayAsync(this.interval, signal);
    }
    catch {
      return false;
    }
    return !signal.aborted;
  }

  private read(final: boolean): void {
    let descriptor: number | null = null;
    try {
      descriptor = openSync(this.path, Resources.readFlag);
      const stats = fstatSync(descriptor, { bigint: true });
      const size = Number(stats.size);
      if (size < this.offset || (!Object.isNull(this.file) && (stats.dev !== this.file.device || stats.ino !== this.file.inode))) {
        this.flush(this.decoder.end());
        this.restart(0);
      }
      this.file = { device: stats.dev, inode: stats.ino };
      const limit = this.sent ? this.maximumBytes * Resources.followedTaskOutputFactor : this.maximumBytes;
      const cut = size - this.offset > limit;
      if (cut)
        this.restart(size - limit);
      const buffer = Buffer.alloc(size - this.offset);
      const length = readSync(descriptor, buffer, 0, buffer.length, this.offset);
      this.offset += length;
      const decoded = this.decoder.write(buffer.subarray(0, length));
      const text = cut ? decoded.replace(Resources.leadingReplacementPattern, String.empty) : decoded;
      if (final)
        this.flush(text);
      else
        this.send(text, length === 0 ? 0 : Resources.minimumUtf16Run);
    }
    catch {
      return;
    }
    finally {
      if (!Object.isNull(descriptor))
        closeSync(descriptor);
    }
  }

  private send(text: string, keep: number): void {
    let pending = this.held + text;
    if (this.joins(pending)) {
      pending = this.last + pending;
      this.context = this.last.length;
      this.shownContext = CommandOutputDecoder.decode(this.last).length;
    }
    const at = TaskOutputFollower.heldFrom(pending, keep);
    if (at < this.context) {
      this.held = pending;
      return;
    }
    this.held = pending.slice(at);
    if (at > 0)
      this.last = TaskOutputFollower.tailOf(pending.slice(0, at));
    this.emit(pending.slice(0, at));
  }

  private joins(pending: string): boolean {
    if (this.context > 0 || this.last.length === 0 || pending.length === 0)
      return false;
    return this.last.length > 1 || (pending.startsWith(Resources.nulCharacter) && Resources.utf16ContextPattern.test(this.last));
  }

  private flush(text: string): void {
    const pending = this.held + text;
    this.held = String.empty;
    this.last = pending.slice(-1);
    this.emit(pending);
  }

  private restart(offset: number): void {
    this.offset = offset;
    this.decoder = new StringDecoder(Resources.utf8Encoding);
    this.held = String.empty;
    this.context = 0;
    this.shownContext = 0;
    this.last = String.empty;
  }

  private emit(text: string): void {
    const shown = CommandOutputDecoder.decode(text).slice(this.shownContext);
    this.context = 0;
    this.shownContext = 0;
    if (shown.length === 0)
      return;
    this.sent = true;
    this.write(shown);
  }

  private static heldFrom(text: string, keep: number): number {
    const held = Resources.utf16HeldEndPattern.exec(text)?.index ?? text.length;
    const run = [...text.matchAll(Resources.utf16RunPattern)].at(-1);
    if (Object.isUndefined(run) || run.index + run[0].length < text.length - 1)
      return held;
    const end = run.index + run[0].length === text.length ? text.length : held;
    const pairs = run[0].replace(Resources.utf16LeadingMarkPattern, String.empty);
    const mark = run[0].length - pairs.length;
    const sendable = Math.floor(pairs.length / 2) - keep;
    const from = sendable >= (mark > 0 ? 1 : Resources.minimumUtf16Run) ? run.index + mark + sendable * 2
      : Resources.utf16TrailingMarkPattern.exec(text.slice(0, run.index))?.index ?? run.index;
    return Math.min(from, end);
  }

  private static tailOf(sent: string): string {
    const run = [...sent.matchAll(Resources.utf16RunPattern)].at(-1);
    const pairs = run?.[0].replace(Resources.utf16LeadingMarkPattern, String.empty) ?? String.empty;
    const isLong = pairs.length >= Resources.minimumUtf16Run * 2;
    if (Object.isUndefined(run) || run.index + run[0].length !== sent.length || (!isLong && pairs.length === run[0].length))
      return sent.slice(-1);
    return isLong ? pairs.slice(-Resources.minimumUtf16Run * 2) : run[0];
  }
}
