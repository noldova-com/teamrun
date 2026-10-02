/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly applicationName: string = "TeamRun";
  public static readonly appUserModelId: string = "com.noldova.teamrun";
  public static readonly bridgeName: string = "teamrun";
  public static readonly readyChannel: string = "teamrun:ready";
  public static readonly closeRequestChannel: string = "teamrun:closeRequest";
  public static readonly closeAnswerChannel: string = "teamrun:closeAnswer";
  public static readonly hashPrefix: string = "#";
  public static readonly queryPrefix: string = "?";
  public static readonly macPlatform: string = "darwin";
  public static readonly preloadFileName: string = "preload.cjs";
  public static readonly repositoryRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly windowIndexSegments: readonly string[] = ["_build", "window", "browser", "index.html"];
  public static readonly platformParameter: string = "platform";
  public static readonly windowIndexParameter: string = "windowIndexPath";
  public static readonly preloadParameter: string = "preloadPath";
  public static readonly hiddenTitleBarStyle: "hidden" = "hidden";
  public static readonly denyWindowOpen: "deny" = "deny";
  public static readonly trafficLightPosition: Readonly<{ x: number; y: number }> = { x: 12, y: 10 };
  public static readonly willNavigateEvent: "will-navigate" = "will-navigate";
  public static readonly willRedirectEvent: "will-redirect" = "will-redirect";
  public static readonly willAttachWebviewEvent: "will-attach-webview" = "will-attach-webview";
  public static readonly closeEvent: "close" = "close";
  public static readonly closedEvent: "closed" = "closed";
  public static readonly secondInstanceEvent: "second-instance" = "second-instance";
  public static readonly windowAllClosedEvent: "window-all-closed" = "window-all-closed";
  public static readonly activateEvent: "activate" = "activate";
  public static readonly windowMinimumWidth: number = 640;
  public static readonly windowMinimumHeight: number = 400;
  public static readonly windowWidth: number = 1280;
  public static readonly windowHeight: number = 800;
  public static readonly closeAnswerTimeout: number = 5000;
  public static readonly windowStateSaveDelay: number = 500;
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly widthField: string = "width";
  public static readonly heightField: string = "height";
  public static readonly maximizedField: string = "maximized";
  public static readonly invalidWindowState: string = "The saved window state is not valid.";
  public static readonly positionPairMessage: string = "A window position has both coordinates or neither.";
  public static readonly windowUrlParameter: string = "windowUrl";
  public static readonly timeoutParameter: string = "timeout";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly invalidAppearance: string = "The window appearance is not valid.";
  public static readonly invalidColor: string = "A window color is a hexadecimal color or an rgb() or rgba() color.";
  public static readonly colorPattern: RegExp = /^(?:#[0-9A-Fa-f]{3,8}|rgba?\([0-9., %/]+\))$/;
  public static readonly contentSecurityPolicy: string =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; " +
    "object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";

  public static formatAppearanceRejected(reason: string): string {
    return `The window reported an appearance that is not valid, so it is shown without it: ${reason}`;
  }

  public static formatWindowSize(name: string, minimum: number): string {
    return `The window ${name} is a whole number of at least ${minimum} pixels.`;
  }
}
