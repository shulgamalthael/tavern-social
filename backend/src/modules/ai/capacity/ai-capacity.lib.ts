/**
 * Чистые вычисления Capacity/Forecast/Anomaly Engine — вынесены отдельно от
 * сервисов (`AiCapacityService`, `AiForecastService`, `AiAnomalyService`) по
 * тому же принципу, что `gemini-quota.lib.ts` в прошлой итерации: тестируемы
 * без поднятого Redis/Postgres.
 */

export type AiCapacityStatus = 'normal' | 'warning' | 'critical' | 'emergency';
export type AiPriorityLevel = 'high' | 'medium' | 'low';

/** `used / safetyLimit`, не `used / officialLimit` — thresholds (§9 brief'а)
 * должны срабатывать относительно НАШЕГО safety-запаса, не официального
 * лимита плана: цель — предупредить заранее, до того как реально упрёмся в
 * лимит провайдера, а не одновременно с ним. */
export function percentOfSafetyLimit(used: number, safetyLimit: number): number {
  if (safetyLimit <= 0) return 0;
  return Math.round((used / safetyLimit) * 100);
}

export function computeCapacityStatus(
  usedPercent: number,
  warningPercent: number,
  criticalPercent: number,
  emergencyPercent: number,
): AiCapacityStatus {
  if (usedPercent >= emergencyPercent) return 'emergency';
  if (usedPercent >= criticalPercent) return 'critical';
  if (usedPercent >= warningPercent) return 'warning';
  return 'normal';
}

/** §10-11 brief'а: NORMAL/WARNING пропускают всё, CRITICAL режет только LOW,
 * EMERGENCY пропускает только HIGH. Бюджетный hard-limit (см.
 * `AiBudgetService`) применяет ЭТУ ЖЕ функцию к своему собственному
 * "статусу" (`critical` при превышении) — единая логика приоритезации, не
 * дублированная под capacity и под budget по отдельности. */
export function shouldAdmit(priority: AiPriorityLevel, status: AiCapacityStatus): boolean {
  switch (status) {
    case 'normal':
    case 'warning':
      return true;
    case 'critical':
      return priority !== 'low';
    case 'emergency':
      return priority === 'high';
  }
}

export interface DailyUsagePoint {
  date: string;
  requestCount: number;
}

export interface ForecastResult {
  sufficientData: boolean;
  averageDailyGrowthPercent: number;
  projectedRequestsIn30Days: number;
  /** `null` = недостаточно данных ИЛИ рост не прогнозирует исчерпание в
   * пределах года (не "точно хватит навсегда" — только "не в обозримом
   * прогнозном горизонте"). `0` = уже недостаточно СЕГОДНЯ. */
  daysUntilCapacityInsufficient: number | null;
}

const FORECAST_HORIZON_DAYS = 365;

/** Простая экспоненциальная экстраполяция по геометрическому среднему
 * дневного роста — НЕ ML-модель и не сложная регрессия: задача явно
 * предостерегает от "видимости statistical rigor, которого нет" (см.
 * `AiAnomaly`'s комментарий в схеме про тот же принцип). Геометрическое, не
 * арифметическое среднее — рост трафика по своей природе мультипликативный
 * (+8% в день — это `×1.08`, не `+X запросов`), среднее отношений
 * последовательных дней даёт корректную композицию за период, в отличие от
 * среднего абсолютных приростов.
 *
 * `minDataPoints` — намеренно НЕ считаем прогноз по 1-2 точкам: с реальным
 * трафиком этого dev-окружения (единицы запросов в день) недостаточно данных
 * для честного прогноза, и функция должна явно сказать `sufficientData:
 * false`, а не нарисовать правдоподобную, но выдуманную линию тренда. */
export function computeForecast(
  points: DailyUsagePoint[],
  dailyCapacity: number,
  minDataPoints = 3,
): ForecastResult {
  const insufficientResult: ForecastResult = {
    sufficientData: false,
    averageDailyGrowthPercent: 0,
    projectedRequestsIn30Days: points.at(-1)?.requestCount ?? 0,
    daysUntilCapacityInsufficient: null,
  };

  if (points.length < minDataPoints || dailyCapacity <= 0) return insufficientResult;

  const growthRatios: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1].requestCount;
    const current = points[i].requestCount;
    if (previous > 0) growthRatios.push(current / previous);
  }

  if (growthRatios.length === 0) return insufficientResult;

  const logSum = growthRatios.reduce((sum, ratio) => sum + Math.log(Math.max(ratio, 0.01)), 0);
  const geometricMeanGrowth = Math.exp(logSum / growthRatios.length);
  const averageDailyGrowthPercent = Math.round((geometricMeanGrowth - 1) * 1000) / 10;

  const latest = points.at(-1)!.requestCount;
  const projectedRequestsIn30Days = Math.round(latest * geometricMeanGrowth ** 30);

  let daysUntilCapacityInsufficient: number | null = null;
  if (latest > dailyCapacity) {
    daysUntilCapacityInsufficient = 0;
  } else if (geometricMeanGrowth > 1) {
    let projected = latest;
    let day = 0;
    while (projected <= dailyCapacity && day < FORECAST_HORIZON_DAYS) {
      projected *= geometricMeanGrowth;
      day++;
    }
    daysUntilCapacityInsufficient = day < FORECAST_HORIZON_DAYS ? day : null;
  }

  return {
    sufficientData: true,
    averageDailyGrowthPercent,
    projectedRequestsIn30Days,
    daysUntilCapacityInsufficient,
  };
}

/** §23 brief'а: пороговое сравнение, не статистика — "нормально: 2/мин,
 * сейчас: 18/мин → аномалия". `baselineRatePerMin <= 0` (нет истории для
 * сравнения) — сравниваем `current` с самим `multiplier` как абсолютным
 * полом, чтобы функция не была бесполезна в первый день работы фичи, когда
 * baseline ещё не накопился. */
export function isRateAnomaly(
  currentRatePerMinute: number,
  baselineRatePerMinute: number,
  multiplier: number,
): boolean {
  if (baselineRatePerMinute <= 0) return currentRatePerMinute >= multiplier;
  return currentRatePerMinute >= baselineRatePerMinute * multiplier;
}
