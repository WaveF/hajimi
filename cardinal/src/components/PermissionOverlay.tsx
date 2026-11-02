import React from 'react';

type PermissionOverlayProps = {
  title: string;
  description: string;
  steps: string[];
  statusMessage: string | null;
  onRequestPermission: () => void;
  disabled: boolean;
  actionLabel: string;
  quitLabel: string;
  onQuit: () => void;
};

export function PermissionOverlay({
  title,
  description,
  steps,
  statusMessage,
  onRequestPermission,
  disabled,
  actionLabel,
  quitLabel,
  onQuit,
}: PermissionOverlayProps): React.JSX.Element {
  return (
    <div className="permission-overlay">
      <div className="permission-card" role="dialog" aria-modal="true">
        <h1>{title}</h1>
        <p>{description}</p>
        <ol>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <p className="permission-status" role="status" aria-live="polite">
          {statusMessage}
        </p>
        <div className="permission-actions">
          <button
            className="app-button app-button--primary"
            type="button"
            onClick={onRequestPermission}
            disabled={disabled}
          >
            {actionLabel}
          </button>
          <button className="app-button app-button--secondary" type="button" onClick={onQuit}>
            {quitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
