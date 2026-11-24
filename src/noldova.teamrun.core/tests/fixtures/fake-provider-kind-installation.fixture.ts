/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";
import { HeldInstall } from "./held-install.fixture.js";
import { PendingRead } from "./pending-read.fixture.js";

export class FakeProviderKindInstallation implements IProviderKindInstallation {
  private held: HeldInstall | null = null;
  private readonly pending: PendingRead[] = [];

  public unavailable: string | null = null;
  public missingTool: string | null = null;
  public isInstalled: boolean = false;
  public foundPath: string | null = null;
  public notInstalledReason: string | null = null;
  public versions: ProviderKindVersions = ProviderKindVersions.unknown;
  public holdReads: boolean = false;
  public read: Promise<ProviderKindVersions> = Promise.resolve(ProviderKindVersions.unknown);
  public reads: number = 0;
  public readonly checks: boolean[] = [];
  public installs: number = 0;
  public progress: (received: number, total: number) => void = () => undefined;
  public commit: () => void = () => undefined;
  public signal: AbortSignal | null = null;

  public readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    this.reads++;
    this.checks.push(checksLatest);
    ChangeSignal.notify();
    if (!this.holdReads) {
      this.read = Promise.resolve(this.versionsFor(checksLatest));
      return this.read;
    }
    const reading = new PendingRead(checksLatest);
    this.read = reading.promise;
    this.pending.push(reading);
    ChangeSignal.notify();
    return this.read;
  }

  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string> {
    this.installs++;
    ChangeSignal.notify();
    this.progress = progress;
    this.commit = commit;
    this.signal = signal;
    const held = new HeldInstall(signal);
    this.held = held;
    return held.promise;
  }

  public answerRead(): Promise<ProviderKindVersions> {
    const reading = this.nextRead();
    return reading.answer(this.versionsFor(reading.checksLatest));
  }

  public failRead(): Promise<void> {
    return this.nextRead().fail(new Error("The release channel didn't answer."));
  }

  public complete(): void {
    this.isInstalled = true;
    ChangeSignal.notify();
    this.heldInstall().complete("/opt/provider/server");
  }

  public fail(error: unknown): void {
    this.heldInstall().fail(error);
  }

  private nextRead(): PendingRead {
    const reading = this.pending.shift();
    if (Object.isUndefined(reading))
      throw new Error("No read is waiting for an answer.");
    return reading;
  }

  private heldInstall(): HeldInstall {
    if (Object.isNull(this.held))
      throw new Error("No install is running.");
    return this.held;
  }

  private versionsFor(checksLatest: boolean): ProviderKindVersions {
    return checksLatest ? this.versions : new ProviderKindVersions(this.versions.installed, null, this.versions.notice);
  }
}
