# Maintenance

Day-two tasks for the **home lab** guests and cluster.

| Task                    | How                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Add / resize a guest    | Terraform in `lab-home-k8s` → Ansible playbook for that guest                                                 |
| Upgrade Kubernetes      | `kubeadm upgrade` on `k8s-cp-01`, then workers — test in a snapshot first                                     |
| Rotate API / etcd certs | `kubeadm certs` on control plane; re-run `fetch-kubeconfig.sh` on laptop                                      |
| Change platform chart   | PR in `lab-home-gitops` → Argo sync                                                                           |
| OS packages on nodes    | Ansible roles (keep kube packages held)                                                                       |
| etcd disaster recovery  | [etcd backup and restore](../runbook/etcd-backup-restore.md)                                                  |
| DNS / URL changes       | `lab-home-k8s/ansible/inventory/group_vars/all.yml` → `ansible-playbook playbooks/infra.yml --limit infra-01` |
| Tunnel hostname         | `lab-home-k8s/config/cloudflare-tunnel-ingress.example.json` + Cloudflare Tunnel repo                         |

## Guest selective runs

```bash
cd ~/homelab/lab-home-k8s
make ansible-infra      # infra-01 only
make ansible-docker     # docker-01 only
make ansible-k8s        # all k8s nodes
```

CI equivalents: set `ANSIBLE_LIMIT` or `TF_TARGET_GUESTS` — see
[CI pipelines](../ci/pipelines.md).

## Resource pressure on Proxmox

If the host is overloaded during first bring-up, provision guests in startup
order before full Ansible + bootstrap:

`infra-01` → `gitlab-01` → `runner-01` → `k8s-cp-01` → workers → `docker-01` →
`dockhand` → `portainer`

See also [acceptance checklist](../runbook/acceptance.md#resource-safety).

## See also

- [Daily use guide](../guide/daily-use.md)
- [Bring-up runbook](../runbook/bring-up.md)
