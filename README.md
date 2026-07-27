# dev-homelab

[![Docs](https://github.com/nasraldin/dev-homelab/actions/workflows/docs.yml/badge.svg)](https://github.com/nasraldin/dev-homelab/actions/workflows/docs.yml)

Standalone documentation for the **Dev Homelab** — a separate physical Proxmox
machine with its own Kubernetes cluster, GitOps repo, and guest layout. This is
not the practice-lab curriculum documented in [homelab](https://github.com/nasraldin/homelab).

## Published site

https://nasraldin.github.io/dev-homelab/

## Local preview

```bash
pnpm install
pnpm run docs:dev
```

## Site structure

```
docs/
  guide/           daily use, laptop kubeconfig
  architecture/    topology, network, kubernetes design
  runbook/         bring-up, acceptance, etcd backup/restore
  operations/      maintenance
  access/          public URLs, LAN DNS (*.lab)
  ci/              GitLab pipelines
```

Automation repos (`lab-home-k8s`, `lab-home-gitops`) contain **no** `docs/` folder — all prose lives here.

## Related repos

| Repo                                                                  | Role                                  |
| --------------------------------------------------------------------- | ------------------------------------- |
| [lab-home-k8s](https://github.com/nasraldin/lab-home-k8s)             | Terraform, Ansible, bootstrap scripts |
| [lab-home-gitops](https://github.com/nasraldin/lab-home-gitops)       | Argo CD platform manifests            |
| [pipeline-templates](https://github.com/nasraldin/pipeline-templates) | Shared GitLab CI jobs                 |

## GitHub Pages URL

Project Pages URLs use the **repository name**. This repo must be named `dev-homelab`
on GitHub so the site is served at `https://nasraldin.github.io/dev-homelab/`
(VitePress `base: '/dev-homelab/'` in `docs/.vitepress/config.mts`).
