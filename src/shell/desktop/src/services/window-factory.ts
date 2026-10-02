/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";

import "@noldova/teamrun-foundation-core";

import type { DesktopSettings } from "../models/desktop-settings.js";
import type { WindowAppearance } from "../models/window-appearance.js";
import type { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import type { SenderPolicy } from "./sender-policy.js";

export class WindowFactory {
  private readonly settings: DesktopSettings;
  private readonly policy: SenderPolicy;

  public constructor(settings: DesktopSettings, policy: SenderPolicy) {
    this.settings = settings;
    this.policy = policy;
  }

  public create(state: WindowState): BrowserWindow {
    const options: BrowserWindowConstructorOptions = {
      width: state.width,
      height: state.height,
      minWidth: Resources.windowMinimumWidth,
      minHeight: Resources.windowMinimumHeight,
      show: false,
      title: Resources.applicationName,
      titleBarStyle: Resources.hiddenTitleBarStyle,
      webPreferences: {
        preload: this.settings.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webSecurity: true,
        spellcheck: false
      }
    };
    if (!Object.isNull(state.x) && !Object.isNull(state.y)) {
      options.x = state.x;
      options.y = state.y;
    }
    if (this.settings.isMac)
      options.trafficLightPosition = { ...Resources.trafficLightPosition };
    else
      options.titleBarOverlay = true;
    const window = new BrowserWindow(options);
    if (state.isMaximized)
      window.maximize();
    const contents = window.webContents;
    contents.on(Resources.willNavigateEvent, (event, url) => {
      if (!this.policy.isWindowUrl(url))
        event.preventDefault();
    });
    contents.on(Resources.willRedirectEvent, (event, url) => {
      if (!this.policy.isWindowUrl(url))
        event.preventDefault();
    });
    contents.on(Resources.willAttachWebviewEvent, event => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: Resources.denyWindowOpen }));
    void window.loadFile(this.settings.windowIndexPath);
    return window;
  }

  public show(window: BrowserWindow, appearance: WindowAppearance): void {
    window.setBackgroundColor(appearance.background);
    if (!this.settings.isMac)
      window.setTitleBarOverlay({ color: appearance.titleBar, symbolColor: appearance.titleBarText, height: appearance.titleBarHeight });
    if (!window.isVisible())
      window.show();
  }
}
