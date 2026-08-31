/** Цена модели за 1 миллион токенов, в USD — берётся ИСКЛЮЧИТЕЛЬНО из
 * конфигурации оператора (`.env`), никогда не хардкодится в коде: у меня нет
 * verified-источника актуальной цены `gemini-3.6-flash` (модель за пределами
 * моих данных на момент обучения), а придумывать правдоподобное число —
 * ровно то, от чего явно предостерегает задача ("должна поступать из
 * реальных данных, а не быть придумана"). Если `undefined` — стоимость
 * считается `null` ("недоступно"), а не нулём и не оценкой. */
export interface ModelPricingConfig {
  model: string;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
}

/** USD * 1_000_000 — см. `AiRequestLog.costMicros` в схеме про то, почему не
 * `*Cents`: цена токена обычно доли цента, `Cents`-точности недостаточно даже
 * для одного запроса. `null`, если для текущей модели нет `pricing` —
 * намеренно не считаем 0, чтобы dashboard мог честно показать "стоимость не
 * настроена", а не молчаливый нулевой расход. */
export function calculateCostMicros(
  pricing: ModelPricingConfig | undefined,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (!pricing) return null;

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPricePerMillionUsd;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPricePerMillionUsd;

  return Math.round((inputCostUsd + outputCostUsd) * 1_000_000);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

export function centsToMicros(cents: number): number {
  return cents * 10_000;
}
