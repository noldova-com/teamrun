/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class EditTargetFixture {
  public readonly host: HTMLElement;

  private constructor(host: HTMLElement) {
    this.host = host;
  }

  public static create(): EditTargetFixture {
    const host = document.createElement("div");
    host.innerHTML = `
      <input class="field" type="text" value="Meeting notes">
      <input class="locked" type="text" value="Read only" readonly>
      <input class="off" type="text" value="Disabled" disabled>
      <input class="count" type="number" value="42">
      <input class="box" type="checkbox">
      <textarea class="notes">Week 3</textarea>
      <div class="rich" contenteditable="true">Rich text</div>
      <div class="plain">Plain text</div>
      <svg class="drawing" tabindex="0"></svg>
      <button type="button" class="elsewhere">Elsewhere</button>
      <div class="cdk-overlay-container"><button type="button" class="row">Copy</button></div>`;
    document.body.append(host);
    return new EditTargetFixture(host);
  }

  public find<T extends Element>(selector: string, type: abstract new () => T): T {
    const element = this.host.querySelector(selector);
    if (!(element instanceof type))
      throw new Error(`The page has no ${type.name} matching ${selector}.`);
    return element;
  }

  public remove(): void {
    this.host.remove();
  }
}
