# GPU passthrough (Radeon 890M → `ai-01`)

Host prep so the **Radeon 890M** iGPU on `pve01` can be passed into the AI guest
(`ai-01`). AMD XDNA **NPU cannot** use VFIO on Proxmox 9 — GPU only.

**Owners**

| Piece                                  | Where                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| Host `iommu=pt`                        | [`proxmox-bootstrap`](https://github.com/nasraldin/proxmox-bootstrap) |
| PCI mapping + VM `hostpci` + hugepages | [`lab-home-k8s`](https://github.com/nasraldin/lab-home-k8s) Terraform |
| Stack overview                         | [ai-stack](ai-stack.md)                                               |

Official: [Proxmox PCI(e) Passthrough](<https://pve.proxmox.com/wiki/PCI(e)_Passthrough>).

---

## Hardware

| Piece | Detail                                                                |
| ----- | --------------------------------------------------------------------- |
| CPU   | AMD Ryzen AI 9 HX 470 (AMD-Vi)                                        |
| GPU   | Radeon 880M / 890M — `c6:00.0` **`[1002:150e]`** · IOMMU group **22** |
| Guest | `ai-01` VMID **120** · `192.168.68.20`                                |

Passing the iGPU means the **host loses `amdgpu`** while the guest owns it.
Keep SSH to `pve01` working (no local GUI dependency).

---

## Host: IOMMU

AMD IOMMU is on by default. For passthrough DMA use **`iommu=pt`** (not
`amd_iommu=on` — that is a noop / wrong guidance).

```bash
ssh pve01 'cat /proc/cmdline'   # must include iommu=pt
ssh pve01 'dmesg | grep -F AMD-Vi | head'
ssh pve01 'lspci -nnk -s c6:00.0'
```

Bootstrap: `proxmox-bootstrap` with `PVE_IOMMU=1`.

---

## Host: VFIO before first `ai-01` start

```bash
# Modules across reboot
ssh pve01 'grep -E "^(vfio|vfio_iommu_type1|vfio_pci)$" /etc/modules || \
  printf "%s\n" vfio vfio_iommu_type1 vfio_pci | tee -a /etc/modules'

# Bind GPU to vfio-pci (host loses amdgpu)
ssh pve01 'cat >/etc/modprobe.d/vfio-amd-igpu.conf <<EOF
options vfio-pci ids=1002:150e
blacklist amdgpu
EOF
update-initramfs -u -k all'

# reboot pve01, then:
ssh pve01 'lspci -nnk -s c6:00.0'   # Kernel driver in use: vfio-pci
```

Until you need the AI VM, **skip** blacklisting so the host can keep `amdgpu`.

---

## Terraform (guest)

`lab-home-k8s` creates:

1. Hardware mapping `ai-igpu` (`id` + `path` + `iommu_group`) — required with API-token auth
2. VM `ai-01` with `hostpci` → that mapping, `pcie=true`
3. **Hugepages `"2"`** (2 MiB) + **NUMA** + ballooning off — see [ai-stack](ai-stack.md)

```bash
cd lab-home-k8s
make tf-plan   # expect mapping + ai-01 (or update in place)
make tf-apply
```

If hugepages apply fails on permissions, use **root@pam** for that change (bpg
documents hugepages as root-restricted).

---

## Guest: Ollama

```bash
# On ai-01
curl -fsSL https://ollama.com/install.sh | sh
# systemd/env: OLLAMA_HOST=0.0.0.0:11434
ollama pull gemma4:12b
curl http://127.0.0.1:11434/api/tags
```

From a worker / laptop on LAN:

```bash
curl http://192.168.68.20:11434/api/tags
```

Then sync LiteLLM + UIs ([ai-stack](ai-stack.md)).

---

## Detach / return GPU to host

1. Stop `ai-01`; remove `hostpci` / mapping in Terraform (or leave VM stopped)
2. Remove `/etc/modprobe.d/vfio-amd-igpu.conf`, `update-initramfs -u -k all`, reboot
3. Confirm `lspci -nnk -s c6:00.0` shows `amdgpu` again

---

## Do not

| Anti-pattern                           | Why                      |
| -------------------------------------- | ------------------------ |
| `amd_iommu=on`                         | Noop on AMD              |
| Pass NPU via `hostpci`                 | XDNA has no VFIO path    |
| Ollama in-cluster + GPU on a worker    | Prefer dedicated `ai-01` |
| Point UIs at Ollama when LiteLLM is up | Use the gateway          |

---

## Related

- [ai-stack](ai-stack.md) — LiteLLM + client LBs
- [topology](topology.md) — guest map
- Practice-lab notes (same GPU class): curriculum [gpu-passthrough](https://nasraldin.github.io/homelab/architecture/gpu-passthrough)
