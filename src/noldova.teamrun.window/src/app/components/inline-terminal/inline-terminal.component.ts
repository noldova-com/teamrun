/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, DestroyRef, ElementRef, EnvironmentInjector, type InputSignal, type Signal, afterNextRender, afterRenderEffect, computed, inject, input,
  untracked, viewChild
} from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CodeBlockComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { IRunPlace } from "../../interfaces/i-run-place";
import { ChatTerminals } from "../../services/chat-terminals";
import { CommandTargetsService } from "../../services/command-targets.service";

@Component({
  selector: "nol-teamrun-inline-terminal",
  imports: [ButtonComponent, CodeBlockComponent],
  templateUrl: "./inline-terminal.component.html",
  styleUrl: "./inline-terminal.component.css"
})
export class InlineTerminalComponent {
  public readonly owner: InputSignal<string> = input.required<string>();
  public readonly messageId: InputSignal<string> = input.required<string>();
  public readonly site: InputSignal<string> = input.required<string>();
  public readonly block: InputSignal<number> = input.required<number>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly isBusy: Signal<boolean> = computed(() => this.terminals?.inlineTerminals?.isBusyAt(this.owner(), this.place()) ?? false);
  protected readonly output: Signal<string | null> = computed(() =>
    this.terminals?.inlineTerminals?.outputAt(this.owner(), this.place())?.lines.map(t => t.text).join("\n") ?? null);

  private readonly context: IWindowPartContext = inject<IWindowPartContext>(WindowPartTokens.context);
  private readonly terminals: ChatTerminals | null = ChatTerminals.of(this.context);
  private readonly place: Signal<IRunPlace> = computed(() => ({ messageId: this.messageId(), site: this.site(), block: this.block() }));
  private readonly live: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("live");

  public constructor() {
    const injector = inject(EnvironmentInjector);
    const destroy = inject(DestroyRef);
    const inline = this.terminals?.inlineTerminals ?? null;
    if (Object.isNull(inline))
      return;
    afterNextRender(() => {
      const host = this.live().nativeElement;
      const toComposer = (event: KeyboardEvent): void => {
        if (!InlineTerminalComponent.isComposerKey(event))
          return;
        event.preventDefault();
        event.stopPropagation();
        CommandTargetsService.of(this.context).focusComposer(this.owner().slice(ProtocolResources.chatTerminalOwnerPrefix.length));
      };
      host.addEventListener(Resources.keyDownEvent, toComposer, true);
      destroy.onDestroy(() => host.removeEventListener(Resources.keyDownEvent, toComposer, true));
    });
    afterRenderEffect(() => {
      const host = this.live().nativeElement;
      const owner = this.owner();
      const place = this.place();
      if (inline.isLiveAt(owner, place))
        untracked(() => inline.attach(owner, place, host, injector));
      else
        untracked(() => inline.detach(owner, host));
    });
    afterNextRender(() => {
      const host = this.live().nativeElement;
      const history = host.closest(Resources.listViewportSelector);
      if (Object.isNull(history))
        return;
      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => inline.fit(this.owner(), history.clientHeight));
      });
      observer.observe(history);
      observer.observe(host);
      destroy.onDestroy(() => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      });
    });
    destroy.onDestroy(() => inline.detach(this.owner(), this.live().nativeElement));
  }

  protected answer(stop: boolean): void {
    this.terminals?.answerBusy(this.owner(), stop);
  }

  private static isComposerKey(event: KeyboardEvent): boolean {
    return event.code === Resources.inlineTerminalComposerKeyCode && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
  }
}
