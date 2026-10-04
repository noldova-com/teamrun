/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, ErrorHandler, type Signal, type WritableSignal, inject, input, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant, TooltipDirective } from "@noldova/teamrun-shell-ui";

import type { KeyBindings } from "../../models/key-bindings";
import { ShortcutNotice } from "../../models/settings/shortcut-notice";
import type { ShortcutRow } from "../../models/settings/shortcut-row";
import { Resources } from "../../../resources";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { SettingsService } from "../../services/settings.service";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component";

@Component({
  selector: "tr-shortcuts",
  imports: [ButtonComponent, HighlightedTextComponent, TooltipDirective],
  templateUrl: "./shortcuts.component.html",
  styleUrl: "./shortcuts.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-shortcuts"
  }
})
export class ShortcutsComponent {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly platform: string = inject(DesktopBridgeService).platform;

  protected readonly resources: typeof Resources = Resources;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly recording: WritableSignal<string | null> = signal(null);
  protected readonly hint: WritableSignal<string> = signal(Resources.recordingHint);
  protected readonly notice: WritableSignal<ShortcutNotice | null> = signal(null);
  protected readonly isModified: Signal<boolean> = this.settings.isSet(Resources.keyBindingsSetting);

  public readonly rows = input.required<readonly ShortcutRow[]>();
  public readonly query = input<string>("");

  protected record(row: ShortcutRow): void {
    this.notice.set(null);
    this.hint.set(Resources.recordingHint);
    this.recording.set(row.name);
  }

  protected press(row: ShortcutRow, event: KeyboardEvent): void {
    if (this.recording() !== row.name || (event.key === Resources.tabKey && !event.ctrlKey && !event.altKey && !event.metaKey))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (Resources.modifierKeys.includes(event.key)) {
      this.hint.set(this.heldLabel(event));
      return;
    }
    this.recording.set(null);
    if (event.key !== Resources.escapeKey || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)
      this.choose(row.name, event);
  }

  protected release(row: ShortcutRow, event: KeyboardEvent): void {
    if (this.recording() === row.name && Resources.modifierKeys.includes(event.key))
      this.hint.set(this.heldLabel(event));
  }

  protected stopRecording(row: ShortcutRow): void {
    if (this.recording() === row.name)
      this.recording.set(null);
  }

  protected remove(row: ShortcutRow): void {
    this.write(this.commands.bindings().with(row.name, null), row.name);
  }

  protected reset(row: ShortcutRow): void {
    this.write(this.commands.bindings().without(row.name), row.name);
  }

  protected resetAll(): void {
    this.notice.set(null);
    this.settings.resetAsync(Resources.keyBindingsSetting).catch((error: unknown) => this.errors.handleError(error));
  }

  protected useHere(notice: ShortcutNotice, holder: string): void {
    this.write(this.commands.bindings().with(notice.command, notice.key).with(holder, null), notice.command);
  }

  protected dismiss(notice: ShortcutNotice): void {
    this.notice.set(null);
    this.focusKey(notice.command);
  }

  protected formatKeyLabel(row: ShortcutRow, isRecording: boolean): string {
    return isRecording ? Resources.formatRecordingLabel(row.title, this.hint()) : Resources.formatChangeKeyLabel(row.title, row.key);
  }

  private choose(command: string, event: KeyboardEvent): void {
    const key = KeyChord.fromStroke(event, this.platform);
    if (Object.isNull(key)) {
      this.notice.set(new ShortcutNotice(command, this.unnamedKeyRefusal(event)));
      return;
    }
    const refusal = this.refusalOf(command, key);
    if (!Object.isNull(refusal)) {
      this.notice.set(new ShortcutNotice(command, refusal));
      return;
    }
    const shortcuts = this.commands.shortcuts();
    if (shortcuts.keyOf(command)?.isSameOn(key, this.platform) === true)
      return;
    const holder = shortcuts.holderOf(key);
    if (Object.isUndefined(holder) || holder === command)
      this.write(this.commands.bindings().with(command, key), command);
    else
      this.notice.set(new ShortcutNotice(command, Resources.formatKeyUsed(key.label(this.platform), this.commands.titleOf(holder)), key, holder));
  }

  private unnamedKeyRefusal(event: KeyboardEvent): string {
    if (!event.metaKey || this.platform === Resources.macPlatform)
      return Resources.unknownKeyRefused;
    return this.platform === Resources.windowsPlatform ? Resources.windowsKeyRefused : Resources.superKeyRefused;
  }

  private refusalOf(command: string, key: KeyChord): string | null {
    if (key.isTypingKey)
      return this.platform === Resources.macPlatform ? Resources.macTypingKeyRefused : Resources.typingKeyRefused;
    const owner = key.findReservedOwner(QualifiedName.parse(command));
    return Object.isNull(owner) ? null : Resources.formatKeyReserved(key.label(this.platform), owner);
  }

  private heldLabel(event: KeyboardEvent): string {
    const isMac = this.platform === Resources.macPlatform;
    const held = isMac
      ? Resources.macModifierSymbols.filter((_, index) => [event.ctrlKey, event.altKey, event.shiftKey, event.metaKey][index]).join(String.empty)
      : Resources.modifierNames.filter((_, index) => [event.ctrlKey, event.altKey, event.shiftKey][index]).map(t => `${t}${Resources.modifierSeparator}`).join(String.empty);
    return String.isNullOrEmpty(held) ? Resources.recordingHint : `${held}${Resources.recordingEllipsis}`;
  }

  private write(bindings: KeyBindings, command: string): void {
    this.notice.set(null);
    this.focusKey(command);
    this.settings.setAsync(Resources.keyBindingsSetting, bindings.toJson()).catch((error: unknown) => this.errors.handleError(error));
  }

  private focusKey(command: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(`[data-command="${command}"] .tr-shortcut-key`)?.focus();
  }
}
