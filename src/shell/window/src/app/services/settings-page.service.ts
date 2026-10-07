/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { ShellDocuments } from "../models/shell-documents";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class SettingsPageService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly requestedValue: WritableSignal<string | null> = signal(null, { equal: () => false });

  public readonly requested: Signal<string | null> = this.requestedValue.asReadonly();

  public open(page: string): void {
    this.requestedValue.set(page);
    this.layout.openDocument(ShellDocuments.settingsTab);
  }

  public take(): void {
    this.requestedValue.set(null);
  }
}
