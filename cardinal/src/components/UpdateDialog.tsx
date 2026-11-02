import React from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { AppUpdateState } from '../hooks/useAppUpdate';

type UpdateDialogProps = {
  open: boolean;
  currentVersion: string;
  state: AppUpdateState;
  onClose: () => void;
};

export default function UpdateDialog({
  open,
  currentVersion,
  state,
  onClose,
}: UpdateDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!open) return null;

  const openRelease = (): void => {
    if (!state.manifest) return;
    void openUrl(state.manifest.releaseUrl).catch((error) => {
      console.error('Failed to open GitHub release', error);
    });
  };

  const title = state.status === 'available' ? t('updates.availableTitle') : t('updates.title');

  return (
    <div className="update-dialog-overlay" role="presentation">
      <div
        className="update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
      >
        <div className="update-dialog__header">
          <h2 id="update-dialog-title">{title}</h2>
          <button
            className="update-dialog__close"
            type="button"
            onClick={onClose}
            aria-label={t('updates.close')}
          >
            ×
          </button>
        </div>
        <div className="update-dialog__body" role="status" aria-live="polite">
          {state.status === 'checking' || state.status === 'idle' ? (
            <div className="update-dialog__state">
              <span className="update-dialog__spinner" aria-hidden="true" />
              <p>{t('updates.checking')}</p>
            </div>
          ) : state.status === 'available' && state.manifest ? (
            <>
              <p>
                {t('updates.availableDescription', {
                  version: state.manifest.version,
                  currentVersion,
                })}
              </p>
              <div className="update-dialog__versions">
                <span>{t('updates.currentVersion', { version: currentVersion })}</span>
                <span>{t('updates.latestVersion', { version: state.manifest.version })}</span>
              </div>
              <button
                className="app-button app-button--primary update-dialog__primary"
                type="button"
                onClick={openRelease}
              >
                {t('updates.download')}
              </button>
            </>
          ) : state.status === 'error' ? (
            <p>{t('updates.error')}</p>
          ) : (
            <p>{t('updates.upToDate')}</p>
          )}
        </div>
        <div
          className="update-dialog__footer"
          aria-hidden={
            state.status === 'checking' || state.status === 'idle' || state.status === 'available'
          }
        >
          {state.status !== 'checking' &&
          state.status !== 'idle' &&
          state.status !== 'available' ? (
            <button
              className="app-button app-button--secondary update-dialog__secondary"
              type="button"
              onClick={onClose}
            >
              {t('updates.close')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
