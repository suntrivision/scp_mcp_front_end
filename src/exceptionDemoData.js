/** Sample data when live backend is unavailable (demo / offline). */
export const DEMO_EXCEPTION_RESPONSE = {
  summary:
    'Demonstration view: exceptions are illustrative. Connect your frePPLe backend (e.g. set FREPPLE_BACKEND_URL on the server) to load live planning data.',
  kpis: {
    'Supplier delay': 4,
    'Forecast miss': 2,
    'No reorder triggered': 3,
    'Lead time error': 1,
    'Distribution gap': 2,
  },
  rows: [
    {
      item: 'SKU-A104',
      location: 'DC-East',
      root_cause_category: 'Supplier delay',
      exception_type: 'Supplier delay',
      severity: 'High',
      recommended_action: 'Expedite PO-77821 or split line to alternate vendor.',
      detail:
        'Purchase order exists but supplier confirmed date moved past the required dock date by 6 working days.',
    },
    {
      item: 'SKU-B220',
      location: 'Plant-01',
      root_cause_category: 'Forecast miss',
      exception_type: 'Forecast miss',
      severity: 'Medium',
      recommended_action: 'Refresh consensus forecast and review safety stock for next bucket.',
      detail: 'Actual shipments in the last 4 weeks exceeded forecast by more than 35%.',
    },
    {
      item: 'SKU-C008',
      location: 'DC-West',
      root_cause_category: 'No reorder triggered',
      exception_type: 'No reorder triggered',
      severity: 'High',
      recommended_action: 'Raise emergency PO; verify ROP and lot size in item master.',
      detail: 'Projected on-hand crossed below ROP without a purchase suggestion being released.',
    },
    {
      item: 'SKU-D441',
      location: 'DC-East',
      root_cause_category: 'Lead time error',
      exception_type: 'Lead time error',
      severity: 'Medium',
      recommended_action: 'Update supplier calendar lead time from 14d to 21d and re-run MRP.',
      detail: 'Observed transit and production lead time consistently longer than system parameters.',
    },
    {
      item: 'SKU-E903',
      location: 'DC-West',
      root_cause_category: 'Distribution gap',
      exception_type: 'Distribution gap',
      severity: 'Low',
      recommended_action: 'Create stock transfer from DC-East surplus to cover dependent demands.',
      detail: 'Available quantity at alternate location could cover shortage within 2-day transit.',
    },
  ],
};
