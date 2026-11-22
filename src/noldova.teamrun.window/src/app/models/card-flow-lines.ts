/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";
import type { FlowBox } from "./flow-box";
import { FlowFrame } from "./flow-frame";
import { FlowPoint } from "./flow-point";
import { FlowRoute } from "./flow-route";

export class CardFlowLines {
  private readonly cards: ReadonlyMap<string, FlowBox>;
  private readonly plane: FlowBox;
  private readonly view: DOMRect;
  private readonly chat: DOMRect | null;

  private constructor(container: HTMLElement, chat: HTMLElement | null) {
    const frame = new FlowFrame(container);
    const cards = new Map<string, FlowBox>();
    for (const element of container.querySelectorAll<HTMLElement>(Resources.flowNodeSelector)) {
      const key = String(element.dataset[Resources.flowNodeData]);
      if (!cards.has(key))
        cards.set(key, frame.boxOf(element));
    }
    this.cards = cards;
    this.plane = frame.boxOf(container);
    this.view = (container.closest(Resources.flowCanvasSelector) ?? container).getBoundingClientRect();
    const panel = chat?.getBoundingClientRect() ?? null;
    this.chat = Object.isNull(panel) || panel.width === 0 && panel.height === 0 ? null : panel;
  }

  public static of(container: HTMLElement, chat: HTMLElement | null): CardFlowLines {
    return new CardFlowLines(container, chat);
  }

  public between(fromKey: string, toKey: string): FlowRoute | null {
    const source = this.cards.get(fromKey);
    const target = this.cards.get(toKey);
    if (fromKey === Resources.organizationFlowPersonKey)
      return Object.isUndefined(target) ? null : FlowRoute.along(this.fromChat(target), target);
    if (Object.isUndefined(source))
      return null;
    if (toKey === Resources.organizationFlowPersonKey)
      return FlowRoute.along([...this.fromChat(source)].reverse(), null);
    return Object.isUndefined(target) ? null : FlowRoute.along(CardFlowLines.across(source, target), target);
  }

  private fromChat(card: FlowBox): readonly FlowPoint[] {
    const chat = this.chat;
    if (Object.isNull(chat))
      return [];
    const x = card.left + card.width / 2;
    const y = card.top + card.height / 2;
    if (chat.left >= this.view.right)
      return [new FlowPoint(this.plane.width, y), new FlowPoint(card.left + card.width, y)];
    if (chat.top >= this.view.bottom)
      return [new FlowPoint(x, this.plane.height), new FlowPoint(x, card.top + card.height)];
    if (chat.right <= this.view.left)
      return [new FlowPoint(0, y), new FlowPoint(card.left, y)];
    return chat.bottom <= this.view.top ? [new FlowPoint(x, 0), new FlowPoint(x, card.top)] : [];
  }

  private static across(from: FlowBox, to: FlowBox): readonly FlowPoint[] {
    const fromRight = from.left + from.width;
    const toRight = to.left + to.width;
    const fromBottom = from.top + from.height;
    const toBottom = to.top + to.height;
    if (fromRight <= to.left || toRight <= from.left) {
      const start = fromRight <= to.left ? fromRight : from.left;
      const end = fromRight <= to.left ? to.left : toRight;
      const middle = (start + end) / 2;
      return [new FlowPoint(start, from.top + from.height / 2), new FlowPoint(middle, from.top + from.height / 2), new FlowPoint(middle, to.top + to.height / 2),
        new FlowPoint(end, to.top + to.height / 2)];
    }
    if (fromBottom <= to.top || toBottom <= from.top) {
      const start = fromBottom <= to.top ? fromBottom : from.top;
      const end = fromBottom <= to.top ? to.top : toBottom;
      const middle = (start + end) / 2;
      return [new FlowPoint(from.left + from.width / 2, start), new FlowPoint(from.left + from.width / 2, middle), new FlowPoint(to.left + to.width / 2, middle),
        new FlowPoint(to.left + to.width / 2, end)];
    }
    return [];
  }
}
