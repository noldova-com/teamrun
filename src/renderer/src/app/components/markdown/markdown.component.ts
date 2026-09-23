/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type Signal, afterRenderEffect, computed, inject, input, output } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import hljs from "highlight.js/lib/common";
import { Marked, Renderer, type Tokens } from "marked";
import { MentionResolver, type TeammateMention } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";

@Component({
  selector: "tr-markdown",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tr-markdown block", "(click)": "onClick($event)", "(keydown.enter)": "onClick($event)", "(keydown.space)": "onClick($event)" },
  templateUrl: "./markdown.component.html"
})
export class MarkdownComponent {
  private static readonly marked: Marked = new Marked({ gfm: true, breaks: true, renderer: MarkdownComponent.createRenderer() });
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly wrapped: Set<number> = new Set();

  public readonly text = input.required<string>();
  public readonly mentions = input<readonly TeammateMention[]>([]);
  public readonly unavailableMentions = input<readonly string[]>([]);
  public readonly wrapChoices = input<Set<number> | null>(null);
  public readonly wrapChanged = output<void>();

  protected readonly html: Signal<string> = computed(() => {
    const marked = this.mentions().length === 0 ? MarkdownComponent.marked
      : new Marked({ gfm: true, breaks: true, renderer: MarkdownComponent.createRenderer(this.mentions(), this.unavailableMentions()) });
    return marked.parse(this.text(), { async: false });
  });
  private readonly copied: Map<Element, number> = new Map();

  public constructor() {
    afterRenderEffect(() => {
      this.text();
      const wrapped = this.wrapChoices() ?? this.wrapped;
      this.element.querySelectorAll<HTMLElement>(Resources.wrapButtonSelector).forEach((button, index) => this.applyWrapping(button, wrapped.has(index)));
    });
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.copied.values())
        window.clearTimeout(timer);
    });
  }

  protected onClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element))
      return;
    const wrap = target.closest<HTMLElement>(Resources.wrapButtonSelector);
    if (!Object.isNull(wrap)) {
      event.preventDefault();
      const index = Array.from(this.element.querySelectorAll(Resources.wrapButtonSelector)).indexOf(wrap);
      const wrapped = this.wrapChoices() ?? this.wrapped;
      if (!wrapped.delete(index))
        wrapped.add(index);
      this.applyWrapping(wrap, wrapped.has(index));
      this.wrapChanged.emit();
      return;
    }
    const button = target.closest<HTMLElement>(Resources.copyButtonSelector);
    if (Object.isNull(button))
      return;
    const code = button.closest(Resources.codeBlockSelector)?.querySelector(Resources.codeSelector);
    if (Object.isNull(code) || Object.isUndefined(code))
      return;

    event.preventDefault();
    void navigator.clipboard?.writeText(code.textContent ?? String.empty);
    this.showCopied(button);
  }

  private applyWrapping(button: HTMLElement, wrapped: boolean): void {
    const pre = button.closest(Resources.codeBlockSelector)?.querySelector(Resources.codeSelector)?.parentElement;
    pre?.classList.toggle(Resources.wrappedClass, wrapped);
    button.ariaPressed = String(wrapped);
    button.title = wrapped ? Resources.disableWordWrapLabel : Resources.enableWordWrapLabel;
  }

  private showCopied(button: HTMLElement): void {
    const previous = this.copied.get(button);
    if (!Object.isUndefined(previous))
      window.clearTimeout(previous);
    button.classList.add(Resources.copiedClass);
    button.textContent = Resources.copiedIcon;
    button.title = Resources.copiedLabel;
    button.ariaLabel = Resources.copiedLabel;
    this.copied.set(button, window.setTimeout(() => {
      button.classList.remove(Resources.copiedClass);
      button.textContent = Resources.copyIcon;
      button.title = Resources.copyLabel;
      button.ariaLabel = Resources.copyLabel;
      this.copied.delete(button);
    }, Resources.copiedDuration));
  }

  private static createRenderer(mentions: readonly TeammateMention[] = [], unavailable: readonly string[] = []): Renderer {
    const renderer = new Renderer();
    const plainText = renderer.text;
    renderer.text = function(token): string {
      if ("tokens" in token && token.tokens)
        return plainText.call(this, token);
      const spans = MentionResolver.find(token.text, mentions);
      const parts: string[] = [];
      let offset = 0;
      for (const span of spans) {
        parts.push(plainText.call(this, { ...token, text: token.text.slice(offset, span.start) }));
        const label = plainText.call(this, { ...token, text: token.text.slice(span.start, span.end) });
        parts.push(Resources.formatMentionHtml(label, unavailable.includes(span.mention.teammateId)));
        offset = span.end;
      }
      parts.push(plainText.call(this, { ...token, text: token.text.slice(offset) }));
      return parts.join(String.empty);
    };
    const plain = renderer.code.bind(renderer);
    renderer.code = (token: Tokens.Code): string => {
      const lang = token.lang ?? String.empty;
      const language = String.isNullOrWhitespace(lang) ? Resources.codeLabel : lang.split(Resources.space)[0] ?? Resources.codeLabel;
      const known = hljs.getLanguage(language);
      const inner = Object.isUndefined(known) ? plain(token) : Resources.formatHighlightedCode(language, hljs.highlight(token.text, { language }).value);
      return Resources.formatCodeBlock(language, inner);
    };

    return renderer;
  }
}
