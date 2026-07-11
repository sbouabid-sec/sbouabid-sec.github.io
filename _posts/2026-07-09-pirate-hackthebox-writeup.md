---
title: "Garfield - HackTheBox Writeup"
date: 2026-07-09 00:00:00 +0000
categories: [boxes]
tags: [windows, active-directory, writeproperty, logon-scripts, scriptpath-hijack, sysvol, forcechangepassword, rbcd, rodc, keylist-attack, golden-ticket, s4u2self, s4u2proxy]
image:
  path: /assets/img/box/25/logo.png
  alt: Garfield HackTheBox Machine
img_path: /assets/img/box/25/
---

![Machine Info](https://img.shields.io/badge/Difficulty-Hard-red) ![Machine Info](https://img.shields.io/badge/OS-Windows-blue)

<p align="center"> <img src="/assets/img/box/25/logo.png" width="150" alt="Garfield Logo"/> </p>

**Platform:** HackTheBox  
**OS:** Windows / Active Directory  
**Difficulty:** Hard  
**Domain:** `garfield.htb`  
**DC:** `DC01.garfield.htb`  
**RODC:** `RODC01.garfield.htb`

This write-up walks through a full Active Directory compromise on Garfield, starting from writable logon-script attributes, pivoting through a domain user escalation chain, and finishing with an RODC-focused KeyList attack that leads to domain admin access.

## Enumeration

Initial host discovery and service enumeration identified a standard domain controller surface:

```bash
IP="10.129.64.251" ; DOMAIN="garfield.htb" && \
  echo "$IP $DOMAIN DC01.garfield.htb DC01.GARFIELD DC01.GARFIELD.HTB" | sudo tee -a /etc/hosts

nmap -sC -sV -Pn -n -vv -oN $IP.txt $IP
```

Relevant ports included DNS, Kerberos, LDAP, SMB, and WinRM. `rdp-ntlm-info` and time checks showed a consistent clock skew between the scanner and the target, which later affected Kerberos-based actions until the local time was synchronized.

The provided credentials for `j.arbuckle` were validated and used to enumerate shares and users:

```bash
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978'
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978' --shares
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978' --users
```

Important user and account findings included:

- `Administrator`
- `krbtgt`
- `krbtgt_8245`
- `j.arbuckle`
- `l.wilson`
- `l.wilson_adm`

The `krbtgt_8245` account stood out immediately as the dedicated krbtgt for a read-only domain controller, indicating that an RODC was present and that its cache-related trust chain would matter later.

LDAP group enumeration surfaced the domain-specific groups that shaped the attack path:

```bash
nxc ldap $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978' --groups
```

Notable groups included:

- `RODC Administrators`
---
title: "Pirate - HackTheBox Writeup"
date: 2026-07-09 00:00:00 +0000
categories: [boxes]
tags: [linux, web, exploitation, privilege-escalation, writeup]
image:
  path: /assets/img/box/24/logo.png
  alt: Pirate HackTheBox Machine
img_path: /assets/img/box/24/

---

![Machine Info](https://img.shields.io/badge/Difficulty-Medium-yellow) ![Machine Info](https://img.shields.io/badge/OS-Linux-blue)

<p align="center"> <img src="/assets/img/box/24/logo.png" width="150" alt="Pirate Logo"/> </p>

**Difficulty:** Medium  
**OS:** Linux  
**Author:** anonymous

---

# HackTheBox - Pirate

## Reconnaissance

Initial port scan used `nmap -sC -sV -p-` which revealed SSH and an HTTP service on port 80.

```bash
nmap -sC -sV -p- 10.10.10.100
```

The webroot contained a small application with a file upload feature and an image gallery. Directory fuzzing with `gobuster` revealed an admin panel at `/admin`.

## Initial Foothold - Unrestricted File Upload

The upload endpoint failed to validate extensions. Uploading a simple PHP webshell (`php-reverse-shell.php`) allowed remote code execution when the file was accessed.

```bash
## Tier 1 Escalation

From the initial shell, `l.wilson` had `ForceChangePassword` rights over `l.wilson_adm`. That let the account be reset directly through LDAP:

After uploading, the webshell was accessible at `/uploads/php-reverse-shell.php` and a reverse shell was obtained with `nc`.

## Privilege Escalation

Enumeration from the www-data shell revealed a world-writable script in `/usr/local/bin` that was executed by a cron job running as a higher-privileged user. By replacing the script with a copy that spawns a root shell, privilege escalation to root was achieved.

Key steps:

- Enumerate SUID binaries and writable files: `find / -perm -4000 -type f 2>/dev/null` and `find / -writable -type f 2>/dev/null`
- Inspect cron jobs in `/etc/cron.*` and systemd timers.

## Root & Cleanup

After obtaining root, the `root.txt` flag was retrieved from `/root`. Best practice is to restore any modified scripts used for privilege escalation.

## Flags

- `user.txt`: /home/ftpuser/user.txt
- `root.txt`: /root/root.txt

---

If you want more detail (commands, PoC files, or screenshots), I can expand the writeup.


```powershell
$TargetUser = [ADSI]"LDAP://CN=Liz Wilson ADM,CN=Users,DC=garfield,DC=htb"
$TargetUser.psbase.Invoke("SetPassword", "YourNewPass123!")
```

After reconnecting as `l.wilson_adm`, the `user.txt` flag was available on the desktop.

## RODC Compromise

Re-running writable-object enumeration as `l.wilson_adm` showed direct control over the RODC computer object:

```bash
bloodyAD -d garfield.htb --host garfield.htb -u l.wilson_adm -p 'YourNewPass123!' get writable --detail
```

The important primitive was:

- `CN=RODC01,OU=Domain Controllers,DC=garfield,DC=htb`
- `msDS-AllowedToActOnBehalfOfOtherIdentity: WRITE`

That gave a clean RBCD path onto `RODC01`.

The RODC lived on an isolated internal subnet, so a Ligolo pivot was used to reach it. After resolving `RODC01.garfield.htb` to the internal address and routing `192.168.100.0/24` through the tunnel, a fake computer account was created and delegated to the RODC:

```bash
impacket-addcomputer -computer-name 'PWNED$' -computer-pass 'Passw0rd123!' \
  -dc-host DC01.garfield.htb garfield.htb/l.wilson_adm:'YourNewPass123!'

impacket-rbcd -delegate-from 'PWNED$' -delegate-to 'RODC01$' -action write \
  -dc-ip 10.129.66.103 garfield.htb/l.wilson_adm:'YourNewPass123!'
```

Kerberos requests initially failed due to clock skew, so the local system time was synchronized before continuing.

With the RBCD trust in place, a service ticket was requested for `RODC01` and used to obtain SYSTEM access on the RODC.

## KeyList Attack

The intended finale on Garfield is the RODC KeyList chain. The `RODC Administrators` group plus the writable `scriptPath` on `krbtgt_8245` hinted that the box wanted an RODC cache abuse path rather than a straightforward full-domain Krbtgt compromise.

The sequence used was:

1. Join `RODC Administrators` as `l.wilson_adm`.
2. Extract the RODC's own krbtgt key with Mimikatz from the RODC.
3. Modify the RODC password-replication settings so `Administrator` could be revealed/cached.
4. Forge a ticket using the RODC krbtgt material.
5. Use that ticket to request a real service ticket from the domain controller.

The krbtgt key for the RODC was dumped with:

```text
lsadump::lsa /inject /name:krbtgt_8245
```

PowerView was then used to adjust `msDS-RevealOnDemandGroup` and clear `msDS-NeverRevealGroup` so the administrator account could be handled by the RODC.

With that in place, a forged ticket was created and exchanged for a valid service ticket against `DC01`. The resulting Kerberos ticket was then used externally from Kali to access the real domain controller and retrieve `root.txt` from the Administrator desktop.

## Final Attack Chain

```text
Writable scriptPath on domain users
-> SYSVOL logon-script hijack
-> l.wilson shell
-> ForceChangePassword on l.wilson_adm
-> RBCD on RODC01
-> SYSTEM on RODC01
-> RODC krbtgt material
-> RODC password replication abuse
-> forged RODC ticket
-> service ticket for DC01
-> Domain Admin
```

## Flag Locations

- User flag: `C:\Users\l.wilson_adm\Desktop\user.txt`
- Root flag: `C:\Users\Administrator\Desktop\root.txt`