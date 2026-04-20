// @ts-nocheck
import React, { useRef, useState, useId } from 'react';
import {
  Card,
  IconButton,
  Modal,
  Button,
  Icon,
  Spinner,
  Badge,
} from '@unlimit/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CardBrand = 'visa' | 'mastercard' | 'amex';

export interface PaymentCardProps {
  /** Unique identifier for this payment method */
  id: string;
  /** Last 4 digits of the card number */
  last4: string;
  /** Card brand */
  brand: CardBrand;
  /** Cardholder name */
  cardholderName: string;
  /** Expiry in MM/YY format, e.g. "12/26" */
  expiry: string;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Whether this card is disabled (e.g. expired) */
  disabled?: boolean;
  /** Whether a selection API call is in flight */
  isLoading?: boolean;
  /** Whether a deletion API call is in flight */
  isDeleting?: boolean;
  /** Error message to display (selection or deletion failure) */
  error?: string;
  /** Called when the user confirms they want to select this card */
  onSelect?: (id: string) => void;
  /** Called when the user confirms deletion */
  onDelete?: (id: string) => void;
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
  brand,
  cardholderName,
  expiry,
  isSelected = false,
  disabled = false,
  isLoading = false,
  isDeleting = false,
  error,
  onSelect,
  onDelete,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // Ref to the card's root element so we can return focus after modal closes
  const cardRef = useRef<HTMLDivElement>(null);
  const errorId = useId();

  const isBusy = isLoading || isDeleting;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = () => {
    if (disabled || isBusy) return;
    onSelect?.(id);
  };

  const handleDeleteClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Prevent the click from bubbling to the card's select handler
    e.stopPropagation();
    if (disabled || isBusy) return;
    setIsDeleteModalOpen(true);
  };

  const handleModalClose = () => {
    setIsDeleteModalOpen(false);
    // Return focus to the card button after modal closes
    setTimeout(() => {
      const focusable = cardRef.current?.querySelector<HTMLElement>('[data-card-focus]');
      focusable?.focus();
    }, 0);
  };

  const handleConfirmDelete = () => {
    setIsDeleteModalOpen(false);
    onDelete?.(id);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const maskedNumber = `**** **** **** ${last4}`;
  const brandLabel = BRAND_LABELS[brand];
  const deleteAriaLabel = `Delete card ending in ${last4}`;
  const cardAriaLabel = `${brandLabel} card ending in ${last4}, expires ${expiry}${
    isSelected ? ', selected' : ''
  }${disabled ? ', expired' : ''}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Outer wrapper for error aria-describedby ── */}
      <div
        ref={cardRef}
        className="payment-card-wrapper"
        aria-describedby={error ? errorId : undefined}
      >
        <Card
          interactive={!disabled}
          selected={isSelected}
          onClick={!disabled && !isBusy ? handleSelect : undefined}
          padding="md"
        >
          {/* Hidden focusable anchor so we can programmatically return focus */}
          <span
            data-card-focus
            tabIndex={-1}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            aria-hidden="true"
          />

          <div
            className="payment-card"
            data-selected={isSelected}
            data-disabled={disabled}
            data-error={!!error}
            data-deleting={isDeleting}
            data-loading={isLoading}
          >
            {/* ── Loading / Deleting overlay ── */}
            {isBusy && (
              <div className="payment-card__overlay" aria-hidden="true">
                <Spinner
                  size="sm"
                  label={isDeleting ? 'Deleting card' : 'Loading'}
                />
              </div>
            )}

            {/* ── Top row: brand icon + badge + delete button ── */}
            <div className="payment-card__top-row">
              <div className="payment-card__brand">
                <Icon
                  name={brand}
                  size="md"
                  aria-label={brandLabel}
                />
                <span className="payment-card__brand-label" aria-hidden="true">
                  {brandLabel}
                </span>
              </div>

              <div className="payment-card__top-actions">
                {disabled && (
                  <Badge variant="danger">Expired</Badge>
                )}

                {isSelected && !disabled && (
                  <Badge variant="success">Selected</Badge>
                )}

                <IconButton
                  variant="destructive"
                  size="md"
                  icon={<Icon name="trash" size="sm" aria-hidden="true" />}
                  aria-label={deleteAriaLabel}
                  disabled={disabled || isBusy}
                  onClick={handleDeleteClick as React.MouseEventHandler}
                />
              </div>
            </div>

            {/* ── Card number ── */}
            <div
              className="payment-card__number"
              aria-label={`Card ending in ${last4}`}
              aria-hidden={false}
            >
              <span aria-hidden="true">{maskedNumber}</span>
            </div>

            {/* ── Bottom row: cardholder name + expiry ── */}
            <div className="payment-card__bottom-row">
              <span className="payment-card__name">{cardholderName}</span>
              <span
                className="payment-card__expiry"
                aria-label={`Expires ${expiry}`}
              >
                <span aria-hidden="true">{expiry}</span>
              </span>
            </div>
          </div>
        </Card>

        {/* ── Error message ── */}
        {error && (
          <p
            id={errorId}
            className="payment-card__error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={handleModalClose}
        title="Delete card"
      >
        <div className="payment-card__modal-body">
          <p className="payment-card__modal-text">
            Are you sure you want to remove your{' '}
            <strong>{brandLabel}</strong> card ending in{' '}
            <strong>{last4}</strong>? This action cannot be undone.
          </p>

          <div className="payment-card__modal-actions">
            <Button
              variant="secondary"
              onClick={handleModalClose}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Delete card
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Scoped styles ── */}
      <style>{`
        /* ── Wrapper ── */
        .payment-card-wrapper {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          gap: var(--spacing-2);
          width: 100%;
          max-width: 360px;
        }

        /* ── Card inner layout ── */
        .payment-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
          padding: var(--spacing-2);
          border-radius: var(--radius-md);
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            opacity 150ms ease;
          /* Ensure minimum touch target height */
          min-height: 44px;
        }

        /* ── Selected state border ── */
        .payment-card[data-selected="true"] {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: -2px;
        }

        /* ── Error state border ── */
        .payment-card[data-error="true"] {
          outline: 2px solid var(--color-danger);
          outline-offset: -2px;
        }

        /* ── Disabled state ── */
        .payment-card[data-disabled="true"] {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* ── Busy (loading / deleting) state ── */
        .payment-card[data-loading="true"],
        .payment-card[data-deleting="true"] {
          opacity: 0.7;
          pointer-events: none;
        }

        /* ── Overlay for spinner ── */
        .payment-card__overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.65);
          border-radius: var(--radius-md);
          z-index: 1;
        }

        /* ── Top row ── */
        .payment-card__top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-2);
        }

        .payment-card__brand {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .payment-card__brand-label {
          font-family: var(--font-family-sans);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          line-height: var(--line-height-tight);
        }

        .payment-card__top-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        /* ── Card number ── */
        .payment-card__number {
          font-family: var(--font-family-mono);
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-900);
          letter-spacing: 0.12em;
          line-height: var(--line-height-tight);
        }

        /* ── Bottom row ── */
        .payment-card__bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-2);
          flex-wrap: wrap;
        }

        .payment-card__name {
          font-family: var(--font-family-sans);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-900);
          line-height: var(--line-height-normal);
          /* Prevent overflow on very narrow viewports */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 60%;
        }

        .payment-card__expiry {
          font-family: var(--font-family-mono);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-regular);
          color: var(--color-neutral-600);
          line-height: var(--line-height-normal);
          white-space: nowrap;
        }

        /* ── Error message ── */
        .payment-card__error {
          margin: 0;
          padding: var(--spacing-1) var(--spacing-2);
          font-family: var(--font-family-sans);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-danger);
          line-height: var(--line-height-normal);
          border-radius: var(--radius-sm);
          background-color: color-mix(in srgb, var(--color-danger) 8%, transparent);
        }

        /* ── Modal body ── */
        .payment-card__modal-body {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .payment-card__modal-text {
          margin: 0;
          font-family: var(--font-family-sans);
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-regular);
          color: var(--color-neutral-900);
          line-height: var(--line-height-normal);
        }

        .payment-card__modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--spacing-3);
          flex-wrap: wrap;
        }

        /* ── Responsive: narrow viewports < 375px ── */
        @media (max-width: 374px) {
          .payment-card__bottom-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .payment-card__name {
            max-width: 100%;
          }

          .payment-card__number {
            font-size: var(--font-size-sm);
          }
        }

        /* ── Touch targets on mobile ── */
        @media (pointer: coarse) {
          .payment-card {
            min-height: 44px;
          }
        }
      `}</style>
    </>
  );
};

export default PaymentCard;
