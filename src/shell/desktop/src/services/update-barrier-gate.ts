/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { type Installation, UpdateBarrierState, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";

import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";

export class UpdateBarrierGate {
  private readonly installation: Pick<Installation, "readAsync" | "readTextAsync" | "checkAsync" | "removeAsync">;
  private readonly productVersion: string;
  private readonly dialog: IDialogHost;
  private readonly log: (text: string) => void;

  public constructor(installation: Pick<Installation, "readAsync" | "readTextAsync" | "checkAsync" | "removeAsync">, productVersion: string, dialog: IDialogHost, log: (text: string) => void) {
    this.installation = installation;
    this.productVersion = productVersion;
    this.dialog = dialog;
    this.log = log;
  }

  public async passAsync(): Promise<boolean> {
    let status: UpdateBarrierStatus;
    try {
      const found = await this.installation.readAsync().catch(() => null);
      status = await this.installation.checkAsync(this.productVersion);
      if (status === UpdateBarrierStatus.None && !Object.isNull(found) && found.state !== UpdateBarrierState.HandedOff)
        this.log(Resources.updateStoppedBeforeHandoff);
    }
    catch (error) {
      this.log(Resources.formatBarrierUnreadable(String(error)));
      return true;
    }
    return await this.askAsync(status);
  }

  public async askAsync(status: UpdateBarrierStatus): Promise<boolean> {
    if (status === UpdateBarrierStatus.Held) {
      await this.dialog.showMessageBox(null, {
        type: Resources.infoBoxType, message: Resources.updateInstalling, detail: Resources.updateInstallingDetail, buttons: [Resources.okButton], defaultId: 0, cancelId: 0, noLink: true
      });
      return false;
    }
    if (status === UpdateBarrierStatus.None)
      return true;
    const buttons = [Resources.quitButton, Resources.openApplicationButton];
    const { response } = await this.dialog.showMessageBox(null, {
      type: Resources.warningBoxType, message: Resources.updateUnfinished, detail: Resources.updateUnfinishedDetail, buttons, defaultId: 0, cancelId: 0, noLink: true
    });
    if (buttons[response] !== Resources.openApplicationButton)
      return false;
    return await this.clearAsync();
  }

  private async clearAsync(): Promise<boolean> {
    let status: UpdateBarrierStatus;
    let isRemoved: boolean;
    try {
      const text = await this.installation.readTextAsync();
      if (Object.isNull(text))
        return true;
      status = await this.installation.checkAsync(this.productVersion);
      isRemoved = status === UpdateBarrierStatus.Unfinished && await this.installation.removeAsync(text);
    }
    catch (error) {
      this.log(Resources.formatBarrierNotCleared(String(error)));
      await this.dialog.showMessageBox(null, {
        type: Resources.errorBoxType, message: Resources.updateBarrierNotCleared, detail: Resources.updateBarrierNotClearedDetail, buttons: [Resources.quitButton], defaultId: 0, cancelId: 0, noLink: true
      });
      return false;
    }
    if (status !== UpdateBarrierStatus.Unfinished)
      return await this.askAsync(status);
    if (!isRemoved)
      return await this.clearAsync();
    this.log(Resources.updateBarrierCleared);
    return true;
  }
}
