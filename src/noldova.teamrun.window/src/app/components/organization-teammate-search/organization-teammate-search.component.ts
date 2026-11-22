/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, type WritableSignal } from "@angular/core";
import { NameOrder, OrganizationParent } from "@noldova/teamrun.protocol";
import { DialogService, FieldMessageComponent, PopoverDirective, QueryMatcher, QuickInputComponent, QuickInputItem } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "nol-teamrun-organization-teammate-search",
  imports: [FieldMessageComponent, QuickInputComponent],
  hostDirectives: [{ directive: PopoverDirective, inputs: ["label"] }],
  templateUrl: "./organization-teammate-search.component.html",
  styleUrl: "./organization-teammate-search.component.css"
})
export class OrganizationTeammateSearchComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => {
    const query = this.query().trim();
    const parent = this.parent();
    return query.length === 0 ? [] : [...NameOrder.sort(this.store.teammates(), t => t.name)
      .filter(t => !parent.equals(OrganizationParent.teammate(t.id)))
      .map(t => new QuickInputItem(t.id, t.name, null, null, null, QueryMatcher.find(query, t.name)))
      .filter(t => t.matches.length > 0),
    new QuickInputItem(Resources.organizationNewTeammateValue, Resources.organizationNewTeammateOption, Resources.organizationAddMemberIcon, query, null)];
  });
  protected readonly error: Signal<string | null> = computed(() => this.organization.actionError());

  public readonly parent: InputSignal<OrganizationParent> = input.required<OrganizationParent>();
  public readonly done: OutputEmitterRef<void> = output<void>();

  protected async choose(item: QuickInputItem): Promise<void> {
    const parent = this.parent();
    if (item.id === Resources.organizationNewTeammateValue)
      this.create(this.query().trim(), parent);
    else if (await this.organization.placeTeammate(item.id, parent))
      this.done.emit();
  }

  private create(name: string, parent: OrganizationParent): void {
    const organization = this.organization;
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("draftName", name);
    dialog.componentInstance?.created.subscribe(t => void organization.placeTeammate(t.id, parent));
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
    this.done.emit();
  }
}
