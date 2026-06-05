import { Injectable } from '@nestjs/common';

/**
 * OBS-011 — Minimal in-process Prometheus metrics service.
 *
 * Tracks http_requests_total (counter) and http_request_duration_seconds (summary).
 * No external dependency (no prom-client). Output is valid Prometheus text format.
 *
 * SA-OBS-008 — Known limitation: in-process Maps are reset on every container
 * restart, rolling update, or OOM kill. The metrics_last_reset_at gauge (Unix
 * timestamp in seconds) is emitted so Prometheus / Alertmanager rules can detect
 * resets and compensate rate()/increase() calculations accordingly.
 *
 * SA-OBS-009 — Gauges for external resource state (DB pool, Redis latency, …)
 * can be pushed via recordGauge(). The MetricsModule exports MetricsService so
 * PrismaService and RedisService can inject it and emit their own gauges.
 */

interface CounterEntry {
  value: number;
}

interface SummaryEntry {
  count: number;
  sum: number; // milliseconds → converted to seconds on render
}

interface GaugeEntry {
  value: number;
}

@Injectable()
export class MetricsService {
  private readonly requestCounter = new Map<string, CounterEntry>();
  private readonly durationSummary = new Map<string, SummaryEntry>();
  /** SA-OBS-009 — Arbitrary gauge values keyed by "<name>|<labels>". */
  private readonly gauges = new Map<string, GaugeEntry>();
  /**
   * SA-OBS-008 — Unix timestamp (seconds) when this instance was created.
   * Resets to the current time on every container restart / re-instantiation.
   * Expose it so Prometheus can detect counter discontinuities.
   */
  private readonly instanceStartedAt: number = Math.floor(Date.now() / 1000);

  /**
   * Record a completed HTTP request.
   * @param method  HTTP method (GET, POST, …)
   * @param route   Normalized route path (e.g. /api/projects)
   * @param status  HTTP status code
   * @param durationMs  Request duration in milliseconds
   */
  recordRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ): void {
    // SEC-012 — escape label values per the Prometheus exposition format so a
    // crafted route/method cannot break out of the quoting and inject series.
    const esc = (v: string): string =>
      v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const labels = `method="${esc(method)}",route="${esc(route)}",status="${status}"`;

    // Counter
    const counterEntry = this.requestCounter.get(labels) ?? { value: 0 };
    counterEntry.value += 1;
    this.requestCounter.set(labels, counterEntry);

    // Summary
    const summaryEntry = this.durationSummary.get(labels) ?? {
      count: 0,
      sum: 0,
    };
    summaryEntry.count += 1;
    summaryEntry.sum += durationMs;
    this.durationSummary.set(labels, summaryEntry);
  }

  /**
   * SA-OBS-009 — Record an arbitrary gauge value.
   *
   * Gauge semantics: the last call for a given (name, labels) pair wins.
   * Callers: PrismaService (db pool active/idle), RedisService (ping latency).
   *
   * @param name    Metric name, e.g. "db_pool_active"
   * @param labels  Prometheus label string, e.g. 'pool="default"'
   * @param value   Current gauge value
   */
  recordGauge(name: string, labels: string, value: number): void {
    const key = `${name}|${labels}`;
    this.gauges.set(key, { value });
  }

  /**
   * Render all metrics as Prometheus text format.
   * Returns a string ready to be served at /api/metrics.
   */
  renderMetrics(): string {
    const lines: string[] = [];

    // --- metrics_last_reset_at (SA-OBS-008) ---
    // Emitted unconditionally so Prometheus can detect counter resets after restarts.
    lines.push(
      '# HELP metrics_last_reset_at Unix timestamp (seconds) when this MetricsService instance was created. Resets on every container restart.',
    );
    lines.push('# TYPE metrics_last_reset_at gauge');
    lines.push(`metrics_last_reset_at ${this.instanceStartedAt}`);

    // --- http_requests_total ---
    lines.push(
      '# HELP http_requests_total Total number of HTTP requests received.',
    );
    lines.push('# TYPE http_requests_total counter');
    for (const [labels, entry] of this.requestCounter) {
      lines.push(`http_requests_total{${labels}} ${entry.value}`);
    }

    // --- http_request_duration_seconds ---
    lines.push(
      '# HELP http_request_duration_seconds HTTP request latency in seconds (summary).',
    );
    lines.push('# TYPE http_request_duration_seconds summary');
    for (const [labels, entry] of this.durationSummary) {
      const sumSeconds = (entry.sum / 1000).toFixed(3);
      lines.push(
        `http_request_duration_seconds_count{${labels}} ${entry.count}`,
      );
      lines.push(`http_request_duration_seconds_sum{${labels}} ${sumSeconds}`);
    }

    // --- arbitrary gauges (SA-OBS-009) ---
    // Group by metric name so # HELP / # TYPE appear once per metric.
    const gaugesByName = new Map<
      string,
      Array<{ labels: string; value: number }>
    >();
    for (const [key, entry] of this.gauges) {
      const pipeIdx = key.indexOf('|');
      const metricName = key.slice(0, pipeIdx);
      const metricLabels = key.slice(pipeIdx + 1);
      const list = gaugesByName.get(metricName) ?? [];
      list.push({ labels: metricLabels, value: entry.value });
      gaugesByName.set(metricName, list);
    }
    for (const [metricName, entries] of gaugesByName) {
      lines.push(
        `# HELP ${metricName} Gauge recorded by MetricsService.recordGauge().`,
      );
      lines.push(`# TYPE ${metricName} gauge`);
      for (const { labels, value } of entries) {
        if (labels) {
          lines.push(`${metricName}{${labels}} ${value}`);
        } else {
          lines.push(`${metricName} ${value}`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }
}
