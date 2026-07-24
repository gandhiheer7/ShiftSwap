import { useState } from 'react';
import ShiftCalendar from './components/ShiftCalendar';
import OpenSwapsList from './components/OpenSwapsList';
import EmployeeSelector from './components/EmployeeSelector';
import Logo from './components/logo';
import { CurrentEmployeeProvider } from './context/CurrentEmployeeContext';
import './App.css';

type Tab = 'calendar' | 'openSwaps';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar');

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

        <nav className="app-tabs">
          <button
            className={activeTab === 'calendar' ? 'app-tab active' : 'app-tab'}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={activeTab === 'openSwaps' ? 'app-tab active' : 'app-tab'}
            onClick={() => setActiveTab('openSwaps')}
          >
            Open Swaps
          </button>
        </nav>

        <main>
          {activeTab === 'calendar' ? <ShiftCalendar /> : <OpenSwapsList />}
        </main>
      </div>
    </CurrentEmployeeProvider>
  );
}

export default App;