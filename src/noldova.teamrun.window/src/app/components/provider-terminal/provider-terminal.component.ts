/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Component,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  InjectionToken,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  signal,
  type Signal,
  untracked,
  viewChild,
  type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { EmbeddedTerminal } from "@noldova/terminal.window";
import { IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { IEmbeddedTerminal } from "../../interfaces/i-embedded-terminal";
import type { IEmbeddedTerminalOpener } from "../../interfaces/i-embedded-terminal-opener";

@Component({
  selector: "nol-teamrun-provider-terminal",
  imports: [IconButtonComponent],
  templateUrl: "./provider-terminal.component.html",
  styleUrl: "./provider-terminal.component.css"
})
export class ProviderTerminalComponent {
  public static readonly opener: InjectionToken<IEmbeddedTerminalOpener> =
    new InjectionToken<IEmbeddedTerminalOpener>(Resources.embeddedTerminalToken, { factory: (): IEmbeddedTerminalOpener => EmbeddedTerminal });

  public readonly sessionId: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly unavailable: WritableSignal<boolean> = signal(false);
  private readonly screen: Signal<ElementRef<HTMLElement>> = viewChild.required("screen", { read: ElementRef });
  private readonly terminal: WritableSignal<IEmbeddedTerminal | null> = signal(null);

  public constructor() {
    const opener = inject(ProviderTerminalComponent.opener);
    const injector = inject(EnvironmentInjector);
    effect(onCleanup => {
      const sessionId = this.sessionId();
      const screen = this.screen().nativeElement;
      let opened: IEmbeddedTerminal;
      try {
        opened = opener.open(sessionId, injector, Resources.providerTerminalRows);
      }
      catch {
        untracked(() => {
          this.unavailable.set(true);
          this.terminal.set(null);
        });
        return;
      }
      screen.append(opened.element);
      untracked(() => {
        this.unavailable.set(false);
        this.terminal.set(opened);
      });
      onCleanup(() => {
        opened.element.remove();
        opened.dispose();
      });
    });
  }

  public focus(): void {
    this.terminal()?.focus();
  }
}
