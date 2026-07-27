# Architecture

Full network, DNS, and access design:
[network and access](network-and-access.md)

Daily usage:
[daily guide](../guide/daily-use.md)

## What you are building

A **single control-plane** Kubernetes homelab for daily use:

- **1 control plane** with stacked etcd (`k8s-cp-01`)
- **3 workers** with Longhorn data disks (`k8s-w-01..03`)
- **No HAProxy** — API endpoint is the control-plane IP directly (`192.168.68.17:6443`)
- **Cilium** for CNI, LoadBalancer IPAM, L2 Announcements, and Gateway API
- **Argo CD** + sibling repo `lab-home-gitops` for day-2 platform apps
- In-cluster **Prometheus / Grafana / Loki / Tempo / OpenTelemetry Collector**, **Keycloak**, **SonarQube**, **Harbor**, **Verdaccio**

## Ownership

| Layer                 | Tool            | Repo                     |
| --------------------- | --------------- | ------------------------ |
| All VMs + LXC         | Terraform       | `lab-home-k8s/terraform` |
| OS + guests + kubeadm | Ansible         | `lab-home-k8s/ansible`   |
| CNI + Argo once       | Scripts         | `lab-home-k8s/scripts`   |
| Platform apps         | Argo CD         | `lab-home-gitops`        |
| CI templates          | GitLab includes | `pipeline-templates`     |

## API path

```text
kubectl / kubelet / kubeadm
  → 192.168.68.17:6443
  → k8s-cp-01 apiserver
```

## Guest inventory

| Guest           | VMID    | IP        | Role                                            |
| --------------- | ------- | --------- | ----------------------------------------------- |
| infra-01        | 110     | .10       | AdGuard, Technitium, Infisical, AIStor (Docker) |
| gitlab-01       | 111     | .11       | GitLab CE Omnibus                               |
| runner-01       | 112     | .12       | Static GitLab Runner                            |
| k8s-cp-01       | 113     | .21       | Single control plane                            |
| k8s-w-01..03    | 114–116 | .14–.16   | Workers + Longhorn data disk                    |
| docker-01       | 117     | .17       | NPM, it-tools, mailpit                          |
| dockhand (LXC)  | 118     | .18       | Dockhand UI + Hawser hub                        |
| portainer (LXC) | 119     | .19       | Portainer CE                                    |
| ai-01           | 120     | .20       | Ollama + gemma4:12b (890M GPU)                  |
| Cilium LB pool  | —       | .100–.119 | `.100`–`.110` reserved (see topology)           |

## Naming

| Layer        | Example                        |
| ------------ | ------------------------------ |
| Public       | `https://gitlab.nasraldin.com` |
| LAN shortcut | `http://gitlab.lab`            |
| Infra / SSH  | `gitlab-01.lab.nasraldin.com`  |

## North-south traffic

| Traffic                         | Owner                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| Public `*.nasraldin.com`        | Cloudflare Tunnel → LAN origins                                         |
| LAN `*.lab`                     | Technitium → direct to guest / Cilium LB                                |
| LAN into cluster                | Cilium LB `.100`–`.110` (Argo…OTel Collector) — [topology](topology.md) |
| Compose on infra-01 / docker-01 | Direct IP or `*.lab`                                                    |

## Not in this design

Practice-lab-only components are intentionally omitted: HAProxy, multi-CP kubeadm, Istio, Kyverno, Vault VMs, standalone SonarQube VM.
