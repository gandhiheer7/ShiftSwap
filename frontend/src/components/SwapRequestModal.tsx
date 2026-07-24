import { useState } from 'react';
import apiClient from '../api/client';
import { Shift } from '../types';

interface SwapRequestModalProps {
  shift: Shift;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SwapRequestModal({ shift, onClose, onSuccess }: SwapRequestModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/swaps', {
        shift_id: shift.id,
        requesting_employee_id: shift.employee_id,
        reason: reason.trim() || undefined
      });
      onSuccess();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create swap request.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const startTime = new Date(shift.start_time).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  const endTime = new Date(shift.end_time).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request a swap</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-shift-summary">
          <span className="modal-shift-role">{shift.role_required}</span>
          <span className="modal-shift-time">
            {startTime} – {endTime}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="reason">Reason (optional)</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Family event, doctor's appointment..."
            rows={3}
          />

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}