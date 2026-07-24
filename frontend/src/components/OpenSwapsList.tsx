import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { OpenSwapListItem, OpenSwapsResponse, ClaimResult } from '../types';
import { useCurrentEmployee } from '../context/CurrentEmployeeContext';
import ClaimResultBanner from './ClaimResultBanner';

function formatShiftTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateLabel = startDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const startLabel = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endLabel = endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${startLabel} – ${endLabel}`;
}

export default function OpenSwapsList() {
  const [openSwaps, setOpenSwaps] = useState<OpenSwapListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimResults, setClaimResults] = useState<Record<number, ClaimResult>>({});

  const { currentEmployee } = useCurrentEmployee();

  async function fetchOpenSwaps() {
    try {
      setLoading(true);
      const response = await apiClient.get<OpenSwapsResponse>('/swaps', {
        params: { status: 'open' }
      });
      setOpenSwaps(response.data.swap_requests);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch open swaps:', err);
      setError('Failed to load open swaps. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOpenSwaps();
  }, []);

  async function handleClaim(swap: OpenSwapListItem) {
    if (!currentEmployee) {
      return;
    }

    setClaimingId(swap.id);

    try {
      const response = await apiClient.post<ClaimResult>(`/swaps/${swap.id}/claim`, {
        claiming_employee_id: currentEmployee.id
      });
      setClaimResults((prev) => ({ ...prev, [swap.id]: response.data }));

      if (response.data.validation.valid) {
        setTimeout(() => {
        fetchOpenSwaps();
    }, 2500);
      }
    } catch (err: any) {
      // 422 responses (failed validation) still come back with the same shape as a success
      if (err.response?.status === 422 && err.response?.data) {
        setClaimResults((prev) => ({ ...prev, [swap.id]: err.response.data }));
      } else {
        const message = err.response?.data?.message || 'Failed to submit claim.';
        setClaimResults((prev) => ({
          ...prev,
          [swap.id]: {
            swap_claim: null as any,
            validation: { valid: false, reasons: [message] }
          }
        }));
      }
    } finally {
      setClaimingId(null);
    }
  }

  function dismissResult(swapId: number) {
    setClaimResults((prev) => {
      const next = { ...prev };
      delete next[swapId];
      return next;
    });
  }

  if (loading) {
    return <div className="status-message">Loading open swaps...</div>;
  }

  if (error) {
    return <div className="status-message error">{error}</div>;
  }

  if (openSwaps.length === 0) {
    return <div className="status-message">No open swap requests right now.</div>;
  }

  return (
    <div className="open-swaps-list">
      {openSwaps.map((swap) => {
        const isOwnRequest = currentEmployee?.id === swap.requesting_employee_id;
        const canClaim = currentEmployee && !isOwnRequest && currentEmployee.role === swap.role_required;
        const claimResult = claimResults[swap.id];

        return (
          <div key={swap.id} className="swap-card">
            <div className="swap-card-main">
              <div className="swap-card-role-badge" data-role={swap.role_required}>
                {swap.role_required}
              </div>
              <div className="swap-card-details">
                <div className="swap-card-time">{formatShiftTime(swap.start_time, swap.end_time)}</div>
                <div className="swap-card-requester">Requested by {swap.requesting_employee_name}</div>
                {swap.reason && <div className="swap-card-reason">"{swap.reason}"</div>}
              </div>
              <div className="swap-card-action">
                {isOwnRequest ? (
                  <span className="swap-card-tag">Your request</span>
                ) : !currentEmployee ? (
                  <span className="swap-card-tag">Select your name to claim</span>
                ) : !canClaim ? (
                  <span className="swap-card-tag">Requires {swap.role_required}</span>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={claimingId === swap.id}
                    onClick={() => handleClaim(swap)}
                  >
                    {claimingId === swap.id ? 'Checking...' : 'Claim this shift'}
                  </button>
                )}
              </div>
            </div>

            {claimResult && (
              <ClaimResultBanner result={claimResult} onDismiss={() => dismissResult(swap.id)} />
            )}
          </div>
        );
      })}
    </div>
  );
}