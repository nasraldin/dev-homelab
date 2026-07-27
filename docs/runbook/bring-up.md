# Home lab runbook (fresh Proxmox → home cluster)

End-to-end bring-up for the **home lab machine** — separate from the
practice lab (`terraform-lab`, `ansible-lab`, `k8s-lab`, `homelab-gitops`).

Use this when `pve01` is a **new Proxmox install** with no guests yet.

| Situation                                       | Doc                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Daily use** — open services, DNS, workflows   | [daily guide](../guide/daily-use.md)                                                                        |
| **Fresh install** — empty Proxmox → running lab | **This page**                                                                                               |
| Network, DNS, access design                     | [network and access](../architecture/network-and-access.md)                                                 |
| Topology / VMID map                             | [topology](../architecture/topology.md)                                                                     |
| **Public URLs**                                 | [public URLs](../access/public-urls.md)                                                                     |
| **LAN shortcuts (`*.lab`)**                     | [LAN DNS](../access/lan-dns.md)                                                                             |
| CI variables and selective pipelines            | [CI pipelines](../ci/pipelines.md)                                                                          |
| Pass/fail gates                                 | [acceptance checklist](acceptance.md)                                                                       |
| Proxmox installer detail                        | [proxmox-bootstrap 01-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md) |
| Host bootstrap detail                           | [proxmox-bootstrap 06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md) |

**Ownership (do not mix):**

```text
proxmox-bootstrap     host only (repos, SSH, ZFS, terraform@pve token)
lab-home-k8s        all guests (Terraform) + guest OS + kubeadm (Ansible) + Cilium/Argo scripts
lab-home-gitops     in-cluster platform (Argo CD app-of-apps)
pipeline-templates    shared GitLab CI job includes
cloudflare-tunnel     public hostnames (optional, after GitLab is up)
```

---

## Goal (what “done” means)

1. `pve01` reachable: `ssh pve01` → key login, UI on `:8006`.
2. `qm list` / `pct list` = VMs **110–117** + LXC **118–119** (10 guests).
3. `infra-01` serves DNS; router DHCP points clients at `192.168.68.10`.
4. GitLab CE on `gitlab-01`; static runner on `runner-01`.
5. Single-CP Kubernetes: **4 Ready nodes** (1 CP + 3 workers); API at `192.168.68.13:6443`.
6. Argo CD syncs platform stack from `lab-home-gitops`.
7. Public URLs live at `*.nasraldin.com`; LAN shortcuts at `*.lab` (router DNS → `.10`).
8. Acceptance checklist passes (see § Acceptance).

---

## IP plan (new machine)

On this machine the **hypervisor** and **guests** use different addresses.
Do not reuse the practice-lab map where `pve01` was also `.13`.

| Role            | Host       | IP                |
| --------------- | ---------- | ----------------- |
| Proxmox `pve01` | hypervisor | `192.168.68.2/22` |
| `infra-01`      | VM 110     | `.10`             |
| `gitlab-01`     | VM 111     | `.11`             |
| `runner-01`     | VM 112     | `.12`             |
| `k8s-cp-01`     | VM 113     | `.13`             |
| `k8s-w-01..03`  | VM 114–116 | `.14–.16`         |
| `docker-01`     | VM 117     | `.17`             |
| `dockhand`      | LXC 118    | `.18`             |
| `portainer`     | LXC 119    | `.19`             |
| Cilium LB pool  | —          | `.100–.119`       |

If you pick a different hypervisor IP, update **all** of:

- Proxmox installer / `proxmox-bootstrap/config.env` → `PVE_IP`
- `lab-home-k8s/ansible/inventory/group_vars/all.yml` → `pve_ip` (Technitium `pve01` A record)

---

## Master checklist

### 0. Before the ISO (only if reinstalling)

If the installer offers **“prefix with old”** for `rpool`, wipe the target disk
from a live environment before reinstalling. See
[§0 below](#0-before-the-iso-only-if-reinstalling).

- [ ] Target NVMe identified by **model/serial**, not slot name alone
- [ ] Disk wiped if stale ZFS labels exist

---

### 1. Proxmox ISO install

| Setting              | Value                                            |
| -------------------- | ------------------------------------------------ |
| Target disk          | Primary NVMe — select by **model/serial**        |
| Filesystem           | ZFS (single disk / RAID0)                        |
| ashift / compression | `12` / `lz4`                                     |
| Swap                 | ~8 GB                                            |
| Hostname / FQDN      | `pve01` / `pve01.lab.nasraldin.com`              |
| IP                   | **`192.168.68.2/22`**, gateway `192.168.68.1`    |
| DNS (bootstrap)      | `1.1.1.1` (AdGuard `.10` comes after `infra-01`) |
| Timezone             | `Asia/Dubai`                                     |
| Root password        | Long random → password manager                   |

On the console after first boot:

```bash
pveversion
hostname -f                # pve01.lab.nasraldin.com
ip -4 addr show vmbr0      # 192.168.68.2/22
zpool status               # rpool ONLINE — one member
zpool list                 # ~1.8–2T on single-disk rpool
```

- [ ] Single-disk `rpool` verified
- [ ] Web UI: `https://192.168.68.2:8006`

**Do not create VMs in the UI.** Terraform owns guests.

---

### 2. Mac prepare + host bootstrap (`proxmox-bootstrap`)

```bash
cd ~/homelab && ./clone-labs.sh --pull
cd ~/homelab/proxmox-bootstrap
cp -n config.env.example config.env
```

Edit `config.env` for the **new machine**:

```bash
PVE_IP=192.168.68.2          # hypervisor — NOT k8s-cp-01 (.13)
PVE_FQDN=pve01.lab.nasraldin.com
PVE_GATEWAY=192.168.68.1
ADMIN_USER=nasr
NOTIFY_EMAIL=you@example.com
```

Local secrets (never commit):

| File                                             | Purpose                         |
| ------------------------------------------------ | ------------------------------- |
| `proxmox-bootstrap/config.env`                   | Host bootstrap                  |
| `lab-home-k8s/terraform/credentials.auto.tfvars` | PVE API token (after bootstrap) |
| `lab-home-k8s/ansible/secrets.yml`               | From `secrets.example.yml`      |
| `cloudflare-tunnel/config.env`                   | Tunnel (optional, later)        |

```bash
ssh-add ~/.ssh/pve01
./mac/bootstrap.sh --check
./mac/bootstrap.sh

ssh pve01 hostname -f         # key-only login

./mac/bootstrap.sh --remote --check
./mac/bootstrap.sh --remote --yes
```

When the **terraform API token** is printed once: store it and create
`lab-home-k8s/terraform/credentials.auto.tfvars`:

```hcl
proxmox_api_token = "terraform@pve!provider=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

If reboot is required:

```bash
ssh pve01 reboot
# wait, then:
./mac/bootstrap.sh --remote --check
```

- [ ] `ssh pve01` key-only works
- [ ] Token saved in password manager + `credentials.auto.tfvars`
- [ ] Router **Secondary DNS = `1.1.1.1`** until AdGuard is live

---

### 3. Prepare `lab-home-k8s` secrets and tfvars

```bash
cd ~/homelab/lab-home-k8s

cp terraform/terraform.tfvars.example terraform/terraform.tfvars
cp terraform/credentials.auto.tfvars.example terraform/credentials.auto.tfvars
# paste API token into credentials.auto.tfvars

cp ansible/secrets.example.yml ansible/secrets.yml
```

Edit `terraform/terraform.tfvars`:

- Set `ssh_public_key` to your Mac public key
- Confirm `proxmox_endpoint` → `https://pve01.lab.nasraldin.com:8006/`
- Confirm `zfs_pools.data01.device` matches the **data** NVMe by-id path on this host
- Review VM sizes (intentional oversubscription is OK on homelab hardware)

Minimum `ansible/secrets.yml` for day-one (fill all `replace-with` values):

| Key                                   | Used by                      |
| ------------------------------------- | ---------------------------- |
| `vault_adguard_admin_password`        | AdGuard on `infra-01`        |
| `vault_technitium_admin_password`     | Technitium on `infra-01`     |
| `vault_infisical_*`                   | Infisical on `infra-01`      |
| `vault_aistor_*`, `vault_gitlab_s3_*` | AIStor + GitLab object store |
| `vault_gitlab_root_password`          | GitLab CE                    |
| `vault_npm_admin_*`                   | NPM on `docker-01`           |

Public URLs (`gitlab.nasraldin.com`, `registry.nasraldin.com`, …) are set in
`ansible/inventory/group_vars/all.yml` **before** GitLab Omnibus runs — do not
change them after install without `gitlab-ctl reconfigure`.

GitLab runner tokens can stay empty — `gitlab.yml` mints them on first run.

- [ ] `terraform.tfvars` edited
- [ ] `credentials.auto.tfvars` has API token
- [ ] `secrets.yml` has no `replace-with` placeholders for day-one keys

---

### 4. Terraform — create all guests

```bash
cd ~/homelab/lab-home-k8s
ssh-add ~/.ssh/pve01

make tf-init
make tf-plan
make tf-apply
```

Verify on the node:

```bash
ssh pve01 'qm list; pct list'
```

| VMID    | Name              | IP        |
| ------- | ----------------- | --------- |
| 110     | `infra-01`        | `.10`     |
| 111     | `gitlab-01`       | `.11`     |
| 112     | `runner-01`       | `.12`     |
| 113     | `k8s-cp-01`       | `.13`     |
| 114–116 | `k8s-w-01..03`    | `.14–.16` |
| 117     | `docker-01`       | `.17`     |
| 118     | `dockhand` (LXC)  | `.18`     |
| 119     | `portainer` (LXC) | `.19`     |

Ping test from Mac (cloud-init may take a few minutes):

```bash
for ip in 10 11 12 13 14 15 16 17 18 19; do ping -c1 -W2 192.168.68.$ip; done
```

- [ ] All 8 VMs + 2 LXC present
- [ ] SSH works: `ssh nasr@192.168.68.10` (repeat for `.11`–`.17`; `root@192.168.68.18` for dockhand; `root@192.168.68.19` for portainer)

**Resource tip:** If the node is overloaded, apply guests in startup order using
selective targets:

```bash
cd terraform
TF_TARGET_GUESTS=infra-01 ../terraform/scripts/ci-run.sh
# repeat for gitlab-01, runner-01, k8s-cp-01, k8s-w-01, …
```

---

### 5. Ansible — configure guests (staged)

Full site playbook (recommended once all guests are up):

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook -i inventory/hosts.yml playbooks/site.yml -e @secrets.yml
```

Or stage by layer:

```bash
# 1) DNS + secrets + object storage on infra-01
make ansible-infra

# 2) GitLab + static runner (runner is in gitlab.yml)
make ansible-gitlab

# 3) NPM, it-tools, mailpit on docker-01
make ansible-docker

# 4) Dockhand LXC UI
ansible-playbook -i inventory/hosts.yml playbooks/dockhand.yml -e @secrets.yml

# 5) Portainer LXC UI
ansible-playbook -i inventory/hosts.yml playbooks/portainer.yml -e @secrets.yml

# 6) Kubernetes nodes (single CP + workers)
make ansible-k8s
```

**DNS cutover** (after `infra-01` AdGuard is healthy):

1. Open AdGuard UI: `http://192.168.68.10:3000`
2. On the router: set DHCP **primary DNS** → `192.168.68.10`, keep `1.1.1.1` as secondary
3. Renew DHCP on Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
4. Confirm: `dig @192.168.68.10 pve01.lab.nasraldin.com +short` → `192.168.68.2`
5. Confirm short LAN zone: `dig @192.168.68.10 gitlab.lab +short` → `192.168.68.11`
   See [LAN DNS](../access/lan-dns.md) for the full `*.lab` cheat sheet.

- [ ] AdGuard + Technitium responding on `infra-01`
- [ ] Infisical + AIStor containers healthy
- [ ] GitLab: `http://192.168.68.11` (or external URL after tunnel)
- [ ] `runner-01`: `sudo gitlab-runner list` shows registered runner
- [ ] `docker-01`: NPM `:81`, it-tools, mailpit reachable
- [ ] Router DHCP uses `192.168.68.10` as DNS

---

### 6. Dockhand Hawser agents (manual step)

Dockhand UI runs on LXC `118`. Hawser agents on `infra-01` and `docker-01`
need API tokens from Dockhand first:

```bash
cd ~/homelab/lab-home-k8s/ansible

# Register environments in Dockhand; writes files/dockhand-hawser-tokens.json
./scripts/dockhand-register-environments.py

ansible-playbook -i inventory/hosts.yml playbooks/dockhand-agents.yml -e @secrets.yml
```

- [ ] Dockhand UI at `http://192.168.68.18:3000` (or via tunnel later)
- [ ] Both Docker engines visible in Dockhand

---

### 7. Kubernetes bootstrap (Cilium + Argo CD)

From `lab-home-k8s` root (requires working DNS or `/etc/hosts` for chart pulls):

```bash
cd ~/homelab/lab-home-k8s

# Install kubeconfig on laptop (single CP — no HAProxy)
CP_HOST=nasr@192.168.68.13 \
API_DNS=192.168.68.13 \
API_VIP=192.168.68.13 \
CONTEXT_NAME=home-lab \
CLUSTER_NAME=home-lab \
./scripts/fetch-kubeconfig.sh

make bootstrap    # install-cilium.sh + install-argocd.sh
make verify
```

`install-argocd.sh` reads `GITOPS_REPO` (default: your GitLab `lab-home-gitops`
URL). Set `GITOPS_TOKEN` or use `gh auth token` if the repo is private.

- [ ] `kubectl get nodes` → 4 Ready
- [ ] `kubectl -n kube-system get pods -l app.kubernetes.io/name=cilium`
- [ ] Argo CD server running in `argocd` namespace
- [ ] `make verify` exits 0

---

### 8. GitLab — push repos and wire CI

On `https://gitlab.nasraldin.com`, create three projects under group `homelab`:

| Project                      | Source directory               |
| ---------------------------- | ------------------------------ |
| `homelab/pipeline-templates` | `~/homelab/pipeline-templates` |
| `homelab/lab-home-k8s`       | `~/homelab/lab-home-k8s`       |
| `homelab/lab-home-gitops`    | `~/homelab/lab-home-gitops`    |

Push order:

```bash
# 1) Templates first (consumers include from here)
cd ~/homelab/pipeline-templates && git push gitlab main

# 2) Infra repo
cd ~/homelab/lab-home-k8s && git push gitlab main

# 3) GitOps repo
cd ~/homelab/lab-home-gitops && git push gitlab main
```

Repo URLs in manifests already point at `https://gitlab.nasraldin.com/homelab/…`.
Update `include: project:` in `.gitlab-ci.yml` only if your GitLab group path differs.

Register CI/CD variables on each consumer project (GitLab → Settings → CI/CD):

| Variable                   | Projects     | Notes                    |
| -------------------------- | ------------ | ------------------------ |
| `TF_VAR_proxmox_api_token` | lab-home-k8s | masked                   |
| `SSH_PRIVATE_KEY`          | lab-home-k8s | File var                 |
| `ANSIBLE_SECRETS_YML`      | lab-home-k8s | File var → `secrets.yml` |

- [ ] All three repos on GitLab
- [ ] `pipeline-templates` lint pipeline green
- [ ] Runner on `runner-01` picks up jobs (`vm-fallback` tag if configured)

---

### 9. Infisical — seed secrets (before platform apps need them)

Infisical runs on `infra-01:8090`. Complete first-admin signup in the UI once,
then create a **machine identity** (`k8s-lab-home`) with Universal Auth and
grant it read on projects `kubernetes` and `apps`.

```bash
cd ~/homelab/lab-home-k8s/ansible

# Creates projects infra / pipelines / kubernetes / apps + upserts from secrets.yml
export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=...
export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=...
ansible-playbook playbooks/infisical-seed.yml -e @secrets.yml
```

Apply the operator credentials (never commit these):

```bash
kubectl -n infisical-operator-system create secret generic infisical-universal-auth \
  --from-literal=clientId="$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" \
  --from-literal=clientSecret="$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET"
```

Details: [Secrets and Infisical](../architecture/secrets-and-infisical.md).

- [ ] Infisical UI reachable; org + admin exist
- [ ] Seed playbook upserted required keys
- [ ] Machine-identity Secret present in `infisical-operator-system`

---

### 10. GitOps — sync platform stack

After Argo CD is installed and the root app points at `lab-home-gitops`:

```bash
kubectl -n argocd get applications
kubectl -n argocd get applications -o wide
```

Argo syncs in waves (cert-manager → metrics-server → ESO → Infisical operator →
Kyverno + policies → KEDA → Longhorn → data → Keycloak / Sonar / Harbor →
observability → gitlab-runner).

In-cluster secrets (`keycloak-db`, `keycloak-admin`, `sonarqube-db`,
`grafana-admin`, …) come from **InfisicalSecret** CRs — do not hand-create
them once seed + machine identity are done.

Harbor admin password: after seed, set once from Infisical
(`kubernetes` / `harbor` / `HARBOR_ADMIN_PASSWORD`) via
`argocd app set harbor -p harborAdminPassword=...` (not stored in Git).

- [ ] Platform Applications → `Healthy` / `Synced` (Loki may lag on PVC bind)
- [ ] InfisicalSecret objects report Ready; target Secrets exist
- [ ] Kyverno ClusterPolicies present (`validationFailureAction: Audit`)
- [ ] `kubectl -n observability get pods`
- [ ] Longhorn UI or `kubectl -n longhorn-system get pods`

---

### 11. Cloudflare Tunnel — public URLs

After GitLab and core services are LAN-stable, wire the tunnel using the
checked-in ingress template:

```bash
# Reference: lab-home-k8s/config/cloudflare-tunnel-ingress.example.json
cd ~/homelab/cloudflare-tunnel
cp config.env.example config.env   # PVE_IP=192.168.68.2 on new machine
export CLOUDFLARE_API_TOKEN='...'
./mac/bootstrap.sh --check
./mac/bootstrap.sh --yes
```

Merge ingress hostnames from
`lab-home-k8s/config/cloudflare-tunnel-ingress.example.json`:

| Hostname                 | Origin                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `homelab.nasraldin.com`  | Proxmox `:8006` on connector host (**Access**)             |
| `gitlab.nasraldin.com`   | `http://192.168.68.11:80`                                  |
| `registry.nasraldin.com` | `http://192.168.68.11:5050`                                |
| `docker.nasraldin.com`   | `http://192.168.68.18:3000` (**Access**)                   |
| `argo.nasraldin.com`     | `http://192.168.68.100:80`                                 |
| `harbor.nasraldin.com`   | `http://192.168.68.101:80`                                 |
| `grafana.nasraldin.com`  | `http://192.168.68.102:80`                                 |
| `id.nasraldin.com`       | `http://192.168.68.103:80`                                 |
| `minio.nasraldin.com`    | `http://192.168.68.10:9001` (AIStor console on `infra-01`) |
| `s3.nasraldin.com`       | `http://192.168.68.10:9000` (AIStor S3 API on `infra-01`)  |
| `npm.nasraldin.com`      | `http://192.168.68.17:81`                                  |

Full table: [public URLs](../access/public-urls.md).

- [ ] `https://gitlab.nasraldin.com` — GitLab sign-in (no Access)
- [ ] `https://registry.nasraldin.com/v2/` — registry API
- [ ] `https://homelab.nasraldin.com` — Access OTP → Proxmox
- [ ] `https://docker.nasraldin.com` — Access OTP → Dockhand
- [ ] `https://argo.nasraldin.com` — Argo CD (after bootstrap + LB bind)
- [ ] `https://harbor.nasraldin.com` / `https://grafana.nasraldin.com` / `https://id.nasraldin.com` / `https://minio.nasraldin.com` / `https://s3.nasraldin.com` — after infra / GitOps sync

---

### 11. In-cluster GitLab runner + KEDA

The `platform-gitlab-runner` Application deploys the Helm chart; KEDA
`ScaledObject` is in `platform/gitlab-runner/scaledobject.yaml`.

1. Create runner registration token in GitLab (admin → CI/CD → Runners)
2. Store as Secret `gitlab-runner-token` in namespace `gitlab-runner`
3. Confirm ScaledObject scales runners when jobs are queued

- [ ] K8s runner registers in GitLab UI
- [ ] Test pipeline on `lab-home-gitops` uses in-cluster runner

---

## Acceptance

Run the full checklist:
[acceptance checklist](acceptance.md)

Quick automated subset:

```bash
cd ~/homelab/lab-home-k8s
make verify
kubectl get nodes
kubectl -n argocd get applications
```

CI smoke tests (after §8):

- Push a change under `platform/keycloak/` only → scoped gitops pipeline
- Push a change under `ansible/roles/infisical/` only → `infra-01` targeted pipeline
- Re-run pipeline on unchanged `main` → plan/check no-op

---

## Selective re-runs (day-2)

| Task                             | Command                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Re-apply one VM (Terraform)      | `TF_TARGET_GUESTS=infra-01` in CI or `terraform/scripts/ci-run.sh` |
| Re-configure one guest (Ansible) | `make ansible-infra` / `make ansible-docker` / `make ansible-k8s`  |
| Re-sync one Argo app             | `argocd app sync platform-keycloak`                                |
| Fetch kubeconfig again           | `CONTEXT_NAME=home-lab ./scripts/fetch-kubeconfig.sh`              |

See [CI pipelines](../ci/pipelines.md) for the full variable contract.

---

## Troubleshooting

| Symptom                      | Likely cause                  | Fix                                                            |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `terraform apply` SSH errors | Agent not loaded              | `ssh-add ~/.ssh/pve01`                                         |
| Guests not pingable          | cloud-init still running      | Wait 2–5 min; check `qm guest cmd` / serial console            |
| `kubeadm join` DNS failures  | Public DNS search domain      | `k8s_common` role pins resolv.conf — re-run `make ansible-k8s` |
| Helm / Argo chart pull fails | No outbound DNS on nodes      | Fix AdGuard upstreams; test `dig github.com @192.168.68.10`    |
| Argo repo auth error         | Missing Git cred Secret       | Re-run `install-argocd.sh` with `GITOPS_TOKEN`                 |
| Longhorn volumes pending     | Workers missing `iscsid`      | Re-run `make ansible-k8s` (iscsi role in worker play)          |
| Proxmox overloaded           | Too many VMs starting at once | Stop workers `114–116`; staged `TF_TARGET_GUESTS` apply        |

---

## Related docs

- [Topology](../architecture/topology.md)
- [CI pipelines](../ci/pipelines.md)
- [lab-home-k8s README](https://github.com/nasraldin/lab-home-k8s)
- [lab-home-gitops README](https://github.com/nasraldin/lab-home-gitops)
