/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { Provider } from "@noldova/teamrun.protocol";
import type { DialogService } from "@noldova/ui.components.angular";

import { ProviderDialogComponent } from "../components/provider-dialog/provider-dialog.component";
import type { ChatStoreService } from "./chat-store.service";

export class ProviderEditor {
  public static open(dialogs: DialogService, store: ChatStoreService, context: IWindowPartContext, provider: Provider | null): void {
    const dialog = dialogs.open(ProviderDialogComponent, ".nol-teamrun-provider-name");
    dialog.componentRef?.setInput("store", store);
    dialog.componentRef?.setInput("chooseFolder", () => context.chooseFolderAsync());
    dialog.componentRef?.setInput("provider", provider);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }
}
