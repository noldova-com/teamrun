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
export class ModuleSelectionService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly selectedValue: WritableSignal<string | null> = signal(null);

  public readonly selected: Signal<string | null> = this.selectedValue.asReadonly();

  public select(id: string): void {
    this.selectedValue.set(id);
  }

  public open(id: string): void {
    this.select(id);
    this.layout.openDocument(ShellDocuments.modulesTab);
  }
}
