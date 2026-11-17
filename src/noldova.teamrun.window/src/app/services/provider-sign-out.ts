/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AuthStatus, type Provider, type ProviderKind } from "@noldova/teamrun.protocol";
import type { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ConfirmDialogComponent } from "../components/confirm-dialog/confirm-dialog.component";
import { ConfirmRequest } from "../models/confirm-request";
import type { ChatStoreService } from "./chat-store.service";

export class ProviderSignOut {
  public static confirmAsync(dialogs: DialogService, store: ChatStoreService, provider: Provider): Promise<boolean> {
    const command = store.signOutCommandOf(provider);
    const kind = store.kinds().find(t => t.id === provider.kind)!;
    const dialog = dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", Object.isNull(command)
      ? new ConfirmRequest(Resources.signOutLabel, ProviderSignOut.messageOf(kind, provider), Resources.signOutLabel)
      : new ConfirmRequest(Resources.signOutLabel, kind.signOutEndsWithCommand
        ? Resources.formatSignOutByCommand(provider.label, kind.displayName, command, provider.profileDir)
        : Resources.formatSignOutInTool(provider.label, kind.displayName, command, provider.profileDir), Resources.openTerminalLabel));
    return new Promise<boolean>(resolve => dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      resolve(confirmed);
    }));
  }

  public static async signOutAsync(store: ChatStoreService, provider: Provider, report: (message: string) => void): Promise<boolean | null> {
    if (Object.isNull(store.signOutCommandOf(provider)))
      return store.signOutProvider(provider.id, report);
    const ended = await store.signOutInTerminal(provider.id, report);
    return store.kinds().some(t => t.id === provider.kind && t.signOutEndsWithCommand) ? ended
      : store.providers().some(t => t.id === provider.id && t.authStatus === AuthStatus.LoggedOut);
  }

  private static messageOf(kind: ProviderKind, provider: Provider): string {
    if (!Object.isNull(kind.singleAccount) && !Object.isNull(kind.profile))
      return Resources.formatSignOutShared(provider.label, kind.displayName);
    const personal = !Object.isNull(kind.singleAccount) || kind.profile?.personFolders.includes(provider.profileDir) === true;
    return personal ? Resources.formatSignOutPersonal(provider.label, kind.displayName) : Resources.formatSignOut(provider.label, kind.displayName);
  }
}
