/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PointerEventsFixture {
  public static enter(element: Element): void {
    PointerEventsFixture.send(PointerEventsFixture.chain(element).reverse(), "pointerenter");
  }

  public static leave(element: Element): void {
    PointerEventsFixture.send(PointerEventsFixture.chain(element), "pointerleave");
  }

  private static chain(element: Element): Element[] {
    const chain: Element[] = [];
    for (let target: Element | null = element; target !== null; target = target.parentElement)
      chain.push(target);
    return chain;
  }

  private static send(targets: readonly Element[], type: string): void {
    for (const target of targets)
      target.dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));
  }
}
