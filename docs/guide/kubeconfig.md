# Laptop kubeconfig

Connect to the home lab API from your Mac (or any operator machine). The home
lab uses a **single control plane** — point kubeconfig at `k8s-cp-01`, not an
HAProxy VIP.

## Prerequisites

- LAN reachability to `192.168.68.0/22`
- `kubectl` installed
- SSH to `nasr@192.168.68.13` (k8s-cp-01) with your lab key
- DNS: `kube.lab` or `k8s-cp-01.lab.nasraldin.com` → `192.168.68.13`

Check before fetching config:

```bash
dig +short kube.lab
# expect: 192.168.68.13

nc -z 192.168.68.13 6443 && echo "API reachable"
```

If DNS is wrong, follow [daily guide §1.3](daily-use.md#13-verify-dns) or add a
temporary `/etc/hosts` line:

```text
192.168.68.13 kube.lab
```

## Install (one command)

From the `lab-home-k8s` repo on your Mac:

```bash
cd ~/homelab/lab-home-k8s
./scripts/fetch-kubeconfig.sh
```

This script:

1. Fetches `/etc/kubernetes/admin.conf` from `k8s-cp-01`
2. Renames cluster/user/context to `home-lab` / `home-lab-admin` / `home-lab`
3. Merges into **`~/.kube/config`**
4. Sets `home-lab` as the current context
5. Keeps a standalone copy at `~/.kube/home-lab.config`
6. Backs up an existing config to `~/.kube/config.bak`

Verify:

```bash
kubectl get nodes -o wide
kubectl get --raw=/readyz
```

Server URL in the config:

```text
https://192.168.68.13:6443
```

(or `https://kube.lab:6443` when LAN DNS is working)

## Switch contexts

```bash
kubectl config get-contexts
kubectl config use-context home-lab
```

Re-run `fetch-kubeconfig.sh` after cert rotation or cluster rebuild.

## Troubleshooting

| Symptom                                                | Likely cause             | Fix                                                                |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| `lookup kube.lab: no such host`                        | Laptop not using lab DNS | Point Mac DNS at `192.168.68.10` — see [daily guide](daily-use.md) |
| `dial tcp 192.168.68.13:6443: i/o timeout`             | Not on lab LAN           | Connect to home network; confirm `k8s-cp-01` is up                 |
| `x509: certificate is valid for ...` when using raw IP | SAN mismatch             | Use `kube.lab` or set `tls-server-name` on the cluster entry       |
| Wrong cluster by default                               | Another context selected | `kubectl config use-context home-lab`                              |

## Security

- `admin.conf` is **cluster-admin**. Keep `~/.kube/config` mode `600` and never commit it.
- Prefer a narrower ServiceAccount kubeconfig for day-2 once RBAC demos exist.

## See also

- [Daily use guide](daily-use.md)
- [Bring-up runbook](../runbook/bring-up.md)
