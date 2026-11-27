/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, ElementRef, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, viewChild, type WritableSignal } from "@angular/core";
import type { NodeType } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, ColorChooserComponent, DialogComponent, type DialogService, FieldMessageComponent, IconChooserComponent,
  type IconName, IconNames, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { OrganizationStoreService } from "../../services/organization-store.service";

@Component({
  selector: "nol-teamrun-organization-type-dialog",
  imports: [ButtonComponent, ColorChooserComponent, DialogComponent, FieldMessageComponent, IconChooserComponent, TextFieldComponent],
  templateUrl: "./organization-type-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class OrganizationTypeDialogComponent {
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required<string, ElementRef<HTMLInputElement>>("field", { read: ElementRef });
  private readonly shownIcon: Signal<IconName | null> = computed(() => IconNames.all.find(t => t === this.type()?.icon) ?? null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly name: WritableSignal<string> = signal(String.empty);
  protected readonly icon: WritableSignal<IconName | null> = signal(null);
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
      this.icon.set(this.shownIcon());
      this.color.set(type?.color ?? null);
    });
  }

  public static open(dialogs: DialogService, organization: OrganizationStoreService, type: NodeType | null): OrganizationTypeDialogComponent | null {
    organization.clearActionError();
    const dialog = dialogs.open(OrganizationTypeDialogComponent, ".nol-teamrun-type-name");
    dialog.componentRef?.setInput("organization", organization);
    dialog.componentRef?.setInput("type", type);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
    return dialog.componentInstance;
  }

  protected edit(): void {
    this.name.set(this.nameField().nativeElement.value);
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
    if (name === type.name && icon === this.shownIcon() && color === type.color) {
      this.closed.emit();
      return;
    }
    const saved = await this.organization().updateNodeType(type.id, name === type.name ? undefined : name, icon === this.shownIcon() ? undefined : icon,
      color === type.color ? undefined : color);
    this.saving.set(false);
    if (saved)
      this.closed.emit();
  }
}
