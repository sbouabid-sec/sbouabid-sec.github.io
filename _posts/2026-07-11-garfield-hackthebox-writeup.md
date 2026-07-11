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

The provided credentials for `j.arbuckle` were validated and used to enumerate shares and users.

## Initial Foothold

The primary foothold was a writable `scriptPath` attribute that allowed placing a logon script in `SYSVOL` and executing it when a target user logged on.

```bash
bloodyAD --host garfield.htb -d garfield.htb -u j.arbuckle -p 'Th1sD4mnC4t!@1978' get writable --detail
```

SYSVOL access confirmed a `printerDetect.bat` script in `garfield.htb\scripts`, which was replaced by a PowerShell reverse shell wrapped in a batch file.

## Privilege Escalation & RODC

From the initial shell, `ForceChangePassword` rights were abused to escalate to `l.wilson_adm`, and subsequently RBCD was used to gain control over `RODC01`.

Key steps included creating a delegated computer account, using `impacket` tools for RBCD, and extracting the RODC's krbtgt material to forge tickets that could be exchanged for DC service tickets.

## Final Notes

The full chain culminated with domain admin access via RODC KeyList abuse and forged Kerberos tickets.

## Flag Locations

- User flag: `C:\Users\l.wilson_adm\Desktop\user.txt`
- Root flag: `C:\Users\Administrator\Desktop\root.txt`
