import { Injectable } from '@nestjs/common';

/**
 * OBS-011 — Minimal in-process Prometheus metrics service.
 *
 * Tracks http_requests_total (counter) and http_request_duration_seconds (summary).
 * No external dependency (no prom-client). Output is valid Prometheus text format.
 */

interface CounterEntry {
  value: number;
}

interface SummaryEntry {
  count: number;
  sum: number; // milliseconds → converted to seconds on render
}

@Injectable()
export class MetricsService {
  private readonly requestCounter = new Map<string, CounterEntry>();
  private readonly durationSummary = new Map<string, SummaryEntry>();

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
    const labels = `method="${method}",route="${route}",status="${status}"`;

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
   * Render all metrics as Prometheus text format.
   * Returns a string ready to be served at /api/metrics.
   */
  renderMetrics(): string {
    const lines: string[] = [];

    // --- http_requests_total ---
    lines.push('# HELP http_requests_total Total number of HTTP requests received.');
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
      lines.push(
        `http_request_duration_seconds_sum{${labels}} ${sumSeconds}`,
      );
    }

    return lines.join('\n') + '\n';
  }
}
