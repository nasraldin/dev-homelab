# Home lab topology

Daily-use homelab on a **new machine** — separate from the practice lab
(`k8s-lab`, `terraform-lab`, `ansible-lab`, `homelab-gitops`).

**Start here for daily use:** [daily guide](../guide/daily-use.md)  
**Network, DNS, and access design:** [network and access](network-and-access.md)  
**Fresh install:** [bring-up runbook](../runbook/bring-up.md)

---

## Repositories

| Repo                                                                    | Purpose                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`lab-home-k8s`](https://github.com/nasraldin/lab-home-k8s)             | Terraform, Ansible, bootstrap scripts — infra + Kubernetes on one home host |
| [`lab-home-gitops`](https://github.com/nasraldin/lab-home-gitops)       | Argo CD app-of-apps for the home cluster                                    |
| [`pipeline-templates`](https://github.com/nasraldin/pipeline-templates) | Shared GitLab CI job templates                                              |

GitLab paths: `homelab/lab-home-k8s`, `homelab/lab-home-gitops`.

Shared bootstrap:

- [`proxmox-bootstrap`](https://github.com/nasraldin/proxmox-bootstrap) — Proxmox host day-1
- [`cloudflare-tunnel`](https://github.com/nasraldin/cloudflare-tunnel) — remote access at `*.nasraldin.com`

---

## Guest layout

| VMID    | Host              | IP             | Role                                   |
| ------- | ----------------- | -------------- | -------------------------------------- |
| —       | `pve01`           | `192.168.68.2` | Proxmox hypervisor                     |
| 110     | `infra-01`        | `.10`          | AdGuard, Technitium, Infisical, AIStor |
| 111     | `gitlab-01`       | `.11`          | GitLab CE                              |
| 112     | `runner-01`       | `.12`          | Static GitLab Runner                   |
| 113     | `k8s-cp-01`       | `.13`          | Single control plane                   |
| 114–116 | `k8s-w-01..03`    | `.14–.16`      | Workers + Longhorn data disks          |
| 117     | `docker-01`       | `.17`          | NPM, it-tools, mailpit                 |
| 118     | `dockhand` (LXC)  | `.18`          | Dockhand + Hawser hub                  |
| 119     | `portainer` (LXC) | `.19`          | Portainer CE                           |
| 120     | `ai-01`           | `.20`          | Ollama + **gemma4:12b** (890M GPU PT)  |

**Cilium LoadBalancer pool:** `192.168.68.100–119`  
(Reservations: `.100` Argo, `.101` Harbor, `.102` Grafana, `.103` Keycloak,
`.104` Longhorn, `.105` LibreChat, `.106` AnythingLLM, `.107` n8n,
`.108` LiteLLM, `.109` Open WebUI, `.110` OpenTelemetry Collector)

AI inference and chat UIs: [ai-stack](ai-stack.md) · host GPU: [gpu-passthrough](gpu-passthrough.md).  
OTLP: [opentelemetry](opentelemetry.md).

---

## Naming (three layers)

| Layer     | Example                        | Purpose                                   |
| --------- | ------------------------------ | ----------------------------------------- |
| Public    | `https://gitlab.nasraldin.com` | Bookmarks, off-LAN, GitLab `external_url` |
| Short LAN | `http://gitlab.lab`            | Fast access at home                       |
| Infra     | `gitlab-01.lab.nasraldin.com`  | SSH, Ansible                              |

Details: [network and access](network-and-access.md).

---

## Service placement

| Service                                          | Where                                                        |
| ------------------------------------------------ | ------------------------------------------------------------ |
| DNS (AdGuard + Technitium)                       | `infra-01`                                                   |
| Secrets (Infisical), object storage (AIStor)     | `infra-01` Docker                                            |
| GitLab CE + registry                             | `gitlab-01`                                                  |
| Static GitLab Runner                             | `runner-01`                                                  |
| NPM, it-tools, mailpit                           | `docker-01` Docker                                           |
| Dockhand UI + Hawser hub                         | LXC 118; agents on `infra-01` + `docker-01`                  |
| Portainer CE                                     | LXC 119                                                      |
| Kubernetes control plane + workers               | `k8s-cp-01`, `k8s-w-01..03`                                  |
| Keycloak, SonarQube, Harbor, Verdaccio           | In cluster (GitOps)                                          |
| Observability (Prometheus, Grafana, Loki, Tempo) | In cluster (GitOps)                                          |
| **OpenTelemetry Collector**                      | In cluster — OTLP `.110` · [opentelemetry](opentelemetry.md) |
| Longhorn storage                                 | In cluster; UI at `http://longhorn.lab`                      |
| GitLab k8s runner + KEDA                         | In cluster (GitOps)                                          |
| **Ollama** (`gemma4:12b`)                        | **`ai-01`** GPU VM — [ai-stack](ai-stack.md)                 |
| **LiteLLM** gateway                              | In cluster → Ollama only                                     |
| LibreChat / AnythingLLM / n8n / Open WebUI       | In cluster → **LiteLLM** (not Ollama direct)                 |

---

## Kubernetes design

- **Single CP** kubeadm — no HAProxy, no multi-control-plane join
- API endpoint: `192.168.68.13:6443` (`https://kube.lab:6443` on LAN)
- Cilium for CNI, LoadBalancer IPAM, L2 announcements, Gateway API
- Argo CD root app → `lab-home-gitops/clusters/single`
- **Not included:** Istio, Kyverno (practice lab only)

---

## Deploy sequence

```text
1. proxmox-bootstrap/bootstrap.sh
2. lab-home-k8s: make tf-apply
3. lab-home-k8s: make ansible
4. lab-home-k8s: make bootstrap
5. lab-home-gitops: push → Argo sync
6. cloudflare-tunnel (public *.nasraldin.com)
7. Router DHCP DNS → 192.168.68.10 (enables *.lab on LAN)
8. Register runner tokens; push repos to GitLab; wire CI includes
```

---

## Documentation map

| Page                                             | Contents                               |
| ------------------------------------------------ | -------------------------------------- |
| [Daily guide](../guide/daily-use.md)             | How to use every service, step by step |
| [Network and access](network-and-access.md)      | IP plan, DNS, TLS, traffic paths       |
| [AI stack](ai-stack.md)                          | Ollama, LiteLLM, chat UIs, hugepages   |
| [OpenTelemetry](opentelemetry.md)                | OTLP Collector → Tempo / Prom / Loki   |
| [GPU passthrough](gpu-passthrough.md)            | VFIO / 890M → `ai-01`                  |
| [Bring-up runbook](../runbook/bring-up.md)       | Fresh Proxmox → running lab            |
| [Public URLs](../access/public-urls.md)          | `*.nasraldin.com` hostnames            |
| [LAN DNS](../access/lan-dns.md)                  | `*.lab` quick reference                |
| [CI](../ci/pipelines.md)                         | GitLab pipeline variables              |
| [Acceptance checklist](../runbook/acceptance.md) | Pass/fail gates                        |
