/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";

import "@noldova/context.core";
import type { DialogService } from "@noldova/ui.components.angular";

import { AcpAgentsDialogComponent } from "../components/acp-agents-dialog/acp-agents-dialog.component";
import type { ChatStoreService } from "./chat-store.service";

export class AcpAgentsBrowser {
  public static open(dialogs: DialogService, store: ChatStoreService): DialogRef<unknown, AcpAgentsDialogComponent> {
    const dialog = dialogs.open(AcpAgentsDialogComponent, ".nol-teamrun-acp-search");
    dialog.componentRef?.setInput("store", store);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
    return dialog;
  }
}
