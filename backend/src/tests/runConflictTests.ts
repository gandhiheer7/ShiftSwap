import pool from '../config/db';
import { validateSwapClaim } from '../services/conflictValidator';
import { testScenarios } from './testScenarios';

interface TestResult {
  id: string;
  description: string;
  expectedValid: boolean;
  actualValid: boolean;
  passed: boolean;
  actualReasons: string[];
}

async function runTests() {
  const client = await pool.connect();
  const results: TestResult[] = [];

  try {
    for (const scenario of testScenarios) {
      await client.query('BEGIN');

      try {
        // Create a throwaway test employee with the scenario's max_weekly_hours
        const empResult = await client.query(
          `INSERT INTO employees (name, email, role, max_weekly_hours)
           VALUES ($1, $2, 'Cashier', $3)
           RETURNING id`,
          [`Test-${scenario.id}`, `test-${scenario.id.toLowerCase()}@test.com`, scenario.employee.max_weekly_hours]
        );
        const testEmployeeId = empResult.rows[0].id;

        // Insert the scenario's existing shifts for this employee
        for (const shift of scenario.existingShifts) {
          await client.query(
            `INSERT INTO shifts (employee_id, role_required, start_time, end_time, status)
             VALUES ($1, 'Cashier', $2, $3, 'scheduled')`,
            [testEmployeeId, shift.start_time, shift.end_time]
          );
        }

        // Run the actual validator against the proposed shift
        const validation = await validateSwapClaim(client, testEmployeeId, {
          employee_id: testEmployeeId,
          start_time: scenario.proposedShift.start_time,
          end_time: scenario.proposedShift.end_time
        });

        const passed = validation.valid === scenario.expectedValid;

        results.push({
          id: scenario.id,
          description: scenario.description,
          expectedValid: scenario.expectedValid,
          actualValid: validation.valid,
          passed,
          actualReasons: validation.reasons
        });
      } finally {
        // Always roll back - none of this test data should ever actually persist
        await client.query('ROLLBACK');
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  // ===== Report results =====
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed);

  console.log('\n========================================');
  console.log('CONFLICT DETECTION TEST SUITE RESULTS');
  console.log('========================================\n');

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.id}: ${result.description}`);
    if (!result.passed) {
      console.log(`   Expected valid=${result.expectedValid}, got valid=${result.actualValid}`);
      console.log(`   Reasons returned: ${JSON.stringify(result.actualReasons)}`);
    }
  }

  console.log('\n----------------------------------------');
  console.log(`TOTAL: ${totalTests}   PASSED: ${passedTests}   FAILED: ${failedTests.length}`);
  console.log(`Pass rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('----------------------------------------\n');

  if (failedTests.length > 0) {
    console.log('FAILED SCENARIOS:');
    failedTests.forEach((f) => console.log(`  - ${f.id}: ${f.description}`));
    process.exit(1);
  } else {
    console.log('All scenarios passed. Conflict detection engine validated successfully.');
    process.exit(0);
  }
}

runTests();