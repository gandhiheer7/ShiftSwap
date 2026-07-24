import { PoolClient } from 'pg';

export interface ConflictCheckResult {
  valid: boolean;
  reasons: string[];
}

interface ShiftToValidate {
  employee_id: number;
  start_time: string;
  end_time: string;
}

const MIN_REST_HOURS = 8;

/**
 * Runs all conflict-detection rules for a proposed shift assignment.
 * Uses the same DB client passed in so this can run inside an existing transaction.
 */
export async function validateSwapClaim(
  client: PoolClient,
  claimingEmployeeId: number,
  shiftToClaim: ShiftToValidate
): Promise<ConflictCheckResult> {
  const reasons: string[] = [];

  // Rule 1: Double-booking - does an overlapping shift already exist for this employee?
  const overlapResult = await client.query(
    `SELECT id, start_time, end_time
     FROM shifts
     WHERE employee_id = $1
       AND status = 'scheduled'
       AND start_time < $3
       AND end_time > $2`,
    [claimingEmployeeId, shiftToClaim.start_time, shiftToClaim.end_time]
  );

  if (overlapResult.rows.length > 0) {
  const conflictingShift = overlapResult.rows[0];
  reasons.push(
    `Overlaps with existing shift from ${formatReadableDateTime(conflictingShift.start_time)} to ${formatReadableDateTime(conflictingShift.end_time)}`
  );
}

  // Rule 2: Weekly hour limit - would this shift push total weekly hours over the employee's max?
  const weekStart = getWeekStart(new Date(shiftToClaim.start_time));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

function formatReadableDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

  const hoursResult = await client.query(
    `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) AS total_hours
     FROM shifts
     WHERE employee_id = $1
       AND status = 'scheduled'
       AND start_time >= $2
       AND start_time < $3`,
    [claimingEmployeeId, weekStart.toISOString(), weekEnd.toISOString()]
  );

  const existingWeeklyHours = parseFloat(hoursResult.rows[0].total_hours);
  const newShiftHours =
    (new Date(shiftToClaim.end_time).getTime() - new Date(shiftToClaim.start_time).getTime()) /
    (1000 * 60 * 60);
  const projectedWeeklyHours = existingWeeklyHours + newShiftHours;

  const maxHoursResult = await client.query(
    'SELECT max_weekly_hours FROM employees WHERE id = $1',
    [claimingEmployeeId]
  );
  const maxWeeklyHours = parseFloat(maxHoursResult.rows[0].max_weekly_hours);

  if (projectedWeeklyHours > maxWeeklyHours) {
    reasons.push(
      `Would result in ${projectedWeeklyHours.toFixed(1)} hours this week, exceeding max of ${maxWeeklyHours}`
    );
  }

  // Rule 3: Minimum rest period - check the nearest shift before and after the proposed shift
  const adjacentResult = await client.query(
    `SELECT start_time, end_time
     FROM shifts
     WHERE employee_id = $1
       AND status = 'scheduled'
     ORDER BY start_time ASC`,
    [claimingEmployeeId]
  );

  console.log(`DEBUG [employee ${claimingEmployeeId}] rows found:`, adjacentResult.rows.length, adjacentResult.rows);
  
  const proposedStart = new Date(shiftToClaim.start_time);
  const proposedEnd = new Date(shiftToClaim.end_time);

  for (const row of adjacentResult.rows) {
    const existingStart = new Date(row.start_time);
    const existingEnd = new Date(row.end_time);

    let gapHours: number | null = null;
let direction: 'before' | 'after' | null = null;

if (existingEnd <= proposedStart) {
  gapHours = (proposedStart.getTime() - existingEnd.getTime()) / (1000 * 60 * 60);
  direction = 'after';
} else if (proposedEnd <= existingStart) {
  gapHours = (existingStart.getTime() - proposedEnd.getTime()) / (1000 * 60 * 60);
  direction = 'before';
}

if (gapHours !== null && direction !== null && gapHours < MIN_REST_HOURS) {
  reasons.push(
    `Only ${gapHours.toFixed(1)} hours of rest ${direction} an adjacent shift (minimum required: ${MIN_REST_HOURS})`
  );
  break;
}
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7; // days since Monday
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}