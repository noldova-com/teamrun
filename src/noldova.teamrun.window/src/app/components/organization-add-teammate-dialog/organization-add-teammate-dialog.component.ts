/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, type WritableSignal } from "@angular/core";
import { NameOrder, OrganizationParent } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogComponent, DialogService, FieldMessageComponent, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ChatStoreService } from "../../services/chat-store.service";
import type { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "nol-teamrun-organization-add-teammate-dialog",
  imports: [ButtonComponent, DialogComponent, FieldMessageComponent, SelectComponent],
  templateUrl: "./organization-add-teammate-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class OrganizationAddTeammateDialogComponent {
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly teammateId: WritableSignal<string> = signal(String.empty);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly teammateOptions: Signal<readonly SelectOption[]> = computed(() => {
    const parent = this.parent();
    return [
      new SelectOption(String.empty, Resources.organizationChooseTeammate),
      ...NameOrder.sort(this.store().teammates(), t => t.name).filter(t => !parent.equals(OrganizationParent.teammate(t.id))).map(t => new SelectOption(t.id, t.name)),
      new SelectOption(Resources.organizationNewTeammateValue, Resources.organizationNewTeammateOption)
    ];
  });
  protected readonly error: Signal<string | null> = computed(() => this.organization().actionError());
  protected readonly canSave: Signal<boolean> = computed(() => this.teammateId().length > 0 && this.teammateId() !== Resources.organizationNewTeammateValue
    && !this.saving());

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly organization: InputSignal<OrganizationStoreService> = input.required<OrganizationStoreService>();
  public readonly parent: InputSignal<OrganizationParent> = input.required<OrganizationParent>();
  public readonly title: InputSignal<string> = input(Resources.organizationAddTeammate);
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public static open(dialogs: DialogService, store: ChatStoreService, organization: OrganizationStoreService, parent: OrganizationParent, title: string): void {
    const dialog = dialogs.open(OrganizationAddTeammateDialogComponent, ".nol-teamrun-add-teammate-choice");
    dialog.componentRef?.setInput("store", store);
    dialog.componentRef?.setInput("organization", organization);
    dialog.componentRef?.setInput("parent", parent);
    dialog.componentRef?.setInput("title", title);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected chooseTeammate(value: string): void {
    if (value !== Resources.organizationNewTeammateValue) {
      this.teammateId.set(value);
      return;
    }
    const previous = this.teammateId();
    this.teammateId.set(value);
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store());
    dialog.componentInstance?.created.subscribe(t => this.teammateId.set(t.id));
    dialog.componentInstance?.closed.subscribe(() => {
      dialog.close();
      if (this.teammateId() === Resources.organizationNewTeammateValue)
        this.teammateId.set(previous);
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    const placed = await this.organization().placeTeammate(this.teammateId(), this.parent());
    this.saving.set(false);
    if (placed)
      this.closed.emit();
  }
}
