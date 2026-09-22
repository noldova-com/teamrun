/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Guid } from "@noldova/teamrun-foundation-core";
import { MethodName, UpdateOperation } from "@noldova/teamrun-protocol";
import { InstallationRole, InstallationUpdate, InstallationUpdatePhase, LockFile, ProcessProbe, RuntimeSettings, RuntimeTimings,
  type InstallationMember, type InstallationRegistry } from "@noldova/teamrun-runtime";

import type { IRestartProcesses } from "../interfaces/i-restart-processes.js";
import type { IUpdateRestart } from "../interfaces/i-update-restart.js";
import { UpdateParticipant } from "../models/update-participant.js";
import { Resources } from "../resources.js";

export class RestartCoordinator implements IUpdateRestart {
  private readonly registry: InstallationRegistry;
  private readonly owner: InstallationMember;
  private readonly processes: IRestartProcesses;
  private readonly permitQuit: (value: boolean) => void;
  private readonly backup: (dataDirectory: string, operationId: string) => Promise<void>;
  private readonly timings: RuntimeTimings;
  private running: boolean = false;

  public constructor(registry: InstallationRegistry, owner: InstallationMember, processes: IRestartProcesses,
    permitQuit: (value: boolean) => void, backup: (dataDirectory: string, operationId: string) => Promise<void>,
    timings: RuntimeTimings = RuntimeTimings.createDefault()) {
    this.registry = registry;
    this.owner = owner;
    this.processes = processes;
    this.permitQuit = permitQuit;
    this.backup = backup;
    this.timings = timings;
  }

  public async install(version: string, install: () => Promise<void>): Promise<void> {
    if (this.running)
      throw new Error(Resources.updatePreparationExpired);
    this.running = true;
    const id = Guid.createVersion7().toString();
    const operation = new UpdateOperation(id);
    const participants: UpdateParticipant[] = [];
    const paused: UpdateParticipant[] = [];
    const closed: InstallationMember[] = [];
    let heartbeat: NodeJS.Timeout | null = null;
    let renewing: Promise<void> | null = null;
    let leaseFailed = false;
    let handedOff = false;
    const lease = (): InstallationUpdate => new InstallationUpdate(id, this.owner.id, version, InstallationUpdatePhase.Preparing,
      Date.now() + Resources.updatePreparationLeaseMilliseconds);
    const assertLease = (): void => {
      if (leaseFailed || !this.registry.isPreparing(id))
        throw new Error(Resources.updatePreparationExpired);
    };
    try {
      const members = this.registry.begin(lease());
      this.assertKnownRuntimes(members);
      heartbeat = setInterval(() => {
        if (!Object.isNull(renewing))
          return;
        renewing = Promise.resolve().then(async () => {
          this.registry.renew(lease());
          for (const participant of paused)
            if (participant.client.isConnected)
              await participant.call(MethodName.RuntimePause, null, Resources.updatePreparationExpired);
        }).catch(() => { leaseFailed = true; }).finally(() => { renewing = null; });
      }, Resources.updateRenewMilliseconds);
      for (const member of members) {
        assertLease();
        participants.push(await UpdateParticipant.connect(member, this.timings));
      }
      for (const participant of participants.filter(t => t.member.role === InstallationRole.Runtime)) {
        assertLease();
        await participant.call(MethodName.RuntimePause, null, Resources.updateActiveWork);
        paused.push(participant);
      }
      for (const participant of participants.filter(t => t.member.role === InstallationRole.Desktop)) {
        assertLease();
        await participant.call(MethodName.DesktopPrepareUpdate, operation.toJson(), Resources.updateWorkspaceNotReady);
      }
      for (const participant of [...paused]) {
        await renewing;
        assertLease();
        // Stop renewing this runtime's lease once shutdown has committed; its endpoint then refuses all requests.
        const index = paused.indexOf(participant);
        paused.splice(index, 1);
        await participant.call(MethodName.RuntimeStopForUpdate, null, Resources.updateShutdownNotConfirmed);
        await this.processes.waitForExit(participant.member.processId);
      }
      for (const directory of new Set(members.map(t => t.dataDirectory))) {
        assertLease();
        await this.backup(directory, id);
      }
      if (!Object.isNull(heartbeat))
        clearInterval(heartbeat);
      heartbeat = null;
      await renewing;
      assertLease();
      this.registry.markInstalling(id);
      for (const participant of participants.filter(t => t.member.role === InstallationRole.Desktop && t.member.id !== this.owner.id)) {
        await participant.call(MethodName.DesktopCloseForUpdate, operation.toJson(), Resources.updateCloseNotConfirmed);
        closed.push(participant.member);
        await this.processes.waitForExit(participant.member.processId);
      }
      if (!this.registry.isInstalling(id))
        throw new Error(Resources.updatePreparationExpired);
      this.permitQuit(true);
      await install();
      handedOff = true;
    }
    finally {
      if (!Object.isNull(heartbeat))
        clearInterval(heartbeat);
      await renewing;
      try {
        if (!handedOff) {
          this.permitQuit(false);
          let releaseFailed = false;
          try { this.registry.release(id); }
          catch { releaseFailed = true; }
          await Promise.allSettled(participants.map(t => t.call(t.member.role === InstallationRole.Runtime ? MethodName.RuntimeResume
            : MethodName.DesktopResumeUpdate, t.member.role === InstallationRole.Runtime ? null : operation.toJson(), Resources.updateRecoveryFailed)));
          const restored = await Promise.allSettled(closed.map(async t => {
            await this.processes.waitForExit(t.processId);
            await this.processes.reopen(t.dataDirectory);
          }));
          if (releaseFailed || restored.some(t => t.status === Resources.updateRejectedPromise))
            throw new Error(Resources.updateRecoveryFailed);
        }
      }
      finally {
        for (const participant of participants)
          participant.client.close();
        this.running = false;
      }
    }
  }

  private assertKnownRuntimes(members: readonly InstallationMember[]): void {
    for (const directory of new Set(members.map(t => t.dataDirectory))) {
      const settings = RuntimeSettings.forPlatform(process.platform, directory, this.owner.productVersion, null);
      const lock = new LockFile(settings.lockPath, new ProcessProbe()).readLive();
      if (!Object.isNull(lock) && !members.some(t => t.role === InstallationRole.Runtime && t.processId === lock.processId && t.dataDirectory === directory))
        throw new Error(Resources.updateUnknownRuntime);
    }
    if (members.some(t => t.productVersion !== this.owner.productVersion))
      throw new Error(Resources.updateUnknownRuntime);
  }
}
