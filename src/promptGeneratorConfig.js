/** Multi-select data domains for Y3 planning queries */
export const DATA_SOURCE_OPTIONS = [
  { id: 'demand', label: 'Sales orders / demands (input/demand/)' },
  { id: 'forecast', label: 'Forecast plan (forecast/forecastplan/)' },
  { id: 'buffer', label: 'Inventory buffers (input/buffer/)' },
  { id: 'delivery', label: 'Delivery orders (input/deliveryorder/)' },
  { id: 'distribution', label: 'Distribution orders (input/distributionorder/)' },
  { id: 'item', label: 'Items (input/item/)' },
  { id: 'customer', label: 'Customers (input/customer/)' },
  { id: 'supplier', label: 'Suppliers / purchase' },
];

export const OUTPUT_FORMATS = [
  {
    id: 'structured',
    label: 'Structured JSON (summary + KPIs + rows)',
    hint: 'Best for this app’s result panels.',
  },
  {
    id: 'table',
    label: 'Markdown table + short narrative',
    hint: 'Readable in chat-style responses.',
  },
  {
    id: 'deep',
    label: 'Deep analysis (steps, caveats, follow-ups)',
    hint: 'For audits and complex investigations.',
  },
];

export const ROW_LIMITS = [
  { id: '10', label: '≈ 10 rows' },
  { id: '25', label: '≈ 25 rows' },
  { id: '50', label: '≈ 50 rows' },
  { id: '80', label: '≈ 80 rows (max recommended)' },
];

export const PROMPT_TEMPLATES = [
  {
    id: 'demand-delay',
    name: 'Demand & delay analysis',
    goal: 'Identify open or late demands with due dates, delays, and priority SKUs. Compare requested vs planned dates where visible.',
    sources: ['demand', 'delivery', 'item'],
    rowLimit: '25',
    filters: 'Focus on lines with measurable delay or at-risk due dates.',
    extra: 'Flag rows where supply confirmation is missing or late.',
  },
  {
    id: 'buffer-risk',
    name: 'Buffer & stockout risk',
    goal: 'Review buffers for stockout risk, excess vs max policy, and safety stock breaches.',
    sources: ['buffer', 'item', 'demand'],
    rowLimit: '25',
    filters: 'Prioritize locations with service-critical items.',
    extra: 'Cross-check with recent demand where data allows.',
  },
  {
    id: 'forecast-accuracy',
    name: 'Forecast vs actual',
    goal: 'Compare forecast to actual or realized demand; highlight large deviations.',
    sources: ['forecast', 'demand', 'item'],
    rowLimit: '25',
    filters: 'Use recent buckets (e.g. last 4–8 weeks) if timestamps exist.',
    extra: 'Express deviation as percentage where both series exist.',
  },
  {
    id: 'distribution',
    name: 'Distribution & transfer gaps',
    goal: 'Find distribution imbalances: stock elsewhere but shortage at dependent location, or infeasible transfers.',
    sources: ['distribution', 'buffer', 'delivery'],
    rowLimit: '25',
    filters: 'Include origin/destination and quantities if available.',
    extra: '',
  },
  {
    id: 'exec',
    name: 'Executive snapshot',
    goal: 'Single concise executive summary: top risks, top opportunities, and 3–5 KPIs with counts or volumes.',
    sources: ['demand', 'buffer', 'forecast', 'delivery'],
    rowLimit: '15',
    filters: 'Company-wide unless user scope is specified below.',
    extra: 'Keep language suitable for a demand planning steering meeting.',
  },
];
