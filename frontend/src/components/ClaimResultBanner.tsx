import { ClaimResult } from '../types';

interface ClaimResultBannerProps {
  result: ClaimResult;
  onDismiss: () => void;
}

export default function ClaimResultBanner({ result, onDismiss }: ClaimResultBannerProps) {
  const { validation } = result;

  return (
    <div className={`claim-banner ${validation.valid ? 'claim-banner-success' : 'claim-banner-failure'}`}>
      <div className="claim-banner-icon">{validation.valid ? '✓' : '✕'}</div>
      <div className="claim-banner-content">
        <strong>{validation.valid ? 'Claim approved' : 'Claim could not be validated'}</strong>
        {validation.valid ? (
          <p>No scheduling conflicts found. This swap now awaits manager approval.</p>
        ) : (
          <ul>
            {validation.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
      <button className="claim-banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}