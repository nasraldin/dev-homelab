# etcd backup and restore

Single control-plane home lab (`k8s-cp-01` at `192.168.68.13`).

## Automatic backups

Ansible installs `/usr/local/sbin/k8s-etcd-backup.sh` and
`/etc/cron.d/k8s-etcd-backup` on the control plane. Snapshots land in
`/var/backups/etcd/` with retention (default 7 days).

Manual run on `k8s-cp-01`:

```bash
ssh nasr@192.168.68.13
sudo /usr/local/sbin/k8s-etcd-backup.sh
```

Optional later: sync `.db` files to AIStor on `infra-01`.

## Verify backup exists

```bash
ssh nasr@192.168.68.13 'sudo ls -lt /var/backups/etcd | head'
```

## Restore drill (practice)

Use **`etcdutl snapshot restore`** (not deprecated `etcdctl backup`).

High-level:

1. Pick a snapshot file from `/var/backups/etcd/`
2. Stop API server / etcd static pods on `k8s-cp-01` (move manifests out of
   `/etc/kubernetes/manifests`)
3. Run `scripts/etcd-restore.sh /path/to/snapshot.db` from `lab-home-k8s` on the
   node (writes a restore data dir)
4. Replace `/var/lib/etcd` per single-member topology
5. Restore manifests and wait for etcd + apiserver to come up

With only one control plane, restore is simpler than a multi-member HA cluster —
but rehearse on a disposable snapshot before you need it in production.

Helper script (run on the CP node):

```bash
sudo ./scripts/etcd-restore.sh /var/backups/etcd/etcd-YYYYMMDD-HHMMSS.db
```

The script writes to `/var/lib/etcd-restore` by default. Move data into
`/var/lib/etcd` only after stopping etcd and following your rehearsed steps.

## See also

- [Acceptance checklist](acceptance.md) — etcd snapshot gate
- [Maintenance](../operations/maintenance.md)
