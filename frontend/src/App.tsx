import ShiftCalendar from './components/ShiftCalendar';
import EmployeeSelector from './components/EmployeeSelector';
import Logo from './components/logo';
import { CurrentEmployeeProvider } from './context/CurrentEmployeeContext';
import './App.css';

function App() {
  return (
    <CurrentEmployeeProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-header-brand">
            <Logo />
            <div>
              <h1>ShiftSwap</h1>
              <p>This week's schedule</p>
            </div>
          </div>
          <EmployeeSelector />
        </header>
        <main>
          <ShiftCalendar />
        </main>
      </div>
    </CurrentEmployeeProvider>
  );
}

export default App;