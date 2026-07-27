# Wazuh placement (SIEM / XDR)

Curriculum detail:
[Wazuh](https://nasraldin.github.io/homelab/security/wazuh.html).

Wazuh answers **“did something security-relevant happen?”** — not “is CPU high?”
(that stays Prometheus/Grafana) and not “is this manifest allowed?” (Kyverno).

## Layers in this lab

```text
BUILD              DEPLOY             RUNTIME              HOST / SIEM
─────              ──────             ───────              ───────────
Trivy / Syft       Kyverno            Falco (later)        Wazuh (later)
Cosign             (admission)         (k8s syscalls)       agents on VMs
Harbor scan                            │                   + Proxmox logs
                                       ▼
                                Prometheus / Grafana / Loki / OTel
                                (health, metrics, app logs, traces)
```

| Tool           | Layer     | Role                                      |
| -------------- | --------- | ----------------------------------------- |
| **Kyverno**    | Deploy    | Block / audit bad manifests               |
| **Trivy**      | Build     | Image CVEs                                |
| **Falco**      | Runtime   | Container threat detection (not yet)      |
| **Wazuh**      | Host+SIEM | FIM, auth brute-force, compliance, agents |
| **Prometheus** | Metrics   | Capacity, SLOs                            |
| **Loki**       | App logs  | Debug                                     |

They **complement**; Wazuh does not replace Prometheus, Loki, Falco, or Kyverno.

## When to deploy

Add Wazuh **late** (after Harbor, Kyverno Audit→Enforce path, and stable
observability). Manager + indexer + dashboard are **heavy** — prefer a dedicated
guest (or reuse a roomy Docker host), not the control-plane nodes.

Suggested first agents: `pve01` (via syslog/API carefully), `infra-01`,
`gitlab-01`, Kubernetes node SSH/auth logs — not every container as an agent.

## This lab status

| Item                     | Status                                                 |
| ------------------------ | ------------------------------------------------------ |
| Kyverno + Audit policies | **In GitOps**                                          |
| Harbor Trivy             | **Enabled**                                            |
| Falco                    | Not installed (document-only until needed)             |
| Wazuh manager / agents   | **Not deployed** — schedule after supply-chain Enforce |

Do not install Wazuh “because the curriculum mentions it” before the admission
and registry path works — you will fight noise without a signed-image baseline.
