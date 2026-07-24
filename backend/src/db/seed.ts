import pool from '../config/db';

const employees = [
  { name: 'Aarav Shah', email: 'aarav.shah@cafe.com', role: 'Cashier', max_weekly_hours: 40 },
  { name: 'Priya Nair', email: 'priya.nair@cafe.com', role: 'Cashier', max_weekly_hours: 35 },
  { name: 'Rohan Mehta', email: 'rohan.mehta@cafe.com', role: 'Barista', max_weekly_hours: 40 },
  { name: 'Sana Khan', email: 'sana.khan@cafe.com', role: 'Barista', max_weekly_hours: 30 },
  { name: 'Vikram Iyer', email: 'vikram.iyer@cafe.com', role: 'Barista', max_weekly_hours: 40 },
  { name: 'Neha Joshi', email: 'neha.joshi@cafe.com', role: 'Cleaner', max_weekly_hours: 25 },
  { name: 'Karan Malhotra', email: 'karan.malhotra@cafe.com', role: 'Cleaner', max_weekly_hours: 30 },
  { name: 'Ishita Rao', email: 'ishita.rao@cafe.com', role: 'Cashier', max_weekly_hours: 40 },
  { name: 'Dev Patel', email: 'dev.patel@cafe.com', role: 'Barista', max_weekly_hours: 40 },
  { name: 'Ananya Reddy', email: 'ananya.reddy@cafe.com', role: 'Cashier', max_weekly_hours: 20 },
  { name: 'Farhan Sheikh', email: 'farhan.sheikh@cafe.com', role: 'Cleaner', max_weekly_hours: 40 },
  { name: 'Meera Kulkarni', email: 'meera.kulkarni@cafe.com', role: 'Barista', max_weekly_hours: 35 }
];

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Clearing existing data...');
    await client.query('TRUNCATE shifts, employees RESTART IDENTITY CASCADE');

    console.log('Inserting employees...');
    const employeeIds: { [email: string]: number } = {};

    for (const emp of employees) {
      const result = await client.query(
        `INSERT INTO employees (name, email, role, max_weekly_hours)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email`,
        [emp.name, emp.email, emp.role, emp.max_weekly_hours]
      );
      employeeIds[result.rows[0].email] = result.rows[0].id;
    }

    console.log(`Inserted ${employees.length} employees.`);

    console.log('Generating shifts for the current week...');

    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);

    const shiftTemplates = [
      { startHour: 7, endHour: 11 },
      { startHour: 11, endHour: 15 },
      { startHour: 15, endHour: 19 },
      { startHour: 19, endHour: 23 }
    ];

    let shiftsInserted = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + dayOffset);

      for (const template of shiftTemplates) {
        const shuffled = [...employees].sort(() => 0.5 - Math.random());
        const assigned = shuffled.slice(0, 2);

        for (const emp of assigned) {
          const startTime = new Date(dayDate);
          startTime.setUTCHours(template.startHour, 0, 0, 0);

          const endTime = new Date(dayDate);
          endTime.setUTCHours(template.endHour, 0, 0, 0);

          await client.query(
            `INSERT INTO shifts (employee_id, role_required, start_time, end_time, status)
             VALUES ($1, $2, $3, $4, 'scheduled')`,
            [employeeIds[emp.email], emp.role, startTime, endTime]
          );
          shiftsInserted++;
        }
      }
    }

    console.log(`Inserted ${shiftsInserted} shifts across 7 days.`);
    console.log('Seed completed successfully.');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();