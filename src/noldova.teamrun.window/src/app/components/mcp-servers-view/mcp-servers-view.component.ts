/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, DestroyRef, effect, ElementRef, inject, Injector, type Signal, signal, untracked, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import {
  AbilityAnswer, NameOrder, type Provider, ProviderAbility, type ProviderKind, Resources as ProtocolResources, SharedMcpAccount, type SharedMcpServer, SharedMcpServerDefinition, type SharedMcpServerListing, SharedMcpSetting,
  SharedMcpTransport, type Teammate
}
  from "@noldova/teamrun.protocol";
import {
  AnnouncementPoliteness,
  Announcer,
  ButtonComponent,
  ButtonVariant,
  ChipComponent,
  ChipKind,
  ChoicePillsComponent,
  DialogService,
  IconButtonComponent,
  LinkOpenEvent,
  MenuComponent,
  MenuItemComponent,
  MenuTriggerDirective,
  PanelCardComponent,
  SelectOption,
  SwitchComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ConfirmRequest } from "../../models/confirm-request";
import { FocusAfterDelete } from "../../models/focus-after-delete";
import { OwnMcpServerListing } from "../../models/own-mcp-server-listing";
import { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { SharedMcpServerDialogComponent } from "../shared-mcp-server-dialog/shared-mcp-server-dialog.component";

@Component({
  selector: "nol-teamrun-mcp-servers-view",
  imports: [ButtonComponent, ChipComponent, ChoicePillsComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective,
    NgTemplateOutlet, PanelCardComponent, SwitchComponent, TooltipDirective],
  providers: [ChatStoreService.provider],
  templateUrl: "./mcp-servers-view.component.html",
  styleUrls: ["../settings-view.css", "../failure-row.css", "./mcp-servers-view.component.css"]
})
export class McpServersViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly on: ChipKind = ChipKind.On;
  protected readonly key: ChipKind = ChipKind.Key;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly shown: Signal<readonly Provider[]> = computed(() => NameOrder.sort(this.store.providers().filter(t => this.store.hasKind(t.kind)),
    t => this.kindOf(t).displayName));
  protected readonly ownShown: Signal<readonly Provider[]> = computed(() => this.shown().filter(t => Object.isNull(this.unavailableReason(t))));
  protected readonly ownHeld: Signal<readonly Provider[]> = computed(() => this.shown().filter(t => !Object.isNull(this.unavailableReason(t))));
  protected readonly ownListedHeld: Signal<readonly Provider[]> = computed(() => this.ownHeld().filter(t => this.listsOwn(t)));
  protected readonly ownHeldNames: Signal<string> = computed(() => this.ownHeld().map(t => this.groupName(t)).join(Resources.sharedMcpNameSeparator));
  protected readonly whyShown: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly secretsSaved: WritableSignal<string | null> = signal(null);
  protected readonly report: (message: string) => void = t => this.error.set(t);
  protected readonly exceptionOptions: readonly SelectOption[] = Resources.sharedMcpExceptionOrder.map(t => new SelectOption(t, Resources.sharedMcpSettingLabels[t]));
  protected readonly shared: WritableSignal<readonly SharedMcpServerListing[] | null> = signal(null);
  protected readonly sharedError: WritableSignal<string | null> = signal(null);
  protected readonly offersGitHub: Signal<boolean> = computed(() => {
    const listings = this.shared();
    const address = `${new URL(ProtocolResources.gitHubMcpServerUrl).origin}/`;
    return this.gitHubSignedIn() && !Object.isNull(listings)
      && listings.every(t => t.server.definition.name !== ProtocolResources.gitHubMcpServerName && t.server.definition.url?.startsWith(address) !== true);
  });
  protected readonly chosenId: WritableSignal<string | null> = signal(null);
  protected readonly chosen: Signal<SharedMcpServerListing | null> = computed(() => {
    const listings = this.shared() ?? [];
    return listings.find(t => t.server.id === this.chosenId()) ?? listings.at(0) ?? null;
  });
  protected readonly cantShown: WritableSignal<boolean> = signal(false);
  private readonly gitHubSignedIn: WritableSignal<boolean> = signal(false);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly announcer: Announcer = inject(Announcer);
  private readonly listings: WritableSignal<ReadonlyMap<string, OwnMcpServerListing>> = signal(new Map());
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly injector: Injector = inject(Injector);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  public constructor() {
    effect(() => {
      for (const provider of this.shown())
        untracked(() => void this.list(provider));
    });
    effect(() => {
      this.store.invalidations();
      untracked(() => void this.listShared());
    });
    inject(DestroyRef).onDestroy(this.store.onGitHubSignInChanged(t => this.gitHubSignedIn.set(t)));
    void this.store.readGitHubSignedIn().then(t => this.gitHubSignedIn.set(t));
  }

  protected choose(listing: SharedMcpServerListing): void {
    if (this.chosen()?.server.id !== listing.server.id)
      this.cantShown.set(false);
    this.chosenId.set(listing.server.id);
  }

  protected isChosen(listing: SharedMcpServerListing): boolean {
    return this.chosen()?.server.id === listing.server.id;
  }

  protected isReady(listing: SharedMcpServerListing): boolean {
    return this.unsetOf(listing).length === 0 && (!listing.server.definition.signsIn || this.isSignedIn(listing.server))
      && (listing.server.definition.account !== SharedMcpAccount.GitHub || this.gitHubSignedIn());
  }

  protected stateLineOf(listing: SharedMcpServerListing): string {
    const definition = listing.server.definition;
    const unset = this.unsetOf(listing);
    const state = unset.length > 0 ? Resources.formatSharedMcpUnset(unset)
      : definition.signsIn ? this.shortSignInStateOf(listing) : null;
    const type = definition.transport === SharedMcpTransport.Stdio ? this.commandLineOf(listing.server) : Resources.sharedMcpHttpType;
    return [type, state].filter(t => !Object.isNull(t)).join(Resources.sharedMcpStateSeparator);
  }

  protected rowLabelOf(listing: SharedMcpServerListing): string {
    return Resources.formatSharedMcpRow(listing.server.definition.name, this.stateLineOf(listing));
  }

  protected onFor(listing: SharedMcpServerListing): readonly Provider[] {
    return this.shown().filter(t => this.canTake(listing, t) && this.isSharedOn(listing, t));
  }

  protected canCountOf(listing: SharedMcpServerListing): number {
    return this.shown().filter(t => this.canTake(listing, t) && !this.isSharedOn(listing, t)).length;
  }

  protected takers(listing: SharedMcpServerListing): readonly Provider[] {
    return this.shown().filter(t => this.canTake(listing, t));
  }

  protected refusers(listing: SharedMcpServerListing): readonly Provider[] {
    return this.shown().filter(t => !this.canTake(listing, t));
  }

  protected reasonGroupsOf(listing: SharedMcpServerListing): readonly string[] {
    const groups = new Map<string, string[]>();
    for (const provider of this.shown()) {
      const unavailable = listing.unavailable.find(t => t.providerId === provider.id);
      if (Object.isUndefined(unavailable))
        continue;
      const reason = unavailable.short ?? unavailable.reason;
      groups.set(reason, [...groups.get(reason) ?? [], this.groupName(provider)]);
    }
    return [...groups].map(([reason, names]) => Resources.formatSharedMcpReasonGroup(names, reason));
  }

  protected signInStateOf(listing: SharedMcpServerListing): string {
    const server = listing.server;
    if (listing.signingIn)
      return Resources.sharedMcpSigningIn;
    if (Object.isNull(server.signIn))
      return Resources.sharedMcpNotSignedIn;
    return Object.isNull(server.signIn.needsSignIn) ? Resources.sharedMcpSignedIn : Resources.formatSharedMcpSignInNeeded(server.signIn.needsSignIn);
  }

  protected isSignedIn(server: SharedMcpServer): boolean {
    return !Object.isNull(server.signIn) && Object.isNull(server.signIn.needsSignIn);
  }

  protected async signIn(event: MouseEvent, server: SharedMcpServer): Promise<void> {
    if (event.type === Resources.auxclickEventName && event.button !== Resources.middleButton)
      return;
    await this.store.startSharedMcpSignIn(server.id, new LinkOpenEvent("", event).gesture, this.report);
  }

  protected async signOut(server: SharedMcpServer): Promise<void> {
    if (await this.store.signOutOfSharedMcp(server.id, this.report))
      await this.listShared();
  }

  protected commandLineOf(server: SharedMcpServer): string | null {
    const definition = server.definition;
    return definition.transport === SharedMcpTransport.Stdio ? [definition.command, ...definition.arguments].join(" ") : definition.url;
  }

  protected isSharedOn(listing: SharedMcpServerListing, provider: Provider): boolean {
    return listing.server.providerIds.includes(provider.id);
  }

  protected sharedUnavailableReason(listing: SharedMcpServerListing, provider: Provider): string | null {
    return listing.unavailable.find(t => t.providerId === provider.id)?.reason ?? null;
  }

  protected sharedSwitchId(listing: SharedMcpServerListing, provider: Provider): string {
    return `${Resources.sharedMcpProviderSwitchIdPrefix}${listing.server.id}-${provider.id}`;
  }

  protected reachOf(listing: SharedMcpServerListing): readonly Teammate[] {
    return this.store.teammates().filter(t => this.reaches(listing, t));
  }

  protected exceptionsOf(listing: SharedMcpServerListing): readonly Teammate[] {
    return this.store.teammates().filter(t => this.settingOf(listing, t) !== SharedMcpSetting.AsProvider);
  }

  protected followersOf(listing: SharedMcpServerListing): readonly Teammate[] {
    return this.store.teammates().filter(t => this.settingOf(listing, t) === SharedMcpSetting.AsProvider);
  }

  protected settingOf(listing: SharedMcpServerListing, teammate: Teammate): string {
    return listing.server.teammates.find(t => t.teammateId === teammate.id)?.setting ?? SharedMcpSetting.AsProvider;
  }

  protected settingLabelOf(listing: SharedMcpServerListing, teammate: Teammate): string {
    return Resources.formatSharedMcpTeammate(listing.server.definition.name, teammate.name);
  }

  protected async addException(listing: SharedMcpServerListing, teammate: Teammate): Promise<void> {
    await this.setTeammate(listing, teammate, this.reaches(listing, teammate) ? SharedMcpSetting.Off : SharedMcpSetting.On);
  }

  protected async switchShared(listing: SharedMcpServerListing, provider: Provider, on: boolean): Promise<void> {
    if (await this.store.switchSharedMcpProvider(listing.server.id, provider.id, on, this.report))
      await this.listShared();
  }

  protected async setTeammate(listing: SharedMcpServerListing, teammate: Teammate, setting: string): Promise<void> {
    const chosen = Resources.sharedMcpSettingOrder.find(t => t === setting);
    if (!Object.isUndefined(chosen) && await this.store.setSharedMcpTeammate(listing.server.id, teammate.id, chosen, this.report))
      await this.listShared();
  }

  protected async addGitHub(): Promise<void> {
    if (!Object.isNull(await this.store.saveSharedMcpServer(null, SharedMcpServerDefinition.gitHub, this.report)))
      await this.listShared();
  }

  protected editShared(listing: SharedMcpServerListing | null): void {
    const dialog = this.dialogs.open(SharedMcpServerDialogComponent, ".nol-teamrun-shared-mcp-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("server", listing?.server ?? null);
    dialog.componentRef?.setInput("variables", listing?.variables ?? []);
    const opened = dialog.componentInstance;
    opened?.closed.subscribe(saved => {
      const secrets = opened.savedSecrets();
      const name = opened.savedName();
      dialog.close();
      const said = secrets.length > 0 ? Resources.formatSharedMcpSecretsSaved(name, secrets) : null;
      this.secretsSaved.set(said);
      if (!Object.isNull(said))
        this.announcer.announce(said, AnnouncementPoliteness.Polite);
      if (saved)
        void this.listShared();
    });
  }

  protected removeShared(server: SharedMcpServer): void {
    const control = document.activeElement;
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.deleteSharedMcpServerLabel,
      Resources.formatDeleteSharedMcpServer(server.definition.name), Resources.deleteSharedMcpServerLabel, null, true));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.deleteShared(server, control);
    });
  }

  protected async retryShared(): Promise<void> {
    this.sharedError.set(null);
    await this.listShared();
  }

  protected async retryKinds(): Promise<void> {
    if (!this.store.loadingKinds())
      await this.store.initialize();
  }

  protected noteOf(provider: Provider): string | null {
    return this.kindOf(provider).ownMcpServersNote;
  }

  protected shortNoteOf(provider: Provider): string | null {
    const kind = this.kindOf(provider);
    return Object.isNull(kind.ownMcpServersNote) ? null : kind.ownMcpServersShortNote ?? kind.ownMcpServersNote;
  }

  protected unavailableReason(provider: Provider): string | null {
    return this.kindOf(provider).ownMcpServersUnavailable;
  }

  protected listsOwn(provider: Provider): boolean {
    return this.kindOf(provider).abilities?.cellOf(ProviderAbility.OwnServersList).answer === AbilityAnswer.Works;
  }

  protected listingOf(provider: Provider): OwnMcpServerListing | null {
    return this.listings().get(provider.id) ?? null;
  }

  protected isListedByName(provider: Provider): boolean {
    const count = this.listingOf(provider)?.servers?.length ?? 0;
    return count > 0 && count <= Resources.ownMcpServerNamesShown && Object.isNull(this.noteOf(provider));
  }

  protected isPending(provider: Provider): boolean {
    const listing = this.listingOf(provider);
    return Object.isNull(listing) || listing.isReading;
  }

  protected isUnread(provider: Provider): boolean {
    return !Object.isNull(this.listingOf(provider)?.error ?? null);
  }

  protected summaryOf(provider: Provider): string {
    const listing = this.listingOf(provider);
    if (Object.isNull(listing) || listing.isReading)
      return Resources.readingOwnMcpServers;
    if (!Object.isNull(listing.error))
      return Resources.formatOwnMcpServersUnread(listing.error);
    const note = this.shortNoteOf(provider);
    const count = listing.servers?.length ?? 0;
    const summary = !listing.isOffered ? Resources.ownMcpServersNotOffered : count === 0 ? Resources.noOwnMcpServers : Resources.formatServerCount(count);
    if (Object.isNull(note))
      return listing.isOffered ? summary : Resources.formatOwnMcpServersWithNote(summary, Resources.ownMcpServersUsesOwn);
    return listing.isOffered && count > 0 ? Resources.formatOwnMcpServersAnd(summary, note) : Resources.formatOwnMcpServersWithNote(summary, note);
  }

  protected groupName(provider: Provider): string {
    return this.formatter.providerLine(provider.kind, provider, this.store.kinds());
  }

  protected switchId(provider: Provider): string {
    return `${Resources.ownMcpServersSwitchIdPrefix}${provider.id}`;
  }

  protected async switch(provider: Provider, on: boolean): Promise<void> {
    await this.store.switchOwnMcpServers(provider, on, this.report);
  }

  private canTake(listing: SharedMcpServerListing, provider: Provider): boolean {
    return Object.isNull(this.sharedUnavailableReason(listing, provider));
  }

  private reaches(listing: SharedMcpServerListing, teammate: Teammate): boolean {
    const provider = this.shown().find(t => t.id === teammate.providerId);
    if (Object.isUndefined(provider) || !this.canTake(listing, provider))
      return false;
    const setting = this.settingOf(listing, teammate);
    return setting === SharedMcpSetting.On || setting === SharedMcpSetting.AsProvider && this.isSharedOn(listing, provider);
  }

  private unsetOf(listing: SharedMcpServerListing): readonly string[] {
    return listing.variables.filter(t => !t.set).map(t => t.variable);
  }

  private shortSignInStateOf(listing: SharedMcpServerListing): string {
    if (listing.signingIn)
      return Resources.sharedMcpSigningInShort;
    if (this.isSignedIn(listing.server))
      return Resources.sharedMcpSignedInShort;
    return Object.isNull(listing.server.signIn) ? Resources.sharedMcpNotSignedInShort : Resources.sharedMcpSignInNeededShort;
  }

  private async deleteShared(server: SharedMcpServer, control: Element | null): Promise<void> {
    const ids = [...this.host.querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-row[data-server]")].map(t => t.dataset["server"]);
    const at = ids.indexOf(server.id);
    const neighbour = ids[at + 1] ?? ids[at - 1];
    if (await this.store.deleteSharedMcpServer(server.id, this.report)) {
      this.secretsSaved.set(null);
      await this.listShared();
      FocusAfterDelete.later(this.injector, control,
        () => Object.isUndefined(neighbour) ? null : this.host.querySelector<HTMLElement>(`.nol-teamrun-shared-mcp-row[data-server="${CSS.escape(neighbour)}"]`),
        () => this.host.querySelector<HTMLElement>(".nol-teamrun-add-shared-mcp"));
    }
  }

  private async listShared(): Promise<void> {
    try {
      this.shared.set(await this.store.listSharedMcpServers());
      this.sharedError.set(null);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (Object.isNull(this.shared()))
        this.sharedError.set(message);
      else
        this.error.set(Resources.formatSharedMcpServersUnread(message));
    }
  }

  private async list(provider: Provider): Promise<void> {
    if (this.listingOf(provider)?.profileDir === provider.profileDir)
      return;
    this.keep(provider.id, new OwnMcpServerListing(provider.profileDir));
    let listing: OwnMcpServerListing;
    try {
      const servers = await this.store.listOwnMcpServers(provider.id);
      listing = new OwnMcpServerListing(provider.profileDir, servers, null, !Object.isNull(servers));
    }
    catch (error) {
      listing = new OwnMcpServerListing(provider.profileDir, null, error instanceof Error ? error.message : String(error));
    }
    if (this.listings().get(provider.id)!.profileDir === provider.profileDir)
      this.keep(provider.id, listing);
  }

  private kindOf(provider: Provider): ProviderKind {
    return this.store.kinds().find(t => t.id === provider.kind)!;
  }

  private keep(providerId: string, listing: OwnMcpServerListing): void {
    this.listings.update(t => new Map([...t, [providerId, listing]]));
  }
}
