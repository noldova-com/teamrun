/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItem, type CommandContribution, type DocumentContribution, type StatusBarItemContribution } from "@noldova/desktop.window";

import { RecordingWindowPartContext } from "./recording-window-part-context.fixture";

export class BrowserPartContext extends RecordingWindowPartContext {
  public override registerCommand(command: CommandContribution): void {
    this.commands.push(command);
  }

  public override registerDocument(document: DocumentContribution): void {
    this.documents.push(document);
  }

  public override registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem {
    const registered = new StatusBarItem(item, () => undefined);
    this.statusBarItems.push(registered);
    return registered;
  }

  public override onDocumentClosed(_name: string, listener: (instance: string) => void): () => void {
    this.documentClosedListeners.add(listener);
    return () => {
      this.documentClosedListeners.delete(listener);
    };
  }

  public override provideSettingCheck(): () => void {
    return () => undefined;
  }
}
