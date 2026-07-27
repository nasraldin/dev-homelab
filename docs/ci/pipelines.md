# Home lab CI/CD

GitLab pipelines for the home lab use shared templates from
[`pipeline-templates`](https://github.com/nasraldin/pipeline-templates/). Consumer repos include jobs
via `include: project: homelab/pipeline-templates` — do not copy job definitions.

## Repos and CI scope

| Repo                 | CI focus                                                 |
| -------------------- | -------------------------------------------------------- |
| `pipeline-templates` | Lint template repo itself                                |
| `lab-home-k8s`       | Terraform + Ansible for all guests and k8s bootstrap     |
| `lab-home-gitops`    | YAML lint, Helm lint, kubeconform for platform manifests |
| App repos            | Container build → Trivy + GitLab scan → optional Harbor  |

## Container scanning (app repos)

Include templates from `pipeline-templates` — one job per file:

| Stage   | Template | Job |
| ------- | -------- | --- |
| build   | `templates/container/build.yml` | `container:build` |
| build   | `templates/container/harbor-build-push.yml` | `container:harbor-build-push` |
| scan    | `templates/container/trivy-image-scan.yml` | `container:trivy-image-scan` |
| scan    | `templates/container/container-scan.yml` | `container:container-scan` |
| publish | `templates/container/harbor-push.yml` | `container:harbor-push` (manual retag) |

Infra/GitOps repos without images use `templates/security/trivy-filesystem.yml`
(`security:trivy-fs-scan`) for IaC and secret checks.

Full reference: [pipeline-templates container scanning](https://github.com/nasraldin/pipeline-templates/blob/main/docs/container-scanning.md).

## Design rules (locked)

| Rule                                            | Why                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Do not** shrink `var.vms` for selective apply | Missing `for_each` keys → Terraform destroys other VMs                              |
| **Do** use `-target=module.vm["infra-01"]`      | Updates one guest; leaves the rest alone                                            |
| Empty `TF_TARGET_GUESTS`                        | Full plan/apply of the whole root module                                            |
| Destroy                                         | Requires `TF_TARGET_GUESTS` (or `TF_ALLOW_FULL_DESTROY=true`)                       |
| Ansible                                         | Same playbooks + `--limit`; no playbook rewrite for CI                              |
| Secrets                                         | GitLab masked / File vars — never commit `credentials.auto.tfvars` or `secrets.yml` |

## Variable contract

### Terraform (`lab-home-k8s/terraform`)

| Variable                | Meaning                                 | Example                  |
| ----------------------- | --------------------------------------- | ------------------------ |
| `TF_ACTION`             | `plan` \| `apply` \| `destroy`          | `plan`                   |
| `TF_TARGET_GUESTS`      | Comma-separated VM keys; empty = all    | `infra-01` · `docker-01` |
| `TF_AUTO_APPROVE`       | Non-interactive apply/destroy           | `true` in CI apply job   |
| `TF_ALLOW_FULL_DESTROY` | Required for destroy with empty targets | rarely `true`            |

Scripts: `terraform/scripts/ci-targets.sh`, `terraform/scripts/ci-run.sh`

### Ansible (`lab-home-k8s/ansible`)

| Variable           | Meaning                           | Example               |
| ------------------ | --------------------------------- | --------------------- |
| `ANSIBLE_PLAYBOOK` | Playbook path                     | `playbooks/infra.yml` |
| `ANSIBLE_LIMIT`    | Host or group; empty = play hosts | `infra-01`            |
| `ANSIBLE_CHECK`    | `true` → `--check --diff`         | dry-run MR pipelines  |

Script: `ansible/scripts/ci-run.sh`

### GitOps (`lab-home-gitops`)

| Variable           | Meaning                              | Example    |
| ------------------ | ------------------------------------ | ---------- |
| `GITOPS_COMPONENT` | Limit validation to one platform dir | `keycloak` |

## Selective pipelines

Two mechanisms:

1. **Automatic** — `detect-services` job runs `scripts/detect-changed-services.sh` with path maps in `maps/*.yml`. Changed paths emit `TF_TARGET_GUESTS`, `ANSIBLE_LIMIT`, or `GITOPS_COMPONENT` via dotenv artifacts.

2. **Manual** — set pipeline variables when triggering a pipeline.

### Guest cheat sheet (`lab-home-k8s`)

| Guest       | `TF_TARGET_GUESTS`                | Playbook                     | `ANSIBLE_LIMIT` |
| ----------- | --------------------------------- | ---------------------------- | --------------- |
| `infra-01`  | `infra-01`                        | `playbooks/infra.yml`        | `infra-01`      |
| `gitlab-01` | `gitlab-01`                       | `playbooks/gitlab.yml`       | `gitlab-01`     |
| `runner-01` | `runner-01`                       | `playbooks/runner.yml`       | `runner-01`     |
| `docker-01` | `docker-01`                       | `playbooks/docker-hosts.yml` | `docker-01`     |
| `dockhand`  | `dockhand` (`TF_TARGET_KIND=ct`)  | `playbooks/dockhand.yml`     | `dockhand`      |
| `portainer` | `portainer` (`TF_TARGET_KIND=ct`) | `playbooks/portainer.yml`    | `portainer`     |
| `k8s-cp-01` | `k8s-cp-01`                       | `playbooks/k8s.yml`          | `k8s-cp-01`     |
| workers     | `k8s-w-01,k8s-w-02,k8s-w-03`      | `playbooks/k8s.yml`          | `k8s_workers`   |

### Platform cheat sheet (`lab-home-gitops`)

| Component     | Path glob                   |
| ------------- | --------------------------- |
| keycloak      | `platform/keycloak/**`      |
| sonarqube     | `platform/sonarqube/**`     |
| harbor        | `platform/harbor/**`        |
| observability | `platform/observability/**` |
| gitlab-runner | `platform/gitlab-runner/**` |

Push only `platform/keycloak/apps.yaml` → pipeline validates Keycloak scope; Argo syncs the Keycloak Application on merge.

## Safety rails

| Rule                        | Implementation                                               |
| --------------------------- | ------------------------------------------------------------ |
| One TF apply at a time      | `resource_group: terraform-apply`                            |
| One Ansible apply at a time | `resource_group: ansible-apply`                              |
| Apply jobs manual on `main` | `when: manual` on apply; auto plan on MR                     |
| Idempotent reruns           | TF plan 0 changes; Ansible roles idempotent; Argo `selfHeal` |

## Rollout checklist

1. Push `pipeline-templates` to GitLab first.
2. Update `include: project:` paths if your GitLab group differs from `homelab/`.
3. Push `lab-home-k8s` and `lab-home-gitops`.
4. Set CI/CD variables: Proxmox token, SSH key, Ansible secrets file.
5. Register `runner-01` static runner; enable in-cluster runners after Argo sync.
6. Smoke test: Keycloak-only MR → scoped gitops pipeline only.

See also the [practice-lab GitLab infra pipeline](https://nasraldin.github.io/homelab/operations/gitlab-infra-pipeline) for the original contract this adapts.
