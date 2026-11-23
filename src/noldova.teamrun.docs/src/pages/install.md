# Install

TeamRun runs on Windows, macOS and Linux.
Download it from [teamrun.noldova.com/download](https://teamrun.noldova.com/download), which shows the files for each system.

## What your computer needs

| System | Oldest version | Processors |
|---|---|---|
| Windows | Windows 10 on x64; Windows 11 on ARM64 | x64 and ARM64 |
| macOS | macOS 13 Ventura | Apple silicon and Intel |
| Linux | Debian 11, Ubuntu 20.04 or another distribution as recent, in a version its maker still supports | x64 and ARM64 |

Windows 10 on ARM64 isn't supported.

## Windows

1. Download the `.exe` for your processor, x64 or ARM64.
2. Open it and follow its steps.
   The installer is signed.

## macOS

1. Download the `.pkg` installer, or the `.zip` that holds the app, for Apple silicon or Intel.
2. Open the `.pkg` and follow its steps, or unzip the app and move it to Applications.
3. The app is signed and notarized, so macOS opens it without a warning.

## Linux

Two kinds of package are offered, each for x64 and ARM64:

- **AppImage:** a single file.
  Make it executable, then open it.
- **.deb:** for Debian, Ubuntu and the distributions based on them.
  Install it with your package manager, such as `sudo apt install ./TeamRun-<version>-linux-x64.deb`.

The Linux packages aren't signed.
To check a download, compare it with its `.sha256` file, which sits beside it on the release.

## Checking a download

Every file on a release has a `.sha256` file beside it with the file's SHA-256 hash.
To compute your download's hash:

- Windows, in PowerShell: `Get-FileHash <file> -Algorithm SHA256`
- macOS: `shasum -a 256 <file>`
- Linux: `sha256sum <file>`

## Updates

TeamRun looks for a newer version by itself, and a newer version downloads in the background; installing it waits for you.

Settings' **Check for updates** chooses when it looks:

- **Automatically**, the default: 30 seconds after TeamRun starts, then every 10 minutes.
- **Only at start**: once, 30 seconds after TeamRun starts.
- **Only when I ask**: only when you choose Check for updates.

Before installing an update, TeamRun checks the file's size and hash, and on Windows its signature.
A copy installed from the `.deb` asks for an administrator's password to install each update.

What an update check sends is on [Privacy and network](privacy.md).
