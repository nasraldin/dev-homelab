# Supply chain and policies

Implement the curriculum plan
([supply-chain-and-policies](https://nasraldin.github.io/homelab/security/supply-chain-and-policies.html))
on **this** lab (`lab-home-gitops` + GitLab CI), not the old practice design.

## Tool roles

| Component          | Problem                         | This lab                                                |
| ------------------ | ------------------------------- | ------------------------------------------------------- |
| **Trivy**          | Image / FS CVEs                 | CI gate + Harbor built-in scanner (enabled)             |
| **Syft**           | SBOM                            | CI artifact → attach / store with image                 |
| **Cosign**         | Prove image not tampered        | Sign after scan; keys in Infisical `pipelines`/`cosign` |
| **Harbor**         | Private registry + scan storage | Platform Helm app; LB `.101`                            |
| **Kyverno**        | Admission policy                | Chart + Audit policies in GitOps                        |
| **OPA Gatekeeper** | Rego everywhere                 | **Skip** unless you specifically want Rego              |

**Verdict:** Kyverno for Kubernetes admission (YAML + built-in Cosign verify).
OPA is optional learning only.

## Flow

```text
GitLab CI
  build → trivy (fail Critical) → syft SBOM → cosign sign → push Harbor
                │
                ▼
         Argo CD sync (Git)
                │
                ▼
         Kyverno (Audit → later Enforce)
           · no :latest
           · resource requests
           · no privileged / hostNetwork
           · verifyImages for harbor.nasraldin.com/* (after keys exist)
```

## What is implemented now

| Piece                       | Location                                            | Mode                       |
| --------------------------- | --------------------------------------------------- | -------------------------- |
| Kyverno Helm                | `clusters/single/platform-apps.yaml` (wave 22)      | Install                    |
| Baseline ClusterPolicies    | `platform/kyverno/policies.yaml`                    | **Audit**                  |
| Harbor Trivy                | `platform/harbor/apps.yaml`                         | On                         |
| CI: Gitleaks + Trivy FS     | `lab-home-k8s` / `lab-home-gitops` pipelines        | On                         |
| CI: Syft + Cosign templates | `pipeline-templates` (include from app repos)       | Ready                      |
| Cosign keys                 | Infisical seed map `pipelines`/`/cosign` (optional) | Slot                       |
| verify-harbor-images policy | Same policies file                                  | Audit + placeholder pubkey |

## Order (do not Enforce early)

1. Harbor up + robot account in Infisical `pipelines`/`harbor`.
2. CI signs images pushed to `harbor.nasraldin.com`.
3. Replace placeholder public key in `verify-harbor-images`.
4. Flip policies to `Enforce` with PolicyExceptions for system namespaces.

## Cosign keygen (once)

```bash
cosign generate-key-pair
# Put cosign.key + password in Infisical pipelines/cosign
# Commit cosign.pub into platform/kyverno (or ConfigMap) — public is OK
```

## Not day-one

| Tool             | When                                     |
| ---------------- | ---------------------------------------- |
| Trivy Operator   | Continuous scan of running workloads     |
| Falco            | Runtime syscalls — after baseline stable |
| Wazuh            | Host SIEM — see [wazuh.md](wazuh.md)     |
| Keyless Sigstore | Optional later; start with key pair      |

Related: [Secrets and Infisical](secrets-and-infisical.md).
