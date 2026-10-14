export const METRICS_SRC: string;
export function measureFiles(
  browser: unknown,
  files: string[],
  crops?: Record<string, { x: number; y: number; w: number; h: number }>
): Promise<Record<string, Record<string, number>>>;
