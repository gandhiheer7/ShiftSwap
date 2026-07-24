import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import apiClient from '../api/client';
import { Shift, ShiftsResponse } from '../types';
import { useCurrentEmployee } from '../context/CurrentEmployeeContext';
import SwapRequestModal from './SwapRequestModal';

const ROLE_STYLES: Record<string, { border: string; tint: string }> = {
  Cashier: { border: '#5b7fdb', tint: 'rgba(91, 127, 219, 0.12)' },
  Barista: { border: '#4fa689', tint: 'rgba(79, 166, 137, 0.12)' },
  Cleaner: { border: '#d89b4a', tint: 'rgba(216, 155, 74, 0.14)' }
};

const DEFAULT_STYLE = { border: '#8b8d98', tint: 'rgba(139, 141, 152, 0.12)' };

function firstName(fullName: string): string {
  return fullName.split(' ')[0];
}

export default function ShiftCalendar() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { currentEmployee } = useCurrentEmployee();

  async function fetchShifts() {
    try {
      setLoading(true);
      const response = await apiClient.get<ShiftsResponse>('/shifts', {
        params: { limit: 100 }
      });
      setShifts(response.data.shifts);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
      setError('Failed to load shifts. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShifts();
  }, []);

  function handleEventClick(eventId: string) {
  const actualShiftId = Number(eventId.split('-')[0]);
  const shift = shifts.find((s) => s.id === actualShiftId);
  if (!shift) return;

    if (!currentEmployee) {
      setToast('Select who you are logged in as first.');
      return;
    }

    if (shift.employee_id !== currentEmployee.id) {
      setToast(`This is ${shift.employee_name}'s shift - you can only request a swap for your own shifts.`);
      return;
    }

    if (shift.status !== 'scheduled') {
      setToast(`This shift already has a swap in progress (status: ${shift.status}).`);
      return;
    }

    setSelectedShift(shift);
  }

  function handleSwapSuccess() {
    setSelectedShift(null);
    setToast('Swap request submitted successfully.');
    fetchShifts();
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loading) {
    return <div className="status-message">Loading shifts...</div>;
  }

  if (error) {
    return <div className="status-message error">{error}</div>;
  }

  const events = shifts.map((shift) => {
    const style = ROLE_STYLES[shift.role_required] || DEFAULT_STYLE;
    const isMine = currentEmployee?.id === shift.employee_id;
    return {
      id: `${shift.id}-${currentEmployee?.id ?? 'none'}`,
      title: firstName(shift.employee_name),
      start: shift.start_time,
      end: shift.end_time,
      borderColor: style.border,
      backgroundColor: style.tint,
      extendedProps: {
        eventBorderColor: style.border,
        eventBgTint: style.tint,
        fullName: shift.employee_name,
        role: shift.role_required,
        isMine
      }
    };
  });

  return (
    <div className="calendar-wrapper">
      {toast && <div className="toast">{toast}</div>}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        allDaySlot={false}
        eventClick={(info) => handleEventClick(info.event.id)}
        eventDidMount={(info) => {
  const border = info.event.extendedProps.eventBorderColor;
  const tint = info.event.extendedProps.eventBgTint;
  if (border) info.el.style.setProperty('--fc-event-border-color', border);
  if (tint) info.el.style.setProperty('--fc-event-bg-tint', tint);

  const fullName = info.event.extendedProps.fullName;
  const role = info.event.extendedProps.role;
  const isMine = info.event.extendedProps.isMine;
  info.el.setAttribute(
    'title',
    `${fullName} · ${role}${isMine ? ' (your shift - click to request a swap)' : ''}`
  );

  if (currentEmployee) {
    if (isMine) {
      info.el.classList.add('fc-event-mine');
    } else {
      info.el.classList.add('fc-event-dimmed');
    }
  }
  info.el.style.cursor = 'pointer';
}}
      />

      {selectedShift && (
        <SwapRequestModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onSuccess={handleSwapSuccess}
        />
      )}
    </div>
  );
}