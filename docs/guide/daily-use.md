# Home lab daily guide

How to use the homelab once it is built. This assumes the
[bring-up runbook](../runbook/bring-up.md) has already been completed and the
acceptance checklist passes.

For network design and DNS theory, read
[network and access](../architecture/network-and-access.md) first.

---

## What you have when the lab is healthy

- **Proxmox** on `192.168.68.13` with eleven guests (nine VMs + two LXC), including
  **`ai-01`** for local LLM inference.
- **DNS** on `infra-01` — AdGuard for clients, Technitium for internal zones.
- **GitLab** with CI runners (static VM + in-cluster KEDA runner after GitOps sync).
- **Kubernetes** — one control plane, three workers, Cilium CNI.
- **Platform stack** in the cluster — Argo CD, Longhorn, Harbor, Grafana, Keycloak, SonarQube, and the rest (via `lab-home-gitops`).
- **Public access** through Cloudflare Tunnel at `*.nasraldin.com`.
- **LAN shortcuts** at `*.lab` for direct access without leaving the house.

---

## Part 1 — Prepare your laptop

### 1.1 Connect to the home network

Join the same LAN as the lab (`192.168.68.0/22`). Wi‑Fi or Ethernet both work.

### 1.2 Point DNS at the lab

Your laptop must use AdGuard on `infra-01` as its DNS server. Otherwise `*.lab`
names will not resolve.

**Option A — Router DHCP (recommended)**

1. Open the router admin UI.
2. Set DHCP **primary DNS** to `192.168.68.10`.
3. Keep `1.1.1.1` as secondary if you want a fallback.
4. Optional: set **search domain** to `lab` (then `gitlab` works without typing `.lab`).
5. Renew DHCP on the Mac:

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Option B — Manual DNS on the Mac**

System Settings → Network → your interface → DNS → add `192.168.68.10`.

To restore automatic DNS later, remove the manual server in System Settings → Network → DNS.

### 1.3 Verify DNS

```bash
# Short LAN name → guest IP
dig gitlab.lab +short
# expect: 192.168.68.11

# Public name → Cloudflare (not the LAN IP)
dig gitlab.nasraldin.com +short
# expect: Cloudflare anycast addresses (104.x.x.x or similar)

# Infra hostname for SSH
dig gitlab-01.lab.nasraldin.com +short
# expect: 192.168.68.11
```

If `gitlab.lab` returns nothing, AdGuard is not in your resolver path. Fix DHCP
or manual DNS before continuing.

### 1.4 SSH access

Add your key once (if not already in Terraform `ssh_public_key`):

```bash
ssh nasr@192.168.68.10    # infra-01
ssh nasr@192.168.68.11    # gitlab-01
ssh root@192.168.68.18    # dockhand LXC
ssh root@192.168.68.19    # portainer LXC
```

Convenience: add entries to `~/.ssh/config` using `*.lab.nasraldin.com` hostnames.

### 1.5 Kubernetes config

See **[Laptop kubeconfig](kubeconfig.md)** for the full procedure. Quick version:

```bash
cd ~/homelab/lab-home-k8s
./scripts/fetch-kubeconfig.sh
kubectl get nodes
# expect: 4 nodes Ready
```

Context name is `home-lab`. API endpoint: `https://192.168.68.17:6443` (or
`https://kube.lab:6443` once DNS is working).

---

## Part 2 — How to open services

You have two valid ways to reach most UIs. Pick based on where you are.

| Situation                      | Use                         | Example                                |
| ------------------------------ | --------------------------- | -------------------------------------- |
| At home, quick access          | `http://*.lab`              | `http://grafana.lab`                   |
| At home or away, same bookmark | `https://*.nasraldin.com`   | `https://grafana.nasraldin.com`        |
| SSH / scripts                  | `*.lab.nasraldin.com` or IP | `ssh nasr@gitlab-01.lab.nasraldin.com` |

At home, **both** `http://gitlab.lab` and `https://gitlab.nasraldin.com` work.
The public URL goes through Cloudflare and the tunnel. The `.lab` URL goes
straight to the guest.

---

## Part 3 — Service by service

### Proxmox (hypervisor)

|            |                                                               |
| ---------- | ------------------------------------------------------------- |
| **LAN**    | `https://pve.lab:8006` or `https://192.168.68.13:8006`        |
| **Public** | `https://homelab.nasraldin.com` (Cloudflare Access OTP first) |
| **SSH**    | `ssh pve01` (if configured in `~/.ssh/config`)                |

Log in with the root password from install. Do not create VMs in the UI — Terraform owns guest lifecycle.

---

### DNS administration

| Service      | LAN URL                   | Notes                                             |
| ------------ | ------------------------- | ------------------------------------------------- |
| AdGuard Home | `http://adguard.lab:3000` | Client DNS, filtering, upstream config            |
| Technitium   | `http://dns.lab:5380`     | Authoritative zones `lab` and `lab.nasraldin.com` |

After changing DNS records in Git (`group_vars/all.yml`), apply with:

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook -i inventory/hosts.yml playbooks/infra.yml -e @secrets.yml --limit infra-01
```

---

### GitLab and registry

|                       |                                  |
| --------------------- | -------------------------------- |
| **LAN**               | `http://gitlab.lab`              |
| **Public**            | `https://gitlab.nasraldin.com`   |
| **Registry (LAN)**    | `http://registry.lab:5050`       |
| **Registry (public)** | `https://registry.nasraldin.com` |

**First login:** set the root password on the VM if you have not already:

```bash
ssh nasr@192.168.68.11
sudo gitlab-rake "gitlab:password:reset[root]"
```

**Clone a project:**

```bash
git clone https://gitlab.nasraldin.com/homelab/lab-home-k8s.git
```

Use the public URL for remotes even when you are on the LAN — CI and OAuth expect it.

**Check the static runner** on `runner-01`:

```bash
ssh nasr@192.168.68.12
sudo gitlab-runner list
```

---

### Object storage (AIStor / MinIO on infra-01)

|                      |                               |
| -------------------- | ----------------------------- |
| **Console (LAN)**    | `http://minio.lab:9001`       |
| **Console (public)** | `https://minio.nasraldin.com` |
| **S3 API (LAN)**     | `http://s3.lab:9000`          |
| **S3 API (public)**  | `https://s3.nasraldin.com`    |

GitLab and runners use the **LAN** endpoint `http://192.168.68.10:9000` internally.

Create buckets in the console for GitLab artifacts, Harbor (if needed), and backups.

---

### Secrets (Infisical on infra-01)

|         |                             |
| ------- | --------------------------- |
| **LAN** | `http://infisical.lab:8090` |

Application secrets for Kubernetes land here and are pulled by External Secrets
Operator after GitOps sync. Bootstrap the admin account on first visit.

---

### Docker utility host (docker-01)

| App                 | LAN URL              |
| ------------------- | -------------------- |
| Nginx Proxy Manager | `http://npm.lab:81`  |
| it-tools            | via NPM or direct IP |
| mailpit             | via NPM or direct IP |

NPM is optional front-door for compose apps. Most home lab services have their
own DNS names and do not need NPM routing.

---

### Container management

#### Dockhand (LXC 118)

|            |                                                        |
| ---------- | ------------------------------------------------------ |
| **LAN**    | `http://dockhand.lab`                                  |
| **Public** | `https://docker.nasraldin.com` (Cloudflare Access OTP) |

Hawser agents run on `infra-01` and `docker-01` so Dockhand can reach their
Docker sockets without opening TCP 2375.

**Register environments** (after first install):

```bash
cd ~/homelab/lab-home-k8s/ansible
./scripts/dockhand-register-environments.py
ansible-playbook -i inventory/hosts.yml playbooks/dockhand-agents.yml -e @secrets.yml
```

#### Portainer (LXC 119)

|            |                                   |
| ---------- | --------------------------------- |
| **LAN**    | `https://portainer.lab:9443`      |
| **Public** | `https://portainer.nasraldin.com` |

**First visit:** create the admin user. Then add Docker environments:

1. `infra-01` → `192.168.68.10` (or TCP if you configure it)
2. `docker-01` → `192.168.68.17`

Portainer and Dockhand overlap in scope. Use whichever fits the task; both are valid.

---

### Kubernetes platform

Check cluster health:

```bash
kubectl get nodes
kubectl -n argocd get applications
# all platform apps should be Synced / Healthy
```

#### Argo CD

|            |                              |
| ---------- | ---------------------------- |
| **LAN**    | `http://argo.lab`            |
| **Public** | `https://argo.nasraldin.com` |

**CLI login** (password from install script or secret store):

```bash
argocd login argo.nasraldin.com --grpc-web
argocd app list
```

To deploy a change: push to `lab-home-gitops`, watch Argo sync, or sync manually from the UI.

#### Local AI (LiteLLM + chat UIs)

Inference runs on **`ai-01`** (Ollama + `gemma4:12b` + 890M GPU). All UIs call
**LiteLLM** — not Ollama directly. Full detail: [ai-stack](../architecture/ai-stack.md).

| App         | LAN                          |
| ----------- | ---------------------------- |
| LiteLLM     | `http://192.168.68.108:4000` |
| LibreChat   | `http://192.168.68.105:3080` |
| AnythingLLM | `http://192.168.68.106:3001` |
| n8n         | `http://192.168.68.107`      |
| Open WebUI  | `http://192.168.68.109`      |

**Before first use:** host VFIO bound, `ai-01` up, `curl http://192.168.68.24:11434/api/tags`
shows `gemma4:12b`, LiteLLM Healthy in Argo.

#### Harbor

|            |                                |
| ---------- | ------------------------------ |
| **LAN**    | `http://harbor.lab`            |
| **Public** | `https://harbor.nasraldin.com` |

Default admin password is set during GitOps bootstrap (check Infisical or install notes).

```bash
docker login harbor.nasraldin.com
```

#### Grafana

|            |                                 |
| ---------- | ------------------------------- |
| **LAN**    | `http://grafana.lab`            |
| **Public** | `https://grafana.nasraldin.com` |

Bundled with Prometheus, Loki, Tempo, and the **OpenTelemetry Collector** in
`observability`. Send OTLP to the Collector (not Tempo):

|            |                                                              |
| ---------- | ------------------------------------------------------------ |
| In-cluster | `http://otel-collector.observability.svc.cluster.local:4318` |
| LAN        | `http://192.168.68.110:4318`                                 |

Grafana Explore → **Tempo** for traces, **Loki** for logs, **Prometheus** for metrics.
Details: [opentelemetry](../architecture/opentelemetry.md).

#### Keycloak

|            |                            |
| ---------- | -------------------------- |
| **LAN**    | `http://id.lab`            |
| **Public** | `https://id.nasraldin.com` |

Identity provider for apps that integrate with OIDC.

#### Longhorn (storage UI)

|            |                        |
| ---------- | ---------------------- |
| **LAN**    | `http://longhorn.lab`  |
| **Public** | not exposed (LAN only) |

Longhorn runs inside the cluster. The UI is exposed on Cilium LB `192.168.68.104`.
If the page does not load:

```bash
kubectl -n longhorn-system get pods
kubectl -n longhorn-system get svc longhorn-frontend
```

Wait for Argo app `platform-longhorn` to be Healthy after GitOps sync.

#### SonarQube, Verdaccio, data operators

Synced by Argo from `lab-home-gitops/platform/`. Reach them via port-forward
until you add DNS names:

```bash
kubectl -n sonarqube port-forward svc/sonarqube-sonarqube 9000:9000
```

---

## Part 4 — Typical day-to-day workflows

### Deploy a platform change

1. Edit manifests in `lab-home-gitops` (e.g. `platform/grafana/`).
2. Commit and push to GitLab.
3. Argo CD detects the change and syncs (or click **Sync** in the UI).
4. Verify: `kubectl -n observability get pods`

### Deploy an infrastructure change (VM or guest config)

1. Edit `lab-home-k8s` (Terraform or Ansible).
2. Push and run the GitLab pipeline, **or** apply locally:

```bash
cd ~/homelab/lab-home-k8s
make tf-plan                    # review
make tf-apply                   # VMs / LXC
make ansible-infra              # example: infra-01 only
```

Use `TF_TARGET_GUESTS=gitlab-01` for selective Terraform — never shrink `var.vms`.

### Run a one-off Ansible playbook

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook -i inventory/hosts.yml playbooks/portainer.yml -e @secrets.yml
```

### Check logs on a guest

```bash
ssh nasr@192.168.68.10
docker ps
docker logs <container> --tail 100
```

### Restart a compose stack (example: Portainer CT)

```bash
ssh root@192.168.68.19
cd /opt/portainer && docker compose restart
```

---

## Part 5 — Using the lab away from home

1. Connect to the internet (no VPN required for public URLs).
2. Open the same bookmarks: `https://gitlab.nasraldin.com`, `https://argo.nasraldin.com`, etc.
3. Cloudflare Tunnel carries traffic to the LAN origins.
4. `homelab.nasraldin.com` and `docker.nasraldin.com` ask for **Cloudflare Access** email OTP first.
5. `*.lab` names will **not** resolve — that is correct. Use public URLs or VPN if you add one later.

**kubectl from away:** tunnel does not expose the API by default. Options:

- SSH to a guest and run `kubectl` there.
- Use `fetch-kubeconfig.sh` with a VPN or port-forward setup you trust.
- Rely on Argo CD UI for cluster changes.

---

## Part 6 — Quick reference tables

### All `*.lab` URLs (at home)

| URL                          | Service         |
| ---------------------------- | --------------- |
| `https://pve.lab:8006`       | Proxmox         |
| `http://adguard.lab:3000`    | AdGuard         |
| `http://dns.lab:5380`        | Technitium      |
| `http://infisical.lab:8090`  | Infisical       |
| `http://gitlab.lab`          | GitLab          |
| `http://registry.lab:5050`   | GitLab registry |
| `http://minio.lab:9001`      | AIStor console  |
| `http://s3.lab:9000`         | S3 API          |
| `http://npm.lab:81`          | NPM             |
| `http://dockhand.lab`        | Dockhand        |
| `https://portainer.lab:9443` | Portainer       |
| `http://argo.lab`            | Argo CD         |
| `http://harbor.lab`          | Harbor          |
| `http://grafana.lab`         | Grafana         |
| `http://id.lab`              | Keycloak        |
| `http://longhorn.lab`        | Longhorn        |
| `https://kube.lab:6443`      | Kubernetes API  |

### All public URLs

See [public URLs](../access/public-urls.md).

### SSH hostnames

| Host                          | SSH                        |
| ----------------------------- | -------------------------- |
| `infra-01.lab.nasraldin.com`  | `ssh nasr@…`               |
| `gitlab-01.lab.nasraldin.com` | `ssh nasr@…`               |
| `k8s-cp-01.lab.nasraldin.com` | `ssh nasr@…`               |
| `dockhand.lab.nasraldin.com`  | `ssh root@…` (or IP `.18`) |
| `portainer`                   | `ssh root@192.168.68.19`   |

---

## Part 7 — Troubleshooting

### `*.lab` does not resolve

1. Confirm laptop DNS is `192.168.68.10`: `scutil --dns | head -20`
2. Query AdGuard directly: `dig @192.168.68.10 gitlab.lab +short`
3. If empty, re-run `playbooks/infra.yml` on `infra-01`.
4. Check AdGuard upstream includes `[/lab/]192.168.68.10` → Technitium.

### Public URL works away but not at home

Unusual — tunnel should work from LAN too. Check `cloudflared` on `pve01`:

```bash
ssh pve01 systemctl status cloudflared
```

### Public URL fails everywhere

1. Check Cloudflare dashboard — tunnel healthy?
2. Compare ingress with `lab-home-k8s/config/cloudflare-tunnel-ingress.example.json`.
3. Curl the LAN origin directly: `curl -v http://192.168.68.11`.

### GitLab redirects to public URL when I use `.lab`

Expected. GitLab `external_url` is `https://gitlab.nasraldin.com`. Either follow
the redirect or bookmark the public URL for Git work.

### Longhorn UI blank

1. `kubectl -n argocd get application platform-longhorn`
2. `kubectl -n longhorn-system get pods`
3. Confirm LB IP: `dig longhorn.lab +short` → `192.168.68.104`

### Kubernetes node NotReady

```bash
ssh nasr@192.168.68.17
sudo systemctl status kubelet
```

Re-run `make ansible-k8s` if needed (includes iSCSI prerequisites for Longhorn workers).

---

## Part 8 — Where configuration lives

| What you want to change           | File / repo                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Guest IPs, DNS zones, public URLs | `lab-home-k8s/ansible/inventory/group_vars/all.yml`          |
| VM / LXC sizing and VMIDs         | `lab-home-k8s/terraform/terraform.tfvars`                    |
| Tunnel ingress hostnames          | `lab-home-k8s/config/cloudflare-tunnel-ingress.example.json` |
| Platform Helm values              | `lab-home-gitops/platform/<app>/`                            |
| CI job definitions                | `pipeline-templates/`                                        |

After editing DNS or URLs in `group_vars/all.yml`, sync `config/public-urls.yml`
and re-run `playbooks/infra.yml`.

---

## Related

| Page                                                        | When to read it          |
| ----------------------------------------------------------- | ------------------------ |
| [Bring-up runbook](../runbook/bring-up.md)                  | Installing from scratch  |
| [Network and access](../architecture/network-and-access.md) | IP plan, DNS design, TLS |
| [Acceptance checklist](../runbook/acceptance.md)            | Verify a fresh install   |
| [Laptop kubeconfig](kubeconfig.md)                          | `kubectl` setup          |
| [CI pipelines](../ci/pipelines.md)                          | Pipeline variables       |
| [Topology](../architecture/topology.md)                     | Guest map and repos      |
