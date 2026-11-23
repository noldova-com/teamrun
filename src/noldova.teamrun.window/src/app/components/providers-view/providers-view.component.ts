/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  type Signal,
  signal,
  untracked,
  viewChildren,
  type WritableSignal
} from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { AuthStatus, type DiscoveredProfile, NameOrder, ProfileFolderPath, type Provider, type ProviderKindInstallation, ProviderKindInstallState }
  from "@noldova/teamrun.protocol";
import {
  AnnouncementPoliteness,
  Announcer,
  ButtonComponent,
  ButtonVariant,
  ConfigurationTableActionDirective,
  ConfigurationTableComponent,
  IconButtonComponent,
  SpinnerComponent
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { FocusAfterDelete } from "../../models/focus-after-delete";
import type { ProviderFoundRow } from "../../models/provider-found-row";
import type { ProviderGroup } from "../../models/provider-group";
import { ProviderInstallLine } from "../../models/provider-install-line";
import { ProviderListGroup } from "../../models/provider-list-group";
import { ProviderTerminalLine } from "../../models/provider-terminal-line";
import type { ProviderRow } from "../../models/provider-row";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { ProviderRows } from "../../services/provider-rows";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { FirstTeammateComponent } from "../first-teammate/first-teammate.component";
import { ProviderAddComponent } from "../provider-add/provider-add.component";
import { ProviderListComponent } from "../provider-list/provider-list.component";
import { ProviderMenuComponent } from "../provider-menu/provider-menu.component";
import { ProviderStepComponent } from "../provider-step/provider-step.component";
import { ProviderTerminalComponent } from "../provider-terminal/provider-terminal.component";

@Component({
  selector: "nol-teamrun-providers-view",
  imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, FirstTeammateComponent, IconButtonComponent, ProviderAddComponent,
    ProviderListComponent, ProviderMenuComponent, ProviderStepComponent, ProviderTerminalComponent, SpinnerComponent],
  providers: [ChatStoreService.provider],
  templateUrl: "./providers-view.component.html",
  styleUrls: ["../settings-view.css", "../failure-row.css", "./providers-view.component.css"]
})
export class ProvidersViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly states: typeof ProviderKindInstallState = ProviderKindInstallState;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  protected readonly groups: Signal<readonly ProviderGroup[]> = computed(() => {
    const providers = this.store.providers();
    return this.builder.kindsInOrder(providers.map(t => t.kind))
      .map(kind => this.builder.groupOf(kind, providers.filter(t => t.kind === kind).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))));
  });
  protected readonly yourGroups: Signal<readonly ProviderListGroup[]> = computed(() => this.groups().map(t => new ProviderListGroup(t.kind, t.name, t.rows, [],
    this.noteOf(t.kind, t.installation), t.installation)));
  protected readonly installs: Signal<readonly ProviderInstallLine[]> = computed(() => this.installing()
    .filter(t => !this.groups().some(u => u.kind === t.installation.kind)));
  protected readonly rows: Signal<readonly ProviderRow[]> = computed(() => this.groups().flatMap(t => t.rows));
  protected readonly found: Signal<readonly ProviderFoundRow[]> = computed(() => {
    const providers = this.store.providers();
    const left = this.profiles().filter(t => !providers.some(u => ProfileFolderPath.isSame(u.profileDir, t.profileDir)));
    return NameOrder.sort(left, t => t.label).map(t => this.builder.foundRowOf(t));
  });
  protected readonly foundGroups: Signal<readonly ProviderListGroup[]> = computed(() => {
    const found = this.found();
    return this.builder.kindsInOrder(found.map(t => t.profile.kind))
      .map(kind => new ProviderListGroup(kind, this.builder.kindNameOf(kind), [], found.filter(t => t.profile.kind === kind)));
  });
  protected readonly terminals: Signal<readonly ProviderTerminalLine[]> = computed(() => {
    const sessions = this.store.terminalSessions();
    const hidden = this.hiddenTerminals();
    return this.rows().flatMap(t => {
      const session = sessions.get(t.provider.id);
      return this.store.openSignInTerminals().has(t.provider.id) && !Object.isUndefined(session) && !hidden.has(session)
        ? [new ProviderTerminalLine(t.provider.id, session, Resources.formatSignInTerminal(t.provider.label, this.builder.kindNameOf(t.provider.kind)))]
        : [];
    });
  });
  protected readonly installTerminals: Signal<readonly ProviderTerminalLine[]> = computed(() => {
    const sessions = this.store.terminalSessions();
    const hidden = this.hiddenTerminals();
    return this.store.kinds().filter(t => !(this.addOpen() && t.id === this.addKind())).flatMap(t => {
      const session = sessions.get(t.id);
      return Object.isUndefined(session) || hidden.has(session) ? [] : [new ProviderTerminalLine(t.id, session, Resources.formatTerminalInstallTitle(t.displayName))];
    });
  });
  protected readonly searching: Signal<boolean> = computed(() => this.searchRunning() || (!this.store.kindsLoaded() && !this.store.kindsFailed()));
  protected readonly checking: WritableSignal<boolean> = signal(false);
  protected readonly checkingUpdates: WritableSignal<boolean> = signal(false);
  protected readonly adding: WritableSignal<ReadonlySet<string>> = signal(new Set());
  protected readonly lookingFor: Signal<string> = computed(() => Resources.formatLookingFor(this.store.kinds().map(t => t.displayName)));
  protected readonly searched: Signal<string> = computed(() => {
    const at = this.searchedAt();
    return Object.isNull(at) ? Resources.notSearchedLabel : Resources.formatSearched(this.agoOf(at));
  });
  protected readonly foundEmpty: Signal<string> = computed(() => {
    if (this.searching())
      return this.lookingFor();
    return Object.isNull(this.searchedAt()) ? Resources.notSearchedText : Resources.noneFound;
  });
  protected readonly checked: Signal<string | null> = computed(() => {
    const times = this.store.enabledProviders().flatMap(t => Object.isNull(t.lastCheckedAt) ? [] : [Date.parse(t.lastCheckedAt)]);
    return times.length === 0 ? null : Resources.formatChecked(this.agoOf(Math.min(...times)));
  });
  protected readonly checkable: Signal<readonly string[]> = computed(() => this.store.enabledProviders()
    .filter(t => this.store.hasKind(t.kind) && !this.store.signingIn().has(t.id)).map(t => t.id));
  protected readonly teammateStep: WritableSignal<boolean> = signal(false);
  protected readonly finishing: WritableSignal<boolean> = signal(false);
  protected readonly canContinue: Signal<boolean> = computed(() => this.store.enabledProviders().some(t => t.authStatus === AuthStatus.LoggedIn));
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly report: (message: string) => void = t => this.error.set(t);
  protected readonly addOpen: WritableSignal<boolean> = signal(false);
  protected readonly addKind: WritableSignal<string | null> = signal(null);
  protected readonly chooseFolder: () => Promise<string | null> = () => this.context.chooseFolderAsync();
  protected readonly asking: WritableSignal<string | null> = signal(null);
  protected readonly question: Signal<string> = computed(() => {
    const id = this.asking();
    return Resources.formatRemoveQuestion(this.store.teammates().filter(t => t.providerId === id).map(t => t.name));
  });
  protected readonly questionIdOf: (providerId: string) => string = ProviderListComponent.questionIdOf;
  protected readonly askRemove: (provider: Provider) => void = t => {
    this.asking.set(t.id);
    afterNextRender(() => this.focusIn(t.id, ".nol-teamrun-keep"), { injector: this.injector });
  };
  private readonly installing: Signal<readonly ProviderInstallLine[]> = computed(() => [...this.store.installations().values()]
    .filter(t => t.state === ProviderKindInstallState.Installing && !(this.addOpen() && t.kind === this.addKind())).map(t => {
      const name = this.builder.kindNameOf(t.kind);
      return new ProviderInstallLine(t, name, Resources.formatKindInstalling(name, t));
    }));
  private readonly profiles: WritableSignal<readonly DiscoveredProfile[]> = signal([]);
  private readonly hiddenTerminals: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly shownTerminals: Signal<readonly ProviderTerminalComponent[]> = viewChildren(ProviderTerminalComponent);
  private readonly searchRunning: WritableSignal<boolean> = signal(false);
  private readonly searchedAt: WritableSignal<number | null> = signal(null);
  private readonly clock: ClockService = inject(ClockService);
  private readonly now: WritableSignal<number> = signal(this.clock.now());
  private readonly builder: ProviderRows = new ProviderRows(this.store, inject(UsageFormatterService));
  private readonly announcer: Announcer = inject(Announcer);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private announced: ReadonlyMap<string, string> = new Map();

  public constructor() {
    void this.store.refreshInstallations();
    const opened = effect(() => {
      if (!this.store.kindsLoaded())
        return;
      opened.destroy();
      untracked(() => void this.search());
    });
    inject(DestroyRef).onDestroy(this.clock.every(Resources.minuteMilliseconds, () => this.now.set(this.clock.now())));
    effect(() => {
      for (const provider of this.store.providers())
        if (provider.enabled && provider.authStatus === AuthStatus.LoggedIn)
          untracked(() => void this.store.readPlanUsage(provider.kind, provider.id));
    });
    effect(() => {
      const live = new Map([
        ...this.installing().map(t => [JSON.stringify([t.installation.kind]), Resources.formatLiveStatus(t.name, Resources.installActionOf(t.installation))] as const),
        ...this.rows().flatMap(t => Object.isNull(t.announcement) ? [] : [[JSON.stringify([t.provider.kind, t.provider.id]), t.announcement] as const])
      ]);
      untracked(() => {
        for (const [key, text] of live)
          if (this.announced.get(key) !== text)
            this.announcer.announce(text, AnnouncementPoliteness.Polite);
      });
      this.announced = live;
    });
  }

  protected async retryKinds(): Promise<void> {
    if (!this.store.loadingKinds())
      await this.store.initialize();
  }

  protected async search(): Promise<void> {
    this.searchRunning.set(true);
    await Promise.all([this.store.refreshTools(this.report), ...this.store.kinds().map(t => this.searchKind(t.id))]);
    this.searchedAt.set(this.clock.now());
    this.now.set(this.clock.now());
    this.searchRunning.set(false);
  }

  protected async checkUpdates(): Promise<void> {
    this.error.set(null);
    this.checkingUpdates.set(true);
    await this.store.checkInstallations(this.report);
    this.checkingUpdates.set(false);
  }

  protected async checkAll(): Promise<void> {
    this.checking.set(true);
    const left = [...this.checkable()];
    const checkNext = async (): Promise<void> => {
      for (let id = left.shift(); !Object.isUndefined(id); id = left.shift())
        await this.store.checkProvider(id, this.report);
    };
    await Promise.all(Array.from({ length: Resources.providerChecksAtOnce }, checkNext));
    this.now.set(this.clock.now());
    this.checking.set(false);
  }

  protected async addFound(row: ProviderFoundRow): Promise<void> {
    this.error.set(null);
    const profile = row.profile;
    const next = this.foundAdds().findIndex(t => t.dataset["profile"] === profile.profileDir);
    this.adding.update(t => new Set([...t, profile.profileDir]));
    const added = await this.store.addProvider(profile.kind, profile.label, profile.profileDir, this.report, false);
    this.adding.update(t => new Set([...t].filter(u => u !== profile.profileDir)));
    afterNextRender(() => this.focusAfterAdd(profile, added, next), { injector: this.injector });
  }

  protected hideTerminal(sessionId: string): void {
    this.hiddenTerminals.update(t => new Set([...t, sessionId]));
  }

  protected showTerminal(providerId: string): void {
    const session = this.store.terminalSessions().get(providerId);
    this.hiddenTerminals.update(t => new Set([...t].filter(u => u !== session)));
    afterNextRender(() => this.shownTerminals().filter(t => t.sessionId() === session).forEach(t => t.focus()), { injector: this.injector });
  }

  protected cancelInstall(kind: string): void {
    this.error.set(null);
    void this.store.cancelInstall(kind, this.report);
  }

  protected updateKind(kind: string): void {
    this.error.set(null);
    void this.store.installKind(kind, this.report);
  }

  protected updateOf(group: ProviderListGroup): string | null {
    return group.installation?.state === ProviderKindInstallState.Installed ? group.installation.update : null;
  }

  protected async skip(): Promise<void> {
    await this.finish();
  }

  protected async continue(): Promise<void> {
    if (await this.finish())
      this.teammateStep.set(true);
  }

  protected add(): void {
    this.addOpen.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(".nol-teamrun-kind-card.nol-teamrun-chosen")?.focus(), { injector: this.injector });
  }

  protected closeAdd(): void {
    this.addOpen.set(false);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(".nol-teamrun-add")?.focus(), { injector: this.injector });
  }

  private async finish(): Promise<boolean> {
    this.error.set(null);
    this.finishing.set(true);
    const finished = await this.store.finishFirstLaunch(this.report);
    this.finishing.set(false);
    return finished;
  }

  protected keep(provider: Provider): void {
    this.asking.set(null);
    afterNextRender(() => this.focusIn(provider.id, ".nol-teamrun-row-menu"), { injector: this.injector });
  }

  protected async remove(provider: Provider): Promise<void> {
    const control = document.activeElement;
    this.asking.set(null);
    this.error.set(null);
    const ids = [...this.host.nativeElement.querySelectorAll<HTMLElement>(".nol-teamrun-item[data-provider]")].map(t => t.dataset["provider"]);
    const at = ids.indexOf(provider.id);
    const neighbour = ids[at + 1] ?? ids[at - 1];
    await this.store.removeProvider(provider.id, this.report);
    const target = this.store.providers().some(t => t.id === provider.id) ? provider.id : neighbour;
    FocusAfterDelete.later(this.injector, control, () => Object.isUndefined(target) ? null : this.rowPart(target, ".nol-teamrun-row-menu"),
      () => this.host.nativeElement.querySelector<HTMLElement>(".nol-teamrun-add"));
  }

  private focusIn(providerId: string, selector: string): void {
    this.rowPart(providerId, selector)?.focus();
  }

  private rowPart(providerId: string, selector: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(`.nol-teamrun-item[data-provider="${CSS.escape(providerId)}"] ${selector}`);
  }

  private async searchKind(kind: string): Promise<void> {
    const found = await this.store.discoverProfiles(this.report, [kind]) ?? [];
    this.profiles.update(t => [...t.filter(u => u.kind !== kind), ...found.filter(u => u.kind === kind)]);
  }

  private foundAdds(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>(".nol-teamrun-add-found")];
  }

  private focusAfterAdd(profile: DiscoveredProfile, added: boolean, next: number): void {
    const adds = this.foundAdds();
    const ids = this.store.providers().filter(t => ProfileFolderPath.isSame(t.profileDir, profile.profileDir)).map(t => t.id);
    const target = !added || next < adds.length ? adds[next]
      : this.host.nativeElement.querySelector(`.nol-teamrun-item[data-provider="${ids.join()}"] .nol-teamrun-row-menu`);
    if (target instanceof HTMLElement)
      target.focus();
  }

  private noteOf(kind: string, installation: ProviderKindInstallation | null): string | null {
    if (Object.isNull(installation))
      return this.store.tools().get(kind)?.found === true ? Resources.kindUpdatesItselfNote : null;
    if (installation.state === ProviderKindInstallState.Installing)
      return Resources.formatInstalling(installation);
    if (installation.state !== ProviderKindInstallState.Installed)
      return null;
    if (!Object.isNull(installation.foundPath))
      return Resources.kindUpdatesItselfNote;
    return Object.isNull(installation.update) ? null : Resources.formatKindUpdate(installation.update);
  }

  private agoOf(at: number): string {
    return Resources.formatAgo(Math.max(0, Math.floor((this.now() - at) / Resources.minuteMilliseconds)));
  }
}
