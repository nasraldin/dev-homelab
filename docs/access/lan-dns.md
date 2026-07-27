# LAN DNS — `*.lab` short names

Quick reference for short LAN hostnames. For full context (how this fits with
public URLs and infra hostnames), read
[network and access](../architecture/network-and-access.md) and the
[daily guide](../guide/daily-use.md).

**Source of truth:** `lab-home-k8s/ansible/inventory/group_vars/all.yml`
(`lab_short_zone`, `technitium_short_zone_records`, `lab_urls`).

---

## How it works (short version)

```text
Laptop ──DNS──► AdGuard (192.168.68.10)
                    ├── *.lab ──────────────► Technitium
                    ├── *.lab.nasraldin.com ► Technitium
                    └── other names ────────► 1.1.1.1 (Cloudflare for public)
```

- `http://gitlab.lab` → direct to `192.168.68.11`
- `https://gitlab.nasraldin.com` → Cloudflare → tunnel (works on LAN **and** away)

We do **not** rewrite public names to LAN IPs in AdGuard. Both naming schemes
coexist without conflict.

---

## Laptop setup

1. DHCP **primary DNS** → `192.168.68.10`
2. Optional **search domain** → `lab`
3. Do **not** set search domain on k8s nodes

---

## `*.lab` cheat sheet

| URL                          | Service             |
| ---------------------------- | ------------------- |
| `https://pve.lab:8006`       | Proxmox             |
| `http://adguard.lab:3000`    | AdGuard             |
| `http://dns.lab:5380`        | Technitium          |
| `http://infisical.lab:8090`  | Infisical           |
| `http://gitlab.lab`          | GitLab              |
| `http://registry.lab:5050`   | Container registry  |
| `http://minio.lab:9001`      | AIStor console      |
| `http://s3.lab:9000`         | S3 API              |
| `http://npm.lab:81`          | NPM                 |
| `http://dockhand.lab`        | Dockhand            |
| `https://portainer.lab:9443` | Portainer           |
| `http://argo.lab`            | Argo CD             |
| `http://harbor.lab`          | Harbor              |
| `http://grafana.lab`         | Grafana             |
| `http://id.lab`              | Keycloak            |
| `http://longhorn.lab`        | Longhorn UI         |
| `http://192.168.68.105:3080` | LibreChat (AI)      |
| `http://192.168.68.106:3001` | AnythingLLM         |
| `http://192.168.68.107`      | n8n                 |
| `http://192.168.68.108:4000` | LiteLLM gateway     |
| `http://192.168.68.109`      | Open WebUI          |
| `http://192.168.68.110:4318` | OTel Collector OTLP |
| `https://kube.lab:6443`      | Kubernetes API      |

AI stack (Ollama on `ai-01`, clients via LiteLLM):
[ai-stack](../architecture/ai-stack.md).  
OpenTelemetry: [opentelemetry](../architecture/opentelemetry.md).

SSH uses `*.lab.nasraldin.com` (e.g. `gitlab-01.lab.nasraldin.com`).

---

## Apply / verify

```bash
cd lab-home-k8s/ansible
ansible-playbook -i inventory/hosts.yml playbooks/infra.yml -e @secrets.yml --limit infra-01

dig @192.168.68.10 gitlab.lab +short          # → 192.168.68.11
dig @192.168.68.10 gitlab.nasraldin.com +short # → Cloudflare
curl -fsS -o /dev/null -w '%{http_code}\n' http://gitlab.lab
```

Longhorn needs Argo app `platform-longhorn` Healthy (LB `192.168.68.104`).

---

## Related

- [Daily guide](../guide/daily-use.md)
- [Public URLs](public-urls.md)
- [Bring-up runbook](../runbook/bring-up.md)
