TeamRun brings coding agents together in one desktop application.

Download the installer for your operating system and CPU:

| Platform | Install | Portable/archive |
|---|---|---|
| Windows | `TeamRun-<version>-windows-<arch>-setup.exe` | `.zip` |
| macOS | `TeamRun-<version>-mac-<arch>.dmg` | `.zip` |
| Linux | `TeamRun-linux-<arch>.AppImage` | — |

Choose `x64` for Intel/AMD computers or `arm64` for Apple Silicon and other ARM computers. GitHub's source-code downloads are not installers.

These builds are **unsigned** and the macOS app is not notarized. Windows may show a reputation warning. On macOS, after an initial blocked launch, use System Settings → Privacy & Security → Open Anyway for this trusted download. Linux requires Electron sandbox support; `APPIMAGE_EXTRACT_AND_RUN=1 ./TeamRun-linux-<arch>.AppImage` is available when FUSE mounting is unavailable.

TeamRun is in early development. Releases use numbered versions such as `0.0.1` and `0.0.2`. In-app updates currently work on Windows x64 and with the Linux x64 AppImage, which an update replaces in place. Other targets require downloading the next version.

`SHA256SUMS` and the package reports identify the downloadable files and their build revision. The `latest*.yml` files describe each platform's builds for in-app updates; they do not establish in-app update support for that platform.

Report problems through [GitHub Issues](https://github.com/noldova-com/teamrun/issues), including the application version, OS and CPU. Keep a backup of important TeamRun data when testing early releases.
