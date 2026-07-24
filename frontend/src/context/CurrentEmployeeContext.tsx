import { createContext, useContext, useState, ReactNode } from 'react';
import { Employee } from '../types';

interface CurrentEmployeeContextValue {
  currentEmployee: Employee | null;
  setCurrentEmployee: (employee: Employee | null) => void;
}

const CurrentEmployeeContext = createContext<CurrentEmployeeContextValue | undefined>(undefined);

export function CurrentEmployeeProvider({ children }: { children: ReactNode }) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  return (
    <CurrentEmployeeContext.Provider value={{ currentEmployee, setCurrentEmployee }}>
      {children}
    </CurrentEmployeeContext.Provider>
  );
}

export function useCurrentEmployee(): CurrentEmployeeContextValue {
  const context = useContext(CurrentEmployeeContext);
  if (!context) {
    throw new Error('useCurrentEmployee must be used within a CurrentEmployeeProvider');
  }
  return context;
}