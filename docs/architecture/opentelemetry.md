# OpenTelemetry

OTLP intake for the Dev Homelab cluster. Apps and VMs export telemetry to the
**OpenTelemetry Collector**; the Collector fans out to Tempo (traces), Prometheus
(metrics), and Loki (logs). Grafana explores all three.

```text
  Apps / VMs / ai-01
         │  OTLP :4317 / :4318
         ▼
  otel-collector  (.110)
         ├── traces  → Tempo
         ├── metrics → Prometheus (remote_write)
         └── logs    → Loki (/otlp)
                │
                ▼
            Grafana (.102)
```

**Owners:** [`lab-home-gitops/platform/observability`](https://github.com/nasraldin/lab-home-gitops)

---

## Endpoints

| Path                 | URL                                                          |
| -------------------- | ------------------------------------------------------------ |
| In-cluster OTLP HTTP | `http://otel-collector.observability.svc.cluster.local:4318` |
| In-cluster OTLP gRPC | `otel-collector.observability.svc.cluster.local:4317`        |
| LAN OTLP (Cilium LB) | `http://192.168.68.110:4318` (gRPC `:4317`)                  |
| Grafana              | `http://grafana.lab` / `https://grafana.nasraldin.com`       |

**Do not** send app traffic straight to Tempo. Use the Collector so metrics and
logs share the same pipeline.

---

## Wire an app (Kubernetes)

```yaml
env:
  - name: OTEL_SERVICE_NAME
    value: my-app
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://otel-collector.observability.svc.cluster.local:4318
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: http/protobuf
  - name: OTEL_TRACES_EXPORTER
    value: otlp
  - name: OTEL_METRICS_EXPORTER
    value: otlp
  - name: OTEL_LOGS_EXPORTER
    value: otlp
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: deployment.environment=lab
```

From a VM on the LAN (e.g. `ai-01`, `gitlab-01`):

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.68.110:4318
```

### Smoke test

```bash
# After Argo apps Healthy:
kubectl -n observability get svc otel-collector tempo loki-gateway
kubectl -n observability get pods

# Synthetic OTLP (needs otel-cli or similar), or open Grafana → Explore → Tempo
```

---

## Stack map

| Component          | Role                                                               |
| ------------------ | ------------------------------------------------------------------ |
| **otel-collector** | OTLP receiver; k8sattributes; export to backends                   |
| **Tempo**          | Traces store (Longhorn PVC); OTLP + metrics-generator → Prometheus |
| **Prometheus**     | Metrics + remote_write receiver                                    |
| **Loki**           | Logs (OTLP via gateway `/otlp`)                                    |
| **Grafana**        | Datasources: Prometheus, Tempo, Loki (trace↔log links)             |

Sync wave: Prometheus/Grafana `50` → Loki `51` → Tempo `52` → Collector `53`.

---

## What is intentionally not included yet

- OpenTelemetry **Operator** / auto-instrumentation (add when app count grows)
- Multi-tenant / auth on the OTLP LB (lab LAN only)
- Shipping host node logs via Collector DaemonSet (Prometheus node exporters +
  existing scrape path cover host metrics for now)

---

## Related

- [topology](topology.md) — LB `.110`
- [kubernetes](kubernetes.md) — platform layout
- [daily guide](../guide/daily-use.md) — Grafana login
- Acceptance: Tempo + Collector Healthy in `observability`
