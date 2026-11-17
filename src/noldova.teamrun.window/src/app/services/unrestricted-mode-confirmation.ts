/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ProviderMode } from "@noldova/teamrun.protocol";
import type { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ConfirmDialogComponent } from "../components/confirm-dialog/confirm-dialog.component";
import { ConfirmRequest } from "../models/confirm-request";

export class UnrestrictedModeConfirmation {
  public static choose(dialogs: DialogService, mode: ProviderMode | undefined, provider: string, choose: () => void): void {
    if (mode?.unrestricted !== true) {
      choose();
      return;
    }
    const dialog = dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.formatUnrestrictedModeTitle(mode.name),
      Resources.formatUnrestrictedModeText(provider, mode.description), Resources.formatUseMode(mode.name)));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        choose();
    });
  }
}
