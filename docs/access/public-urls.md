# Public URLs — home lab

Canonical public hostnames for the home lab. TLS terminates at
**Cloudflare**; origins speak HTTP on the LAN.

**At home you can also use `*.lab`** (e.g. `http://gitlab.lab`) — see
[LAN DNS](lan-dns.md) and the [daily guide](../guide/daily-use.md).
Public and LAN names work on the same laptop; they do not conflict.

**Source of truth:** `lab-home-k8s/ansible/inventory/group_vars/all.yml` and
`lab-home-k8s/config/public-urls.yml`.

## Public hostnames

| URL                               | Service                   | LAN origin                                             | Cloudflare Access       |
| --------------------------------- | ------------------------- | ------------------------------------------------------ | ----------------------- |
| `https://homelab.nasraldin.com`   | Proxmox UI                | `https://127.0.0.1:8006` (tunnel connector on `pve01`) | **Yes** — email OTP     |
| `https://gitlab.nasraldin.com`    | GitLab CE                 | `http://192.168.68.11:80`                              | No — GitLab login       |
| `https://registry.nasraldin.com`  | GitLab Container Registry | `http://192.168.68.11:5050`                            | No — GitLab credentials |
| `https://argo.nasraldin.com`      | Argo CD                   | `http://192.168.68.100:80` (Cilium LB)                 | No — Argo login         |
| `https://harbor.nasraldin.com`    | Harbor registry           | `http://192.168.68.101:80` (Cilium LB)                 | No — Harbor login       |
| `https://grafana.nasraldin.com`   | Grafana                   | `http://192.168.68.102:80` (Cilium LB)                 | No — Grafana login      |
| `https://id.nasraldin.com`        | Keycloak (IdP)            | `http://192.168.68.103:80` (Cilium LB)                 | No — Keycloak login     |
| `https://minio.nasraldin.com`     | AIStor console            | `http://192.168.68.10:9001` (`infra-01`)               | No — MinIO login        |
| `https://s3.nasraldin.com`        | AIStor S3 API             | `http://192.168.68.10:9000` (`infra-01`)               | No — S3 credentials     |
| `https://npm.nasraldin.com`       | NPM admin UI              | `http://192.168.68.17:81`                              | No — NPM login          |
| `https://portainer.nasraldin.com` | Portainer CE              | `https://192.168.68.19:9443` (LXC 119)                 | No — Portainer login    |
| `https://docker.nasraldin.com`    | Dockhand                  | `http://192.168.68.18:3000`                            | **Yes** — email OTP     |

Internal LAN names (`*.lab.nasraldin.com`) are in Technitium on `infra-01`
— e.g. `argo.lab.nasraldin.com` → `192.168.68.100`, `minio.lab.nasraldin.com` → `192.168.68.10`.

**Short LAN names** (`*.lab`) — e.g. `http://gitlab.lab`, `http://longhorn.lab` — see
[LAN DNS](lan-dns.md). Public `*.nasraldin.com` URLs still
resolve via Cloudflare on the same laptop.

## Cloudflare Tunnel

Copy ingress from
[`lab-home-k8s/config/cloudflare-tunnel-ingress.example.json`](https://github.com/nasraldin/lab-home-k8s/blob/main/config/cloudflare-tunnel-ingress.example.json)
into the `cloudflare-tunnel` repo when running tunnel bootstrap.

DNS: proxied CNAME for each hostname → `<tunnel-id>.cfargotunnel.com`.

Access apps (OTP):

- `homelab.nasraldin.com` — Proxmox UI
- `docker.nasraldin.com` — Dockhand

GitLab, registry, Argo, Harbor, Grafana, Keycloak (`id`), MinIO, S3, NPM, and Portainer use **application login only**
(no Cloudflare Access interstitial).

## Cilium LoadBalancer reservations

| IP               | Service                       |
| ---------------- | ----------------------------- |
| `192.168.68.100` | Argo CD server                |
| `192.168.68.101` | Harbor                        |
| `192.168.68.102` | Grafana                       |
| `192.168.68.103` | Keycloak (`id.nasraldin.com`) |
| `192.168.68.104` | Longhorn UI (`longhorn.lab`)  |

Pool: `192.168.68.100–119` (`lab-pool`).

**AIStor on `infra-01`:** public console at `minio.nasraldin.com` (`:9001`), public S3 API at
`s3.nasraldin.com` (`:9000`). GitLab object store and runner cache keep using LAN
`http://192.168.68.10:9000` for lower latency.

## First-time wiring

1. **Before `ansible-playbook gitlab.yml`** — `group_vars/all.yml` already sets
   `gitlab_external_url` and `gitlab_registry_external_url` so Omnibus never
   requests Let's Encrypt.
2. **After `infra.yml`** — Technitium creates `lab.nasraldin.com` records
   including `argo`, `harbor`, `grafana`, `id`, `minio`, `s3`, `kube-api`. AIStor sets
   `MINIO_SERVER_URL=https://s3.nasraldin.com` and
   `MINIO_BROWSER_REDIRECT_URL=https://minio.nasraldin.com`.
3. **After `make bootstrap`** — Argo CD binds `192.168.68.100` with
   `url: https://argo.nasraldin.com`.
4. **After GitOps sync** — Harbor (`.101`), Grafana (`.102`), and Keycloak (`.103`) claim LB IPs.
5. **Tunnel bootstrap** — apply ingress JSON + Access apps for homelab/docker.

## Verify (off-LAN)

```bash
curl -fsS -o /dev/null -w 'gitlab:%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in
curl -fsS -o /dev/null -w 'registry:%{http_code}\n' https://registry.nasraldin.com/v2/
curl -fsS -o /dev/null -w 'argo:%{http_code}\n' https://argo.nasraldin.com
curl -fsS -o /dev/null -w 'harbor:%{http_code}\n' https://harbor.nasraldin.com
curl -fsS -o /dev/null -w 'grafana:%{http_code}\n' https://grafana.nasraldin.com/login
curl -fsS -o /dev/null -w 'keycloak:%{http_code}\n' https://id.nasraldin.com
curl -fsS -o /dev/null -w 'minio:%{http_code}\n' https://minio.nasraldin.com
curl -fsS -o /dev/null -w 's3:%{http_code}\n' https://s3.nasraldin.com/minio/health/live
curl -fsS -o /dev/null -w 'npm:%{http_code}\n' https://npm.nasraldin.com
curl -fsS -o /dev/null -w 'portainer:%{http_code}\n' https://portainer.nasraldin.com
curl -fsS -I https://homelab.nasraldin.com | head -5    # Access redirect
curl -fsS -I https://docker.nasraldin.com | head -5     # Access redirect
```

## Related

- [Daily guide](../guide/daily-use.md)
- [Network and access](../architecture/network-and-access.md)
- [Bring-up runbook](../runbook/bring-up.md)
- [Topology](../architecture/topology.md)
