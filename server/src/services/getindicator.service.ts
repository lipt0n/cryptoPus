import { PlotlyData } from "@client/helpers/types";
import { Kline } from "@prisma/client";
import { IndicatorType, PriceType } from "@server/enums";
import {
  GetIndicatorParams,
  GetIndicatorForKlinesParams,
} from "@server/services/indicator.service";
import { getKlines } from "@server/services/kline.service";
import { logger, splitPeriod } from "@server/utils/helpers";
import dayjs from "dayjs";
const indicators = require("@server/services/indicator.service");

export const getIndicatorForKlines = async (
  params: GetIndicatorForKlinesParams
) => {
  const { period, dateFrom } = params;
  const { periodCount, periodUnit } = splitPeriod(period);
  // add more time to spin up indicator
  const _dateFrom = dayjs(dateFrom)
    .subtract(periodCount * 50, periodUnit)
    .toDate();

  const klines = await getKlines({ ...params, dateFrom: _dateFrom });

  const priceType: PriceType = params.priceType
    ? params.priceType
    : PriceType.close;

  //get indicator
  const indicatorSelector = `get${params.indicator}`;
  if (indicatorSelector in indicators) {
    const indicator: (params: GetIndicatorParams) => Promise<PlotlyData[]> =
      indicators[indicatorSelector];
    const results = (
      await indicator({ klines, options: params.options, priceType })
    ).map((result) => {
      //FIXME: fixing for x/y only
      if (!result.x || !("y" in result) || !result.y) return result;
      const pos = result.x.findIndex((_) => dayjs(_ as Date).isAfter(dateFrom));
      return {
        ...result,
        x: (result.x as Date[]).splice(-1 * (result.x.length - pos)),
        y: (result.y as number[]).splice(-1 * (result.x.length - pos)),
      };
    });
    return results;
  }
};
