/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeProviderKindInstallation implements IProviderKindInstallation {
  private settle: { readonly resolve: (path: string) => void; readonly reject: (error: unknown) => void } | null = null;
  private readonly pending: {
    readonly promise: Promise<ProviderKindVersions>;
    readonly resolve: (versions: ProviderKindVersions) => void;
    readonly reject: (error: unknown) => void;
    readonly checksLatest: boolean;
  }[] = [];

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
    let resolve: (versions: ProviderKindVersions) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    this.read = new Promise((answer, fail) => {
      resolve = answer;
      reject = fail;
    });
    this.pending.push({ promise: this.read, resolve, reject, checksLatest });
    ChangeSignal.notify();
    return this.read;
  }

  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string> {
    this.installs++;
    ChangeSignal.notify();
    this.progress = progress;
    this.commit = commit;
    this.signal = signal;
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
      signal.addEventListener("abort", () => reject(new Error("The install was stopped.")), { once: true });
    });
  }

  public answerRead(): Promise<ProviderKindVersions> {
    const reading = this.pending.shift()!;
    reading.resolve(this.versionsFor(reading.checksLatest));
    return reading.promise;
  }

  public async failRead(): Promise<void> {
    const reading = this.pending.shift()!;
    reading.reject(new Error("The release channel didn't answer."));
    await reading.promise.catch(() => undefined);
  }

  public complete(): void {
    this.isInstalled = true;
    ChangeSignal.notify();
    this.settle!.resolve("/opt/provider/server");
  }

  public fail(error: unknown): void {
    this.settle!.reject(error);
  }

  private versionsFor(checksLatest: boolean): ProviderKindVersions {
    return checksLatest ? this.versions : new ProviderKindVersions(this.versions.installed, null);
  }
}
