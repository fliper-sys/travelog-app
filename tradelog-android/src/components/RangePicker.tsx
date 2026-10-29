import type { RangeKey } from '@/core/analytics';
import { RANGE_LABEL, useWorkspace } from '@/lib/workspace';
import { Segmented } from './ui';

/** The date-range selector used by Overview and Insights. */
export function RangePicker() {
  const { range, setRange } = useWorkspace();
  const options = (['7', '30', '90', 'all'] as RangeKey[]).map((k) => ({ value: k, label: RANGE_LABEL[k] }));
  return <Segmented label="Date range" options={options} value={range} onChange={setRange} />;
}
