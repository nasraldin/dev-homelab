# Secrets and Infisical

Infisical on **`infra-01:8090`** is the source of truth for lab application and
platform secrets. Ansible `secrets.yml` is the **bootstrap input** (gitignored);
after seed, consumers read from Infisical (K8s operator, CI variables, CLI).

Curriculum comparison (practice lab): [Vault vs Infisical](https://nasraldin.github.io/homelab/architecture/vault-vs-infisical.html).

## Projects (auto-created by seed)

| Project slug | Purpose                                                       | Typical consumers                 |
| ------------ | ------------------------------------------------------------- | --------------------------------- |
| `infra`      | DNS, AIStor, GitLab root, NPM, DB appliance passwords         | Ansible on guests, operators      |
| `pipelines`  | Harbor robot, runner tokens, Cosign keys, optional kubeconfig | GitLab CI only                    |
| `kubernetes` | Keycloak, Harbor admin, Sonar, Grafana, …                     | Infisical operator → K8s Secrets  |
| `apps`       | Workload envs (n8n, LibreChat, …)                             | InfisicalSecret / `infisical run` |

Environment for this lab: **`prod`** (single env). Folders group keys
(`/keycloak`, `/harbor`, `/cosign`, …).

Seed map: `lab-home-k8s/ansible/files/infisical/seed-map.yaml`.

## Fresh-lab sequence

1. Ansible brings Infisical up (`playbooks/infra.yml` / `site.yml`).
2. Complete org + admin signup in the UI (once).
3. Create machine identity **`k8s-lab-home`** (Universal Auth); grant read on
   `kubernetes` + `apps`.
4. Seed:

   ```bash
   cd lab-home-k8s/ansible
   export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=...
   export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=...
   ansible-playbook playbooks/infisical-seed.yml -e @secrets.yml
   ```

5. Install credentials for the operator (never in Git):

   ```bash
   kubectl -n infisical-operator-system create secret generic \
     infisical-universal-auth \
     --from-literal=clientId=... \
     --from-literal=clientSecret=...
   ```

6. Argo syncs `InfisicalSecret` CRs under `platform/*/infisical-secret.yaml`.

## GitOps vs pipeline kubeconfig

| Path                                 | Needs kubeconfig in CI? | Why                                                             |
| ------------------------------------ | ----------------------- | --------------------------------------------------------------- |
| Argo CD sync from Git                | **No**                  | Desired state is Git; Argo talks to API                         |
| Imperative `kubectl`/`helm` in a job | Optional                | Store under Infisical `pipelines`/`kubernetes` only if required |

Do **not** put the laptop admin kubeconfig in Infisical by default. Prefer a
**dedicated** limited ServiceAccount token if a pipeline must call the API.

## What stays out of Infisical

| Secret                         | Where                                      |
| ------------------------------ | ------------------------------------------ |
| Infisical encryption/auth keys | `secrets.yml` → Infisical Compose env only |
| Proxmox API token              | Terraform `credentials.auto.tfvars` / CI   |
| SSH private keys               | Agent / GitLab File variable               |
| Cosign **public** key          | Git (Kyverno policy) is fine               |

## Chart wiring (examples)

| App       | K8s Secret                                             | Infisical path                |
| --------- | ------------------------------------------------------ | ----------------------------- |
| Keycloak  | `keycloak-admin`, `keycloak-db`                        | `kubernetes`/`/keycloak`      |
| Grafana   | `grafana-admin`                                        | `kubernetes`/`/observability` |
| SonarQube | `sonarqube-db`                                         | `kubernetes`/`/sonarqube`     |
| Harbor    | `harbor-admin` (SoT); chart password set once via Argo | `kubernetes`/`/harbor`        |

See also: [Supply chain](supply-chain.md) · [Wazuh placement](wazuh.md).
