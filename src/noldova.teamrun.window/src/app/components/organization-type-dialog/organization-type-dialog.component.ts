/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, type WritableSignal } from "@angular/core";
import type { NodeType } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, ColorChooserComponent, DialogComponent, type DialogService, FieldMessageComponent, IconChooserComponent,
  TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { OrganizationStoreService } from "../../services/organization-store.service";

@Component({
  selector: "nol-teamrun-organization-type-dialog",
  imports: [ButtonComponent, ColorChooserComponent, DialogComponent, FieldMessageComponent, IconChooserComponent, TextFieldComponent],
  templateUrl: "./organization-type-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class OrganizationTypeDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly name: WritableSignal<string> = signal(String.empty);
  protected readonly icon: WritableSignal<string | null> = signal(null);
  protected readonly color: WritableSignal<string | null> = signal(null);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly title: Signal<string> = computed(() => Object.isNull(this.type()) ? Resources.organizationNewTypeTitle : Resources.organizationEditTypeTitle);
  protected readonly error: Signal<string | null> = computed(() => this.organization().actionError());
  protected readonly canSave: Signal<boolean> = computed(() => this.name().trim().length > 0 && !this.saving());

  public readonly organization: InputSignal<OrganizationStoreService> = input.required<OrganizationStoreService>();
  public readonly type: InputSignal<NodeType | null> = input<NodeType | null>(null);
  public readonly created: OutputEmitterRef<NodeType> = output<NodeType>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public constructor() {
    effect(() => {
      const type = this.type();
      this.name.set(type?.name ?? String.empty);
      this.icon.set(type?.icon ?? null);
      this.color.set(type?.color ?? null);
    });
  }

  public static open(dialogs: DialogService, organization: OrganizationStoreService, type: NodeType | null): OrganizationTypeDialogComponent | null {
    const dialog = dialogs.open(OrganizationTypeDialogComponent, ".nol-teamrun-type-name");
    dialog.componentRef?.setInput("organization", organization);
    dialog.componentRef?.setInput("type", type);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
    return dialog.componentInstance ?? null;
  }

  protected edit(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.name.set(event.target.value);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    const type = this.type();
    const name = this.name().trim();
    if (Object.isNull(type)) {
      const created = await this.organization().createNodeType(name, this.icon(), this.color());
      this.saving.set(false);
      if (!Object.isNull(created)) {
        this.created.emit(created);
        this.closed.emit();
      }
      return;
    }
    const icon = this.icon();
    const color = this.color()?.toLowerCase() ?? null;
    const changed = name !== type.name || icon !== type.icon || color !== type.color;
    const saved = !changed || await this.organization().updateNodeType(type.id, name === type.name ? undefined : name, icon === type.icon ? undefined : icon,
      color === type.color ? undefined : color);
    this.saving.set(false);
    if (saved)
      this.closed.emit();
  }
}
