# Home lab network and access

This page describes how the **home lab** is wired: IP addresses,
DNS, TLS, and how traffic reaches each service. It is the reference for
_why_ names resolve the way they do. For hands-on steps, see the
[daily guide](../guide/daily-use.md).

The practice lab (`k8s-lab`, `terraform-lab`, `ansible-lab`) uses a different
VMID map. Do not mix the two.

---

## Physical layout

One Proxmox host (`pve01`) on the home LAN. All guests attach to `vmbr0` on
`192.168.68.0/22`. The router is `192.168.68.1`.

```text
Internet
   │
   ├── Cloudflare (DNS + TLS + Tunnel) ──► public *.nasraldin.com
   │
Router 192.168.68.1
   │
   ├── pve01          192.168.68.2   (hypervisor — not a guest VM)
   │
   ├── infra-01       .10            DNS, secrets, object storage
   ├── gitlab-01      .11            GitLab CE
   ├── runner-01      .12            static GitLab Runner
   ├── k8s-cp-01      .13            Kubernetes control plane
   ├── k8s-w-01..03   .14–.16        workers (+ Longhorn data disks)
   ├── docker-01      .17            NPM, it-tools, mailpit
   ├── dockhand (LXC) .18            container UI + Hawser hub
   └── portainer (LXC).19            Portainer CE

Kubernetes LoadBalancer pool (Cilium): 192.168.68.100–.119
```

Ten guests total: eight VMs (110–117) and two LXC containers (118–119).

---

## IP and VMID table

| VMID | Host        | IP             | Role                                   |
| ---- | ----------- | -------------- | -------------------------------------- |
| —    | `pve01`     | `192.168.68.2` | Proxmox hypervisor                     |
| 110  | `infra-01`  | `.10`          | AdGuard, Technitium, Infisical, AIStor |
| 111  | `gitlab-01` | `.11`          | GitLab CE + container registry         |
| 112  | `runner-01` | `.12`          | Static GitLab Runner                   |
| 113  | `k8s-cp-01` | `.13`          | kubeadm control plane                  |
| 114  | `k8s-w-01`  | `.14`          | Worker (apps)                          |
| 115  | `k8s-w-02`  | `.15`          | Worker (platform)                      |
| 116  | `k8s-w-03`  | `.16`          | Worker (storage / Longhorn)            |
| 117  | `docker-01` | `.17`          | NPM, it-tools, mailpit                 |
| 118  | `dockhand`  | `.18`          | Dockhand + Hawser (LXC)                |
| 119  | `portainer` | `.19`          | Portainer CE (LXC)                     |

Kubernetes API: `192.168.68.13:6443` (direct to the control plane — no HAProxy).

---

## Cilium LoadBalancer reservations

In-cluster services that need a stable LAN IP get an address from
`192.168.68.100–119` (`lab-pool`). Cilium announces these on the LAN with L2.

| IP     | Service     | Public hostname           |
| ------ | ----------- | ------------------------- |
| `.100` | Argo CD     | `argo.nasraldin.com`      |
| `.101` | Harbor      | `harbor.nasraldin.com`    |
| `.102` | Grafana     | `grafana.nasraldin.com`   |
| `.103` | Keycloak    | `id.nasraldin.com`        |
| `.104` | Longhorn UI | `longhorn.lab` (LAN only) |

Everything else in the pool is free for future platform apps.

---

## Three naming layers

Homelab services are reachable under three related naming schemes. They point at
the same backends; the difference is _who_ resolves the name and _when_ you use it.

| Layer         | Pattern               | Example                        | Used for                                             |
| ------------- | --------------------- | ------------------------------ | ---------------------------------------------------- |
| **Public**    | `*.nasraldin.com`     | `https://gitlab.nasraldin.com` | Bookmarks, GitLab `external_url`, off-LAN access, CI |
| **Short LAN** | `*.lab`               | `http://gitlab.lab`            | Fast browsing at home — no tunnel                    |
| **Infra**     | `*.lab.nasraldin.com` | `gitlab-01.lab.nasraldin.com`  | SSH, Ansible, monitoring hostnames                   |

These zones do **not** conflict with each other. `gitlab.lab` and
`gitlab.nasraldin.com` are different DNS names.

### Public names (`*.nasraldin.com`)

- DNS is public (Cloudflare, proxied).
- TLS terminates at Cloudflare.
- On the LAN, your laptop still resolves these through Cloudflare unless you add
  split-horizon rewrites (we deliberately do **not** do that yet — it breaks
  HTTPS until you add local certificates).
- Traffic path: browser → Cloudflare → **cloudflared** on `pve01` → LAN origin.

Protected with **Cloudflare Access** (email OTP):

- `homelab.nasraldin.com` → Proxmox UI
- `docker.nasraldin.com` → Dockhand

Everything else uses the application's own login (GitLab, Harbor, Grafana, etc.).

Full hostname list: [public URLs](../access/public-urls.md).

### Short LAN names (`*.lab`)

- Authoritative zone on **Technitium** (`infra-01`).
- AdGuard forwards `*.lab` queries to Technitium.
- HTTP direct to the service IP — no Cloudflare, no tunnel.
- Not published on the public internet; away from home these names simply do not resolve.

Cheat sheet: [LAN DNS](../access/lan-dns.md).

### Infra hostnames (`*.lab.nasraldin.com`)

- Also on Technitium.
- Matches guest hostnames (`infra-01`, `k8s-cp-01`, …) plus service aliases
  (`argo`, `harbor`, `kube-api`, …).
- Use these for SSH and automation, not for day-to-day browser bookmarks.

---

## DNS flow on the LAN

```text
Your laptop
    │
    │  DHCP DNS = 192.168.68.10 (AdGuard on infra-01)
    ▼
AdGuard Home (:53)
    │
    ├─ *.lab ──────────────────────► Technitium (:5380)  zone "lab"
    ├─ *.lab.nasraldin.com ────────► Technitium           zone "lab.nasraldin.com"
    └─ everything else ────────────► 1.1.1.1 / 1.0.0.1
                                      (gitlab.nasraldin.com → Cloudflare)
```

**Router DHCP** should hand out `192.168.68.10` as the primary DNS server once
`infra-01` is up. Keep `1.1.1.1` as secondary on the router if you want a
fallback when AdGuard is down.

Optional: set DHCP **search domain** to `lab` so typing `gitlab` in a browser
resolves to `gitlab.lab`. Do **not** push a search domain to Kubernetes nodes —
it breaks outbound DNS lookups from pods.

Source of truth in Git:

- `lab-home-k8s/ansible/inventory/group_vars/all.yml` — zones, records, URLs
- `lab-home-k8s/config/public-urls.yml` — mirror for non-Ansible tooling

---

## Traffic paths by service type

### VMs and LXC (direct IP)

GitLab, AIStor, NPM, Dockhand, Portainer, Proxmox — the browser hits the guest
IP and port directly (or via `*.lab` DNS that points there).

### Kubernetes (Cilium LoadBalancer)

Argo CD, Harbor, Grafana, Keycloak, Longhorn — ClusterIP services are fronted
by a `LoadBalancer` Service with a fixed IP from `.100–.119`. Cilium answers
ARP for that IP on the LAN.

### Cloudflare Tunnel (public only)

The `cloudflared` connector runs on `pve01`. Ingress rules map each public
hostname to a LAN origin (HTTP on the guest, or HTTPS for Proxmox/Portainer).
Copy the template from
`lab-home-k8s/config/cloudflare-tunnel-ingress.example.json`.

---

## TLS summary

| Access path                          | TLS where             | Notes                           |
| ------------------------------------ | --------------------- | ------------------------------- |
| `https://*.nasraldin.com` (anywhere) | Cloudflare edge       | Origins speak HTTP on LAN       |
| `http://*.lab` (LAN)                 | None                  | Fast; fine for homelab browsing |
| `https://pve.lab:8006`               | Proxmox self-signed   | Accept cert in browser          |
| `https://portainer.lab:9443`         | Portainer self-signed | Accept cert in browser          |
| `https://kube.lab:6443`              | Kubernetes API cert   | Use `fetch-kubeconfig.sh`       |

GitLab is configured with `external_url = https://gitlab.nasraldin.com`. If you
open `http://gitlab.lab`, GitLab may redirect you to the public hostname. That is
expected. Use the public URL when you need a stable session; use `.lab` when you
want a quick local hop.

---

## Container management (two tools, different jobs)

| Tool          | Where   | URL (LAN)                    | URL (public)                      | Purpose                                               |
| ------------- | ------- | ---------------------------- | --------------------------------- | ----------------------------------------------------- |
| **Dockhand**  | LXC 118 | `http://dockhand.lab`        | `https://docker.nasraldin.com`    | Unified UI; Hawser agents on `infra-01` + `docker-01` |
| **Portainer** | LXC 119 | `https://portainer.lab:9443` | `https://portainer.nasraldin.com` | Docker endpoint management; add hosts in the UI       |

Dockhand is the day-to-day stack view. Portainer is there if you prefer its
environment model or need to attach additional Docker hosts manually.

---

## Repository ownership

| Concern                                         | Repo                 |
| ----------------------------------------------- | -------------------- |
| VMs, LXC, guest OS, kubeadm                     | `lab-home-k8s`       |
| In-cluster platform (Argo, Longhorn, Harbor, …) | `lab-home-gitops`    |
| GitLab CI job templates                         | `pipeline-templates` |
| Proxmox host bootstrap                          | `proxmox-bootstrap`  |
| Tunnel connector config                         | `cloudflare-tunnel`  |

---

## Related pages

| Page                                       | Contents                                      |
| ------------------------------------------ | --------------------------------------------- |
| [Daily guide](../guide/daily-use.md)       | Step-by-step: laptop setup, open each service |
| [Bring-up runbook](../runbook/bring-up.md) | Fresh Proxmox → full install                  |
| [Public URLs](../access/public-urls.md)    | Hostname → origin table                       |
| [LAN DNS](../access/lan-dns.md)            | `*.lab` quick reference                       |
| [Topology](topology.md)                    | Guest layout and deploy order                 |
| [CI](../ci/pipelines.md)                   | Pipeline variables                            |
