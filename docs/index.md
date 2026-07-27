---
layout: home
hero:
  name: Dev Homelab
  text: Daily-use Kubernetes on dedicated hardware.
  tagline: Isolated from the practice-lab curriculum — one Proxmox host, single control plane, GitOps platform stack, and LAN shortcuts at *.lab.
  actions:
    - theme: brand
      text: Daily use guide
      link: /guide/daily-use
    - theme: alt
      text: Bring up from scratch
      link: /runbook/bring-up
---

## What this lab is

A **second** homelab on its own Proxmox machine (`pve01`). It shares patterns
with the main [homelab curriculum](https://nasraldin.github.io/homelab/) but
has its own repos, guest map, DNS zones, and documentation.

| Layer                         | Repo                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| VMs, LXC, kubeadm, bootstrap  | [lab-home-k8s](https://github.com/nasraldin/lab-home-k8s)             |
| In-cluster platform (Argo CD) | [lab-home-gitops](https://github.com/nasraldin/lab-home-gitops)       |
| GitLab CI templates           | [pipeline-templates](https://github.com/nasraldin/pipeline-templates) |

## Suggested reading order

| Step | Page                                                   | What you get                         |
| ---- | ------------------------------------------------------ | ------------------------------------ |
| 1    | [Daily use guide](/guide/daily-use)                    | Laptop DNS, URLs, everyday workflows |
| 2    | [Laptop kubeconfig](/guide/kubeconfig)                 | `kubectl` from your Mac              |
| 3    | [Topology](/architecture/topology)                     | Guest VMIDs, IPs, deploy order       |
| 4    | [Network and access](/architecture/network-and-access) | DNS layers, TLS, traffic paths       |
| 5    | [Bring-up runbook](/runbook/bring-up)                  | Fresh Proxmox → running cluster      |
| 6    | [Acceptance checklist](/runbook/acceptance)            | Pass/fail gates after install        |

## Quick links

- [Public URLs](/access/public-urls) — `*.nasraldin.com`
- [LAN DNS (`*.lab`)](/access/lan-dns) — shortcuts at home
- [Maintenance](/operations/maintenance) — upgrades, selective Ansible, DR pointers
- [etcd backup and restore](/runbook/etcd-backup-restore) — snapshot and restore drill
