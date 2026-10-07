/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { StaleUpdateException } from "../exceptions/stale-update.exception.js";
import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import type { INativeUpdater } from "../interfaces/i-native-updater.js";
import type { IShipItProcess } from "../interfaces/i-ship-it-process.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { IUpdater } from "../interfaces/i-updater.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class SquirrelHandoff implements IUpdateHandoff {
  private readonly updater: IUpdater;
  private readonly native: INativeUpdater;
  private readonly shipIt: IShipItProcess;
  private readonly schedule: (delay: number, run: () => void) => () => void;
  private readonly log: (text: string) => void;
  private lateStage: (() => void) | null = null;

  public constructor(
    updater: IUpdater,
    native: INativeUpdater,
    shipIt: IShipItProcess,
    schedule: (delay: number, run: () => void) => () => void,
    log: (text: string) => void) {
    this.updater = updater;
    this.native = native;
    this.shipIt = shipIt;
    this.schedule = schedule;
    this.log = log;
  }

  public async clearAsync(): Promise<void> {
    await this.shipIt.removeStoppedAsync().catch((error: unknown) => this.log(Resources.formatStoppedShipItNotRemoved(String(error))));
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<number> {
    if (this.updater.downloadedFile !== record.file) {
      if (await this.updater.checkAsync() !== record.version)
        throw new StaleUpdateException(Resources.formatUpdateNoLongerOffered(record.version));
      await this.updater.downloadAsync(() => undefined);
    }
    if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new StaleUpdateException(Resources.updateChangedBeforeHandoff);
    try {
      await this.stageAsync();
      const processId = await this.shipIt.findAsync();
      if (Object.isNull(processId))
        throw new UpdateHandoffException(Resources.shipItNotFound);
      return processId;
    }
    catch (error) {
      await this.removeShipItAsync();
      throw error;
    }
  }

  private stageAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (failure: UpdateHandoffException | null): void => {
        cancel();
        this.native.removeListener(Resources.squirrelStagedEvent, onStaged);
        this.native.removeListener(Resources.errorEvent, onFailed);
        if (Object.isNull(failure))
          resolve();
        else
          reject(failure);
      };
      const onStaged = (): void => finish(null);
      const onFailed = (error: unknown): void => finish(new UpdateHandoffException(Resources.updateNotStaged, new ExceptionOptions(error)));
      const cancel = this.schedule(Resources.updateStageLimit, () => {
        finish(new UpdateHandoffException(Resources.updateNotStagedInTime));
        this.lateStage = () => {
          this.forgetLateStage();
          void this.removeShipItAsync();
        };
        this.native.on(Resources.squirrelStagedEvent, this.lateStage);
      });
      this.native.on(Resources.squirrelStagedEvent, onStaged);
      this.native.on(Resources.errorEvent, onFailed);
      this.forgetLateStage();
      try {
        this.native.checkForUpdates();
      }
      catch (error) {
        onFailed(error);
      }
    });
  }

  private forgetLateStage(): void {
    if (!Object.isNull(this.lateStage))
      this.native.removeListener(Resources.squirrelStagedEvent, this.lateStage);
    this.lateStage = null;
  }

  private async removeShipItAsync(): Promise<void> {
    await this.shipIt.removeAsync().catch((error: unknown) => this.log(Resources.formatStagedUpdateKept(String(error))));
  }
}
