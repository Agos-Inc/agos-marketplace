import pino from 'pino';

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
};

if (process.env.NODE_ENV === 'development') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  };
}

export const logger = pino(loggerOptions);

export type MetricSample = {
  name: string;
  value: number;
  labels?: Record<string, string | number>;
};

const metricsBuffer: MetricSample[] = [];

export function recordMetric(sample: MetricSample): void {
  metricsBuffer.push(sample);
}

export function flushMetrics(): MetricSample[] {
  return metricsBuffer.splice(0, metricsBuffer.length);
}
