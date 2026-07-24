import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { Employee, EmployeesResponse } from '../types';
import { useCurrentEmployee } from '../context/CurrentEmployeeContext';

export default function EmployeeSelector() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { currentEmployee, setCurrentEmployee } = useCurrentEmployee();

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const response = await apiClient.get<EmployeesResponse>('/employees');
        setEmployees(response.data.employees);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }
    }
    fetchEmployees();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedId = Number(e.target.value);
    const employee = employees.find((emp) => emp.id === selectedId) || null;
    setCurrentEmployee(employee);
  }

  return (
    <div className="employee-selector">
      <label htmlFor="employee-select">Logged in as</label>
      <select
        id="employee-select"
        value={currentEmployee?.id ?? ''}
        onChange={handleChange}
      >
        <option value="" disabled>
          Select an employee
        </option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.name} ({emp.role})
          </option>
        ))}
      </select>
    </div>
  );
}