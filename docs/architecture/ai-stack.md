# AI stack — Ollama, LiteLLM, and chat UIs

Local LLM inference on a dedicated GPU VM; chat/RAG/workflow apps in Kubernetes
talk to **LiteLLM** (OpenAI-compatible gateway). Only LiteLLM calls Ollama.

**Owners**

| Piece                                | Repo / path                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `ai-01` VM + PCI mapping + hugepages | [`lab-home-k8s`](https://github.com/nasraldin/lab-home-k8s) Terraform  |
| Host VFIO / IOMMU                    | [gpu-passthrough](gpu-passthrough.md) · `proxmox-bootstrap`            |
| LiteLLM + UIs                        | [`lab-home-gitops/apps`](https://github.com/nasraldin/lab-home-gitops) |

---

## Architecture

```text
LibreChat (.105) ─┐
AnythingLLM (.106)┤
n8n (.107)        ├─► LiteLLM (.108 :4000) ─► Ollama on ai-01 (.20 :11434)
Open WebUI (.109)─┘         │                      gemma4:12b
                            │
                   OpenAI-compatible /v1
```

| Role      | Where                     | Detail                                                                                |
| --------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Inference | VM **`ai-01`** (VMID 120) | 8c / 16 GiB / 150 GiB · Radeon **890M** VFIO · **2 MiB hugepages**                    |
| Model     | Ollama                    | **`gemma4:12b`** · bind `0.0.0.0:11434`                                               |
| Gateway   | k8s **LiteLLM**           | LB `192.168.68.108:4000` · in-cluster `http://litellm.litellm.svc.cluster.local:4000` |
| UIs       | k8s (GitOps)              | LibreChat, AnythingLLM, n8n, Open WebUI                                               |

**Not in scope**

- AMD XDNA **NPU** passthrough — unsupported on Proxmox 9; use GPU only ([gpu-passthrough](gpu-passthrough.md)).
- Ollama **inside** the cluster — inference stays on `ai-01`.
- Full 256K Gemma context on 16 GiB day one.

---

## `ai-01` guest (Terraform)

| Spec      | Value                                                                      |
| --------- | -------------------------------------------------------------------------- |
| VMID / IP | `120` / `192.168.68.20/22`                                                 |
| CPU       | 8 × `host`, **NUMA on** (required with hugepages)                          |
| RAM       | 16 GiB, ballooning **off**, hugepages **`"2"`** (2 MiB)                    |
| Disk      | 150 GiB on `data01`                                                        |
| GPU       | hardware mapping `ai-igpu` → `1002:150e` @ `0000:c6:00.0` (IOMMU group 22) |

### Why 2 MiB hugepages (not 1 GiB)

Hugepages change how the CPU **maps** the same 16 GiB — fewer TLB misses, slightly
more stable memory latency under large models. They do **not** add RAM or replace
GPU speed.

| Size              | When                                                        |
| ----------------- | ----------------------------------------------------------- |
| **`"2"` (2 MiB)** | **Lab default** — enough benefit, no host 1 GiB reservation |
| `"1024"` (1 GiB)  | Only if you deliberately reserve 1 GiB pages on the host    |

Source: `lab-home-k8s/terraform/terraform.tfvars` (`hugepages = "2"` on `ai-01`).

### Apply order (GPU guest)

1. Host IOMMU + VFIO bind — [gpu-passthrough](gpu-passthrough.md) (blacklist `amdgpu`, `vfio-pci ids=1002:150e`).
2. `terraform apply` (creates PCI mapping + VM). **Hugepages** may require **root@pam** if the API token is denied.
3. Guest: install Ollama, `OLLAMA_HOST=0.0.0.0:11434`, `ollama pull gemma4:12b`, allow LAN `:11434`.
4. Verify: `curl http://192.168.68.20:11434/api/tags`
5. Sync GitOps apps (LiteLLM first, then UIs).

---

## LiteLLM gateway

- Chart: `oci://ghcr.io/berriai/litellm-helm` (pin in `apps/litellm/apps.yaml`)
- Proxies `gemma4:12b` → `ollama/gemma4:12b` @ `http://192.168.68.20:11434`
- Clients use the LiteLLM **master key** as the OpenAI API key
- Health: `curl http://192.168.68.108:4000/health/readiness`

Do **not** point LibreChat / AnythingLLM / n8n / Open WebUI at Ollama directly.

---

## Client apps (Cilium LB)

| App         | LB IP  | Upstream                            |
| ----------- | ------ | ----------------------------------- |
| LiteLLM     | `.108` | → Ollama                            |
| LibreChat   | `.105` | → LiteLLM in-cluster                |
| AnythingLLM | `.106` | → LiteLLM (`LLM_PROVIDER=litellm`)  |
| n8n         | `.107` | → LiteLLM (OpenAI credential in UI) |
| Open WebUI  | `.109` | → LiteLLM (`openaiBaseApiUrl`)      |

In-cluster base: `http://litellm.litellm.svc.cluster.local:4000/v1`  
Manifests: `lab-home-gitops/apps/*/apps.yaml` · overview: `lab-home-gitops/apps/README.md`

---

## Related

- [Topology](topology.md) — guest table + LB pool
- [gpu-passthrough](gpu-passthrough.md) — host VFIO / IOMMU
- [Kubernetes](kubernetes.md) — cluster layout
- Daily URLs: [LAN DNS](../access/lan-dns.md) · [daily guide](../guide/daily-use.md)
