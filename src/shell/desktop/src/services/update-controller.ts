/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { UpdateStateKind } from "../enums/update-state-kind.js";
import { StaleUpdateException } from "../exceptions/stale-update.exception.js";
import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { UpdateStopException } from "../exceptions/update-stop.exception.js";
import { UpdateException } from "../exceptions/update.exception.js";
import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import type { IUpdateCheckLock } from "../interfaces/i-update-check-lock.js";
import type { IUpdater } from "../interfaces/i-updater.js";
import { UpdateReadyRecord } from "../models/update-ready-record.js";
import { UpdateStatus } from "../models/update-status.js";
import { Resources } from "../resources.js";

export class UpdateController {
  private readonly updater: IUpdater;
  private readonly record: IDeviceFileStore;
  private readonly lock: IUpdateCheckLock;
  private readonly currentVersion: string;
  private readonly mustMove: boolean;
  private readonly refusal: string | null;
  private readonly publish: (status: UpdateStatus) => void;
  private readonly postReadyAsync: (version: string) => Promise<boolean>;
  private readonly log: (text: string) => void;
  private readonly now: () => number;
  private readonly schedule: (delay: number, run: () => void) => () => void;
  private readonly restartAsync: ((record: UpdateReadyRecord) => Promise<void>) | null;
  private current: UpdateStatus = new UpdateStatus(UpdateStateKind.UpToDate, null, null, null, null, false);
  private ready: UpdateReadyRecord | null = null;
  private choice: string = Resources.automaticUpdateChecks;
  private startedAt: number | null = null;
  private lastAutomatic: number | null = null;
  private cancelTimer: (() => void) | null = null;
  private isNotifying: boolean = false;
  private isNotifyPending: boolean = false;
  private isStopped: boolean = false;
  private isRestarting: boolean = false;

  public constructor(
    updater: IUpdater,
    record: IDeviceFileStore,
    lock: IUpdateCheckLock,
    currentVersion: string,
    mustMove: boolean,
    refusal: string | null,
    publish: (status: UpdateStatus) => void,
    postReadyAsync: (version: string) => Promise<boolean>,
    log: (text: string) => void,
    now: () => number,
    schedule: (delay: number, run: () => void) => () => void,
    restartAsync: ((record: UpdateReadyRecord) => Promise<void>) | null) {
    this.updater = updater;
    this.record = record;
    this.lock = lock;
    this.currentVersion = currentVersion;
    this.mustMove = mustMove;
    this.refusal = refusal;
    this.publish = publish;
    this.postReadyAsync = postReadyAsync;
    this.log = log;
    this.now = now;
    this.schedule = schedule;
    this.restartAsync = restartAsync;
  }

  public static async hashFileAsync(file: string): Promise<string> {
    const hash = createHash(Resources.sha512Algorithm);
    for await (const chunk of createReadStream(file))
      hash.update(chunk);
    return hash.digest(Resources.base64Encoding);
  }

  public get status(): UpdateStatus {
    return this.current;
  }

  public async startAsync(): Promise<void> {
    this.startedAt = this.now();
    const record = await this.readRecordAsync();
    if (!Object.isNull(record))
      this.adopt(record, null);
    this.arm();
  }

  public follow(choice: JsonValue): void {
    const next = Object.isString(choice) && Resources.updateCheckChoices.includes(choice) ? choice : Resources.automaticUpdateChecks;
    if (next === this.choice)
      return;
    this.choice = next;
    this.arm();
  }

  public act(action: unknown): boolean {
    if (this.isStopped)
      return false;
    if (action === Resources.updateCheckAction && !this.current.isBusy) {
      void this.checkAsync(true);
      return true;
    }
    const ready = this.ready;
    const restartAsync = this.restartAsync;
    if (action !== Resources.updateRestartAction || Object.isNull(ready) || Object.isNull(restartAsync) || this.isRestarting)
      return false;
    void this.restartReadyAsync(ready, restartAsync);
    return true;
  }

  public async notifyAsync(): Promise<void> {
    if (this.isNotifying) {
      this.isNotifyPending = true;
      return;
    }
    this.isNotifying = true;
    try {
      do {
        this.isNotifyPending = false;
        await this.notifyOnceAsync();
      } while (this.isNotifyPending);
    }
    finally {
      this.isNotifying = false;
    }
  }

  public stop(): void {
    this.isStopped = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.updater.cancel();
  }

  private async restartReadyAsync(ready: UpdateReadyRecord, restartAsync: (record: UpdateReadyRecord) => Promise<void>): Promise<void> {
    this.isRestarting = true;
    if (!Object.isNull(this.current.reason))
      this.set(new UpdateStatus(UpdateStateKind.Ready, ready.version, null, this.current.checkedAt, null, false));
    try {
      await restartAsync(ready);
    }
    catch (error) {
      const reason = this.explain(error);
      if (!(error instanceof StaleUpdateException)) {
        this.set(new UpdateStatus(UpdateStateKind.Ready, ready.version, null, this.current.checkedAt, reason, false));
        return;
      }
      this.ready = null;
      this.set(new UpdateStatus(UpdateStateKind.Failed, null, null, this.current.checkedAt, reason, this.mustMove));
      await this.record.deleteAsync().catch((failure: unknown) => this.log(Resources.formatUpdateRecordDropped(String(failure))));
    }
    finally {
      this.isRestarting = false;
    }
  }

  private async notifyOnceAsync(): Promise<void> {
    const ready = this.ready;
    if (Object.isNull(ready) || ready.isNotified || this.isStopped)
      return;
    try {
      const stored = await this.record.readAsync();
      const notified = Object.isNull(stored) ? null : UpdateReadyRecord.fromJson(stored);
      if (notified?.version === ready.version && notified.isNotified) {
        this.ready = notified;
        return;
      }
      if (!await this.postReadyAsync(ready.version))
        return;
      this.ready = ready.notified();
      await this.record.writeAsync(this.ready.toJson());
    }
    catch (error) {
      this.log(Resources.formatUpdateNotNotified(String(error)));
    }
  }

  private arm(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    const startedAt = this.startedAt;
    if (Object.isNull(startedAt) || this.isStopped || this.choice === Resources.onRequestUpdateChecks
      || (this.choice === Resources.updateChecksAtStart && !Object.isNull(this.lastAutomatic)))
      return;
    const due = Object.isNull(this.lastAutomatic) ? startedAt + Resources.firstUpdateCheckDelay : this.lastAutomatic + Resources.updateCheckInterval;
    this.cancelTimer = this.schedule(Math.max(0, due - this.now()), () => {
      this.cancelTimer = null;
      this.lastAutomatic = this.now();
      if (!this.current.isBusy)
        void this.checkAsync(false);
      this.arm();
    });
  }

  private async checkAsync(isRequested: boolean): Promise<void> {
    const previous = this.current;
    this.set(new UpdateStatus(UpdateStateKind.Checking, null, null, previous.checkedAt, null, false));
    let isHeld: boolean;
    try {
      isHeld = await this.lock.tryAcquireAsync();
    }
    catch (error) {
      this.fail(previous, isRequested, error);
      return;
    }
    if (!isHeld) {
      this.set(isRequested ? new UpdateStatus(UpdateStateKind.Failed, null, null, previous.checkedAt, Resources.updateCheckedElsewhere, this.mustMove) : previous);
      return;
    }
    try {
      if (!this.isStopped)
        await this.checkHeldAsync(previous, isRequested);
    }
    finally {
      await this.lock.releaseAsync().catch((error: unknown) => this.log(Resources.formatUpdateCheckNotReleased(String(error))));
    }
  }

  private async checkHeldAsync(previous: UpdateStatus, isRequested: boolean): Promise<void> {
    const found = await this.inspectRecordAsync();
    if (found instanceof UpdateReadyRecord) {
      this.adopt(found, previous.checkedAt);
      return;
    }
    let version: string | null;
    try {
      version = await this.updater.checkAsync();
    }
    catch (error) {
      this.fail(previous, isRequested, error);
      return;
    }
    if (this.isStopped)
      return;
    const checkedAt = this.now();
    if (Object.isNull(version))
      this.set(new UpdateStatus(UpdateStateKind.UpToDate, null, null, checkedAt, null, false));
    else if (this.mustMove)
      this.set(new UpdateStatus(UpdateStateKind.Available, version, null, checkedAt, null, true));
    else if (!Object.isNull(this.refusal))
      this.set(new UpdateStatus(UpdateStateKind.Failed, null, null, checkedAt, this.refusal, false));
    else
      await this.downloadAsync(version, checkedAt);
  }

  private adopt(record: UpdateReadyRecord, checkedAt: number | null): void {
    if (this.mustMove) {
      this.set(new UpdateStatus(UpdateStateKind.Available, record.version, null, checkedAt, null, true));
      return;
    }
    if (!Object.isNull(this.refusal)) {
      this.set(new UpdateStatus(UpdateStateKind.Failed, null, null, checkedAt, this.refusal, false));
      return;
    }
    this.ready = record;
    this.set(new UpdateStatus(UpdateStateKind.Ready, record.version, null, checkedAt, null, false));
  }

  private async downloadAsync(version: string, checkedAt: number): Promise<void> {
    this.set(new UpdateStatus(UpdateStateKind.Downloading, version, null, checkedAt, null, false));
    let record: UpdateReadyRecord;
    try {
      const file = await this.updater.downloadAsync(t => {
        const progress = Math.min(100, Math.max(0, t));
        if (progress !== this.current.progress)
          this.set(new UpdateStatus(UpdateStateKind.Downloading, version, progress, checkedAt, null, false));
      });
      record = new UpdateReadyRecord(version, file, await UpdateController.hashFileAsync(file), false);
    }
    catch (error) {
      if (!this.isStopped)
        this.set(new UpdateStatus(UpdateStateKind.Failed, null, null, checkedAt, this.explain(error), false));
      return;
    }
    if (this.isStopped)
      return;
    this.ready = record;
    this.set(new UpdateStatus(UpdateStateKind.Ready, version, null, checkedAt, null, false));
    try {
      await this.record.writeAsync(record.toJson());
    }
    catch (error) {
      this.log(Resources.formatUpdateNotRecorded(String(error)));
    }
    await this.notifyAsync();
  }

  private async readRecordAsync(): Promise<UpdateReadyRecord | null> {
    const found = await this.inspectRecordAsync();
    if (!Object.isString(found))
      return found;
    this.log(Resources.formatUpdateRecordDropped(found));
    await this.record.deleteAsync().catch((error: unknown) => this.log(Resources.formatUpdateRecordDropped(String(error))));
    return null;
  }

  private async inspectRecordAsync(): Promise<UpdateReadyRecord | string | null> {
    try {
      const json = await this.record.readAsync();
      if (Object.isNull(json))
        return null;
      const record = UpdateReadyRecord.fromJson(json);
      if (!UpdateController.isNewer(record.version, this.currentVersion))
        return Resources.formatUpdateInstalled(record.version);
      if (record.file !== this.updater.packagePath)
        return Resources.updateFileElsewhere;
      if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
        return Resources.updateFileChanged;
      return record;
    }
    catch (error) {
      return String(error);
    }
  }

  private fail(previous: UpdateStatus, isRequested: boolean, error: unknown): void {
    const reason = this.explain(error);
    this.set(isRequested
      ? new UpdateStatus(UpdateStateKind.Failed, null, null, previous.checkedAt, reason, this.mustMove)
      : new UpdateStatus(previous.kind, previous.version, null, previous.checkedAt, reason, previous.mustMove));
  }

  private explain(error: unknown): string {
    const isKnown = error instanceof UpdateException || error instanceof UpdateStopException || error instanceof UpdateHandoffException;
    this.log(Resources.formatUpdateFailed((isKnown ? UpdateController.withCause(error) : String(error)).trim().replace(Resources.lineBreaks, Resources.lineJoin)));
    return isKnown ? error.message : Resources.updateFailedUnexpectedly;
  }

  private set(status: UpdateStatus): void {
    if (this.isStopped)
      return;
    this.current = status;
    this.publish(status);
  }

  private static withCause(error: Error): string {
    if (Object.isUndefined(error.cause))
      return error.message;
    const cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
    return error.message.includes(cause) ? error.message : Resources.formatFailureWithCause(error.message, cause);
  }

  private static isNewer(version: string, current: string): boolean {
    const next = version.split(Resources.versionSeparator).map(Number);
    const installed = current.split(Resources.versionSeparator).map(Number);
    const index = next.findIndex((t, i) => t !== installed[i]);
    return index >= 0 && Number(next[index]) > Number(installed[index]);
  }
}
