/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, viewChild, type WritableSignal } from "@angular/core";
import { NameOrder, type OrganizationParent } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogComponent, DialogService, FieldMessageComponent, SelectComponent, SelectOption,
  TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ChatStoreService } from "../../services/chat-store.service";
import type { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationTypeDialogComponent } from "../organization-type-dialog/organization-type-dialog.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "nol-teamrun-organization-department-dialog",
  imports: [ButtonComponent, DialogComponent, FieldMessageComponent, SelectComponent, TextFieldComponent],
  templateUrl: "./organization-department-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class OrganizationDepartmentDialogComponent {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required<string, ElementRef<HTMLInputElement>>("field", { read: ElementRef });

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly name: WritableSignal<string> = signal(String.empty);
  protected readonly leaderId: WritableSignal<string> = signal(String.empty);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly chosenType: WritableSignal<string | null> = signal(null);
  protected readonly typeId: Signal<string> = computed(() => this.chosenType() ?? this.organization().organization().nodeTypes.at(0)?.id ?? String.empty);
  protected readonly typeOptions: Signal<readonly SelectOption[]> = computed(() => {
    const types = this.organization().organization().nodeTypes.map(t => new SelectOption(t.id, t.name));
    return [...types.length === 0 || this.typeId().length === 0 ? [new SelectOption(String.empty, Resources.organizationChooseType)] : [], ...types,
      new SelectOption(Resources.organizationNewTypeValue, Resources.organizationNewTypeOption)];
  });
  protected readonly leaderOptions: Signal<readonly SelectOption[]> = computed(() => [
    new SelectOption(String.empty, Resources.organizationNoLeader),
    ...NameOrder.sort(this.store().teammates(), t => t.name).map(t => new SelectOption(t.id, t.name)),
    new SelectOption(Resources.organizationNewTeammateValue, Resources.organizationNewTeammateOption)
  ]);
  protected readonly error: Signal<string | null> = computed(() => this.organization().actionError());
  protected readonly canSave: Signal<boolean> = computed(() => this.name().trim().length > 0 && this.typeId().length > 0
    && this.typeId() !== Resources.organizationNewTypeValue && !this.saving());

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly organization: InputSignal<OrganizationStoreService> = input.required<OrganizationStoreService>();
  public readonly parent: InputSignal<OrganizationParent> = input.required<OrganizationParent>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public static open(dialogs: DialogService, store: ChatStoreService, organization: OrganizationStoreService, parent: OrganizationParent): void {
    const dialog = dialogs.open(OrganizationDepartmentDialogComponent, ".nol-teamrun-department-name");
    dialog.componentRef?.setInput("store", store);
    dialog.componentRef?.setInput("organization", organization);
    dialog.componentRef?.setInput("parent", parent);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
    if (organization.organization().nodeTypes.length === 0)
      dialog.componentInstance?.chooseType(Resources.organizationNewTypeValue);
  }

  protected edit(): void {
    this.name.set(this.nameField().nativeElement.value);
  }

  protected chooseLeader(value: string): void {
    if (value !== Resources.organizationNewTeammateValue) {
      this.leaderId.set(value);
      return;
    }
    const previous = this.leaderId();
    this.leaderId.set(value);
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store());
    dialog.componentInstance?.created.subscribe(t => this.leaderId.set(t.id));
    dialog.componentInstance?.closed.subscribe(() => {
      dialog.close();
      if (this.leaderId() === Resources.organizationNewTeammateValue)
        this.leaderId.set(previous);
    });
  }

  protected chooseType(value: string): void {
    if (value !== Resources.organizationNewTypeValue) {
      this.chosenType.set(value);
      return;
    }
    const previous = this.chosenType();
    this.chosenType.set(value);
    const dialog = OrganizationTypeDialogComponent.open(this.dialogs, this.organization(), null);
    dialog?.created.subscribe(t => this.chosenType.set(t.id));
    dialog?.closed.subscribe(() => {
      if (this.chosenType() === Resources.organizationNewTypeValue)
        this.chosenType.set(previous);
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    const leaderId = this.leaderId();
    const created = await this.organization().createDepartment(this.name().trim(), this.typeId(), this.parent(), leaderId.length === 0 ? null : leaderId);
    this.saving.set(false);
    if (created)
      this.closed.emit();
  }
}
