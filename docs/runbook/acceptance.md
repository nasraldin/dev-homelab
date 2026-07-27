# Acceptance checklist

Use after a live bring-up on the **home lab machine** (or mark N/A for dry-run).

## Infrastructure (Ansible / Terraform)

- [ ] All **10 guests** reachable: `infra-01`, `gitlab-01`, `runner-01`, `k8s-cp-01`, `k8s-w-01..03`, `docker-01`, `dockhand`, `portainer`
- [ ] `infra-01`: AdGuard, Technitium, Infisical, AIStor healthy (`minio` + `s3` URLs after tunnel)
- [ ] `docker-01`: NPM, it-tools, mailpit containers healthy
- [ ] `dockhand` LXC UI reachable; Hawser agents on `infra-01` + `docker-01`
- [ ] `portainer` LXC UI at `https://portainer.nasraldin.com` (after tunnel)
- [ ] LAN DNS: `dig @192.168.68.10 gitlab.lab +short` → `192.168.68.11`; `http://gitlab.lab` loads
- [ ] Public still works: `https://gitlab.nasraldin.com` (Cloudflare path)
- [ ] `http://longhorn.lab` loads after GitOps sync (LB `.104`)
- [ ] GitLab CE on `gitlab-01`; static runner on `runner-01` registered

## Kubernetes (single CP)

- [ ] `kubectl get nodes` shows **4 Ready** nodes (1 CP + 3 workers)
- [ ] API via `192.168.68.13:6443` (`kubectl get --raw=/readyz` ok)
- [ ] Cilium pods healthy; LB pool + L2 policy present; Gateway API CRDs installed
- [ ] Argo CD apps Healthy/Synced for platform stack
- [ ] Grafana / Prometheus / Tempo running in `observability`
- [ ] Keycloak and SonarQube pods running (Keycloak at `https://id.nasraldin.com` after DB secrets + sync)
- [ ] etcd snapshot exists under `/var/backups/etcd` on `k8s-cp-01` — see [etcd backup and restore](etcd-backup-restore.md)
- [ ] Laptop kubeconfig in `~/.kube/config` (context `home-lab`)

## CI smoke tests

- [ ] Push change under `platform/keycloak/` only → `lab-home-gitops` pipeline runs Keycloak-scoped jobs
- [ ] Push change under `ansible/roles/infisical/` only → `lab-home-k8s` pipeline targets `infra-01`
- [ ] Re-run same pipeline on unchanged `main` → plan/check shows no-op or reconcile only

## Public URL smoke tests

See [public URLs](../access/public-urls.md).

- [ ] `https://gitlab.nasraldin.com` — GitLab sign-in (no Access)
- [ ] `https://registry.nasraldin.com/v2/` — registry reachable
- [ ] `https://argo.nasraldin.com` — Argo CD UI
- [ ] `https://harbor.nasraldin.com` — Harbor UI
- [ ] `https://grafana.nasraldin.com/login` — Grafana
- [ ] `https://id.nasraldin.com` — Keycloak
- [ ] `https://minio.nasraldin.com` — AIStor console
- [ ] `https://s3.nasraldin.com/minio/health/live` — S3 API
- [ ] `https://npm.nasraldin.com` — NPM admin
- [ ] `https://homelab.nasraldin.com` — Access OTP → Proxmox
- [ ] `https://docker.nasraldin.com` — Access OTP → Dockhand

## Automated subset

```bash
./scripts/verify.sh
# or from laptop after fetch-kubeconfig.sh:
kubectl get nodes
kubectl -n argocd get applications
```

## Resource safety

If Proxmox is overloaded during first bring-up, provision guests in startup order (infra → gitlab → runner → k8s → docker → dockhand → portainer) before running full `ansible` + `bootstrap`.
