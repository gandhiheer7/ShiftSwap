export interface TestScenario {
  id: string;
  description: string;
  expectedRule: 'overlap' | 'weekly_hours' | 'rest_period' | 'none';
  expectedValid: boolean;
  employee: {
    max_weekly_hours: number;
  };
  existingShifts: Array<{
    start_time: string;
    end_time: string;
  }>;
  proposedShift: {
    start_time: string;
    end_time: string;
  };
}

// Base Monday for all scenarios: 2026-08-03 (a real Monday, used consistently so weekly-hour-window logic is predictable)

export const testScenarios: TestScenario[] = [
  // ===== OVERLAP SCENARIOS (expect FAIL) =====
  {
    id: 'OVERLAP-01',
    description: 'Proposed shift fully inside an existing shift',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T11:00:00Z', end_time: '2026-08-03T13:00:00Z' }
  },
  {
    id: 'OVERLAP-02',
    description: 'Proposed shift overlaps the start of an existing shift',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T07:00:00Z', end_time: '2026-08-03T10:00:00Z' }
  },
  {
    id: 'OVERLAP-03',
    description: 'Proposed shift overlaps the end of an existing shift',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T16:00:00Z', end_time: '2026-08-03T19:00:00Z' }
  },
  {
    id: 'OVERLAP-04',
    description: 'Proposed shift fully contains an existing shift',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T12:00:00Z', end_time: '2026-08-03T14:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }
  },
  {
    id: 'OVERLAP-05',
    description: 'Proposed shift overlaps one of two existing shifts on the same day',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [
      { start_time: '2026-08-03T06:00:00Z', end_time: '2026-08-03T10:00:00Z' },
      { start_time: '2026-08-03T14:00:00Z', end_time: '2026-08-03T18:00:00Z' }
    ],
    proposedShift: { start_time: '2026-08-03T13:00:00Z', end_time: '2026-08-03T15:00:00Z' }
  },
  {
    id: 'OVERLAP-06',
    description: 'Identical start and end time as an existing shift',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-04T09:00:00Z', end_time: '2026-08-04T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-04T09:00:00Z', end_time: '2026-08-04T17:00:00Z' }
  },
  {
    id: 'OVERLAP-07',
    description: 'One-minute overlap at the boundary',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-05T09:00:00Z', end_time: '2026-08-05T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-05T16:59:00Z', end_time: '2026-08-05T20:00:00Z' }
  },
  {
    id: 'OVERLAP-08',
    description: 'Overlap across multiple existing shifts in the same week, different days',
    expectedRule: 'overlap',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [
      { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T13:00:00Z' },
      { start_time: '2026-08-06T09:00:00Z', end_time: '2026-08-06T13:00:00Z' }
    ],
    proposedShift: { start_time: '2026-08-06T10:00:00Z', end_time: '2026-08-06T15:00:00Z' }
  },

  // ===== BOUNDARY CASES THAT SHOULD PASS (touching, not overlapping) =====
  {
    id: 'BOUNDARY-01',
    description: 'Proposed shift starts exactly when existing shift ends (touching, not overlapping) - but will fail rest period instead',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T17:00:00Z', end_time: '2026-08-03T20:00:00Z' }
  },
  {
    id: 'BOUNDARY-02',
    description: 'Proposed shift ends exactly when existing shift starts (touching, not overlapping) - but will fail rest period instead',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T05:00:00Z', end_time: '2026-08-03T09:00:00Z' }
  },

  // ===== WEEKLY HOUR LIMIT SCENARIOS (expect FAIL) =====
  {
    id: 'HOURS-01',
    description: 'Single shift exactly at the weekly max should pass',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 12 },
    existingShifts: [],
    proposedShift: { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T21:00:00Z' } // exactly 12h, equals max
  },
  {
    id: 'HOURS-02',
    description: 'Existing shifts plus proposed shift exceeds weekly max by a small margin',
    expectedRule: 'weekly_hours',
    expectedValid: false,
    employee: { max_weekly_hours: 20 },
    existingShifts: [
      { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }, // 8h
      { start_time: '2026-08-05T09:00:00Z', end_time: '2026-08-05T17:00:00Z' }  // 8h, total 16h existing
    ],
    proposedShift: { start_time: '2026-08-07T09:00:00Z', end_time: '2026-08-07T15:00:00Z' } // 6h -> total 22h > 20
  },
  {
    id: 'HOURS-03',
    description: 'Existing shifts plus proposed shift exceeds weekly max by a large margin',
    expectedRule: 'weekly_hours',
    expectedValid: false,
    employee: { max_weekly_hours: 30 },
    existingShifts: [
      { start_time: '2026-08-03T06:00:00Z', end_time: '2026-08-03T18:00:00Z' }, // 12h
      { start_time: '2026-08-05T06:00:00Z', end_time: '2026-08-05T18:00:00Z' }  // 12h, total 24h existing
    ],
    proposedShift: { start_time: '2026-08-07T06:00:00Z', end_time: '2026-08-07T18:00:00Z' } // 12h -> total 36h > 30
  },
  {
    id: 'HOURS-04',
    description: 'Existing shifts from a previous week should NOT count toward this week\'s total',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 20 },
    existingShifts: [
      { start_time: '2026-07-27T09:00:00Z', end_time: '2026-07-27T21:00:00Z' } // previous week, 12h - should not count
    ],
    proposedShift: { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' } // 8h, well under 20
  },
  {
    id: 'HOURS-05',
    description: 'Existing shifts from a following week should NOT count toward this week\'s total',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 20 },
    existingShifts: [
      { start_time: '2026-08-10T09:00:00Z', end_time: '2026-08-10T21:00:00Z' } // next week, 12h - should not count
    ],
    proposedShift: { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' } // 8h, well under 20
  },
  {
    id: 'HOURS-06',
    description: 'Total hours land exactly one minute over the limit',
    expectedRule: 'weekly_hours',
    expectedValid: false,
    employee: { max_weekly_hours: 10 },
    existingShifts: [
      { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T15:00:00Z' } // 6h
    ],
    proposedShift: { start_time: '2026-08-04T09:00:00Z', end_time: '2026-08-04T13:01:00Z' } // 4h1m -> total 10h1m > 10
  },
  {
    id: 'HOURS-07',
    description: 'Multiple small existing shifts accumulate to exceed limit',
    expectedRule: 'weekly_hours',
    expectedValid: false,
    employee: { max_weekly_hours: 15 },
    existingShifts: [
      { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T13:00:00Z' }, // 4h
      { start_time: '2026-08-04T09:00:00Z', end_time: '2026-08-04T13:00:00Z' }, // 4h
      { start_time: '2026-08-05T09:00:00Z', end_time: '2026-08-05T13:00:00Z' }  // 4h, total 12h
    ],
    proposedShift: { start_time: '2026-08-07T09:00:00Z', end_time: '2026-08-07T14:00:00Z' } // 5h -> total 17h > 15
  },

  // ===== REST PERIOD SCENARIOS (expect FAIL) =====
  {
    id: 'REST-01',
    description: 'Proposed shift starts only 2 hours after an existing shift ends',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T15:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T17:00:00Z', end_time: '2026-08-03T21:00:00Z' }
  },
  {
    id: 'REST-02',
    description: 'Proposed shift ends only 1 hour before an existing shift starts',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T14:00:00Z', end_time: '2026-08-03T20:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T08:00:00Z', end_time: '2026-08-03T13:00:00Z' }
  },
  {
    id: 'REST-03',
    description: 'Gap is exactly one minute under the 8-hour minimum',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T13:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T20:59:00Z', end_time: '2026-08-03T23:00:00Z' }
  },
  {
    id: 'REST-04',
    description: 'Overnight rest violation spanning midnight',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T18:00:00Z', end_time: '2026-08-03T23:00:00Z' }],
    proposedShift: { start_time: '2026-08-04T03:00:00Z', end_time: '2026-08-04T09:00:00Z' }
  },
  {
    id: 'REST-05',
    description: 'Rest violation on the "before" side with a later existing shift',
    expectedRule: 'rest_period',
    expectedValid: false,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T20:00:00Z', end_time: '2026-08-04T02:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T10:00:00Z', end_time: '2026-08-03T14:00:00Z' }
  },

  // ===== BOUNDARY CASES THAT SHOULD PASS (exactly at the minimum) =====
  {
    id: 'REST-BOUNDARY-01',
    description: 'Gap is exactly 8 hours - should PASS (not strictly less than minimum)',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T13:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T21:00:00Z', end_time: '2026-08-04T01:00:00Z' }
  },
  {
    id: 'REST-BOUNDARY-02',
    description: 'Gap is 8 hours and 1 minute - should comfortably PASS',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T13:00:00Z' }],
    proposedShift: { start_time: '2026-08-03T21:01:00Z', end_time: '2026-08-04T01:00:00Z' }
  },

  // ===== CLEAN VALID SCENARIOS (expect PASS - no existing shifts at all) =====
  {
    id: 'VALID-01',
    description: 'No existing shifts at all, proposed shift well within limits',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [],
    proposedShift: { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }
  },
  {
    id: 'VALID-02',
    description: 'One existing shift, proposed shift on a different day with ample rest and hours',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [{ start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' }],
    proposedShift: { start_time: '2026-08-05T09:00:00Z', end_time: '2026-08-05T17:00:00Z' }
  },
  {
    id: 'VALID-03',
    description: 'Multiple existing shifts across the week, proposed shift fits cleanly',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [
      { start_time: '2026-08-03T09:00:00Z', end_time: '2026-08-03T17:00:00Z' },
      { start_time: '2026-08-05T09:00:00Z', end_time: '2026-08-05T17:00:00Z' }
    ],
    proposedShift: { start_time: '2026-08-07T09:00:00Z', end_time: '2026-08-07T17:00:00Z' }
  },
  {
    id: 'VALID-04',
    description: 'Proposed shift is short and fits in a tight gap between two existing shifts',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 40 },
    existingShifts: [
      { start_time: '2026-08-03T06:00:00Z', end_time: '2026-08-03T10:00:00Z' },
      { start_time: '2026-08-04T06:00:00Z', end_time: '2026-08-04T10:00:00Z' }
    ],
    proposedShift: { start_time: '2026-08-03T20:00:00Z', end_time: '2026-08-03T22:00:00Z' }
  },
  {
    id: 'VALID-05',
    description: 'High weekly max easily accommodates a long proposed shift',
    expectedRule: 'none',
    expectedValid: true,
    employee: { max_weekly_hours: 60 },
    existingShifts: [
      { start_time: '2026-08-03T06:00:00Z', end_time: '2026-08-03T18:00:00Z' }
    ],
    proposedShift: { start_time: '2026-08-05T06:00:00Z', end_time: '2026-08-05T18:00:00Z' }
  }
];