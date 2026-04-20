// @ts-nocheck
import React, { useState } from 'react';
import {
  Card,
  Icon,
  IconButton,
  Modal,
  Button,
  Badge,
  Spinner,
} from '@unlimit/ui';
import type { ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CardBrand = 'visa' | 'mastercard' | 'amex';

export interface PaymentCardProps {
  /** Unique identifier for this card */
  id: string;
  /** Full or last-4 digits — component always masks to last 4 */
  last4: string;
  /** MM/YY expiry string, e.g. "12/26" */
  expiry: string;
  /** Cardholder name */
  cardholderName: string;
  /** Card network brand */
  brand: CardBrand;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Whether the card is expired / non-selectable */
  disabled?: boolean;
  /** Async selection in progress */
  isLoading?: boolean;
  /** Async deletion in progress */
  isDeleting?: boolean;
  /** Error message to surface (failed selection or load) */
  error?: string;
  /** Called when the user selects this card */
  onSelect?: (id: string) => void;
  /** Called when the user confirms deletion */
  onDelete?: (id: string) => Promise<void> | void;
}

// ─── Brand label map ─────────────────────────────────────────────────────────

const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const PaymentCard: React.FC<PaymentCardProps> = ({
  id,
  last4,
  expiry,
  cardholderName,
  brand,
  isSelected = false,
  disabled = false,
  isLoading = false,
  isDeleting = false,
  error,
  onSelect,
  onDelete,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [localDeleting, setLocalDeleting] = useState(false);

  const effectiveDeleting = isDeleting || localDeleting;
  const brandLabel = BRAND_LABELS[brand];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = () => {
    if (disabled || effectiveDeleting || isLoading) return;
    onSelect?.(id);
  };

  const handleDeleteClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Prevent the card's onClick (select) from firing
    e.stopPropagation();
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleModalClose = () => {
    if (localDeleting) return; // block close while in-flight
    setIsDeleteModalOpen(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    setDeleteError(null);
    setLocalDeleting(true);
    try {
      await onDelete?.(id);
      setIsDeleteModalOpen(false);
    } catch {
      setDeleteError('Failed to delete card. Please try again.');
    } finally {
      setLocalDeleting(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────

  const maskedDisplay = `•••• •••• •••• ${last4}`;
  const cardAriaLabel = `${brandLabel} card ending in ${last4}`;
  const deleteAriaLabel = `Delete card ending in ${last4}`;
  const expiryAriaLabel = `Expires ${expiry}`;

  // ── Loading / deleting overlay ────────────────────────────────────────────

  if (effectiveDeleting) {
    return (
      <>
        <div className="payment-card payment-card--deleting" aria-busy="true">
          <Card padding="md">
            <div className="payment-card__overlay" role="status" aria-label={`Deleting card ending in ${last4}`}>
              <Spinner size="sm" label={`Deleting card ending in ${last4}`} />
              <span className="payment-card__overlay-text" aria-hidden="true">
                Deleting…
              </span>
            </div>
          </Card>
        </div>

        {/* Keep modal mounted so focus isn't lost mid-flight */}
        <Modal
          open={isDeleteModalOpen}
          onClose={handleModalClose}
          title="Delete card"
        >
          <ModalContent
            last4={last4}
            isDeleting={localDeleting}
            deleteError={deleteError}
            onConfirm={handleConfirmDelete}
            onCancel={handleModalClose}
          />
        </Modal>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="payment-card payment-card--loading" aria-busy="true">
        <Card padding="md">
          <div className="payment-card__overlay" role="status" aria-label={`Loading card ending in ${last4}`}>
            <Spinner size="sm" label={`Loading card ending in ${last4}`} />
          </div>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={[
          'payment-card',
          isSelected ? 'payment-card--selected' : '',
          disabled ? 'payment-card--disabled' : '',
          error ? 'payment-card--error' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Card
          padding="md"
          interactive={!disabled}
          selected={isSelected}
          onClick={!disabled ? handleSelect : undefined}
        >
          <div className="payment-card__inner">
            {/* ── Top row: brand icon + badge + delete ── */}
            <div className="payment-card__top-row">
              <div className="payment-card__brand">
                <Icon
                  name={brand}
                  size="lg"
                  aria-hidden={true}
                />
                <span className="payment-card__brand-label">{brandLabel}</span>
              </div>

              <div className="payment-card__actions">
                {disabled && (
                  <Badge variant="danger">Expired</Badge>
                )}
                {/* Stop propagation so delete click doesn't trigger card select */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                  }}
                  className="payment-card__delete-wrapper"
                >
                  <IconButton
                    variant="destructive"
                    size="md"
                    icon={<Icon name="trash" aria-hidden={true} />}
                    aria-label={deleteAriaLabel}
                    onClick={handleDeleteClick as () => void}
                    disabled={effectiveDeleting}
                  />
                </div>
              </div>
            </div>

            {/* ── Card number ── */}
            <div
              className="payment-card__number"
              aria-label={cardAriaLabel}
            >
              <span aria-hidden="true">{maskedDisplay}</span>
            </div>

            {/* ── Bottom row: cardholder + expiry ── */}
            <div className="payment-card__bottom-row">
              <div className="payment-card__cardholder">
                <span className="payment-card__meta-label">Cardholder</span>
                <span className="payment-card__meta-value">{cardholderName}</span>
              </div>
              <div className="payment-card__expiry">
                <span className="payment-card__meta-label">Expires</span>
                <span
                  className="payment-card__meta-value"
                  aria-label={expiryAriaLabel}
                >
                  {expiry}
                </span>
              </div>
            </div>

            {/* ── Error message ── */}
            {error && (
              <div
                className="payment-card__error"
                role="alert"
                aria-live="assertive"
              >
                <Icon name="alert" size="sm" aria-hidden={true} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={handleModalClose}
        title="Delete card"
      >
        <ModalContent
          last4={last4}
          isDeleting={localDeleting}
          deleteError={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={handleModalClose}
        />
      </Modal>
    </>
  );
};

// ─── Modal content (extracted to keep JSX readable) ───────────────────────────

interface ModalContentProps {
  last4: string;
  isDeleting: boolean;
  deleteError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ModalContent: React.FC<ModalContentProps> = ({
  last4,
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}) => (
  <div className="payment-card__modal-body">
    <p className="payment-card__modal-description">
      Are you sure you want to remove the card ending in{' '}
      <strong>{last4}</strong>? This action cannot be undone.
    </p>

    {deleteError && (
      <div
        className="payment-card__modal-error"
        role="alert"
        aria-live="assertive"
      >
        <Icon name="alert" size="sm" aria-hidden={true} />
        <span>{deleteError}</span>
      </div>
    )}

    <div className="payment-card__modal-actions">
      <Button
        variant="secondary"
        onClick={onCancel}
        disabled={isDeleting}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        loading={isDeleting}
        onClick={onConfirm}
      >
        Delete card
      </Button>
    </div>
  </div>
);

export default PaymentCard;
