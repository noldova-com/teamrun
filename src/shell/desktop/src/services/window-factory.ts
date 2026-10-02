/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { DesktopSettings } from "../models/desktop-settings.js";
import type { TaskbarIdentity } from "../models/taskbar-identity.js";
import type { WindowAppearance } from "../models/window-appearance.js";
import type { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import type { SenderPolicy } from "./sender-policy.js";

export class WindowFactory {
  private readonly settings: DesktopSettings;
  private readonly policy: SenderPolicy;
  private readonly electron: IElectron;
  private readonly taskbar: TaskbarIdentity;

  public constructor(settings: DesktopSettings, policy: SenderPolicy, electron: IElectron, taskbar: TaskbarIdentity) {
    this.settings = settings;
    this.policy = policy;
    this.electron = electron;
    this.taskbar = taskbar;
  }

  public create(state: WindowState): IDesktopWindow {
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
    if (this.settings.isMac)
      options.trafficLightPosition = { ...Resources.trafficLightPosition };
    else
      options.titleBarOverlay = true;
    const window = this.electron.createWindow(options);
    if (this.settings.platform === Resources.windowsPlatform)
      window.setAppDetails(this.taskbar.toAppDetails());
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

  public paint(window: IDesktopWindow, appearance: WindowAppearance): void {
    window.setBackgroundColor(appearance.background);
    if (!this.settings.isMac)
      window.setTitleBarOverlay({ color: appearance.titleBar, symbolColor: appearance.titleBarText, height: appearance.titleBarHeight });
  }
}
