// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import {
  Card,
  Icon,
  IconButton,
  Badge,
  Modal,
  Button,
  Spinner,
} from '@unlimit/ui';

export type CardBrand = 'visa' | 'mastercard' | 'amex';

export interface PaymentCardProps {
  /** Last 4 digits of the card number */
  last4: string;
  /** Card brand */
  brand: CardBrand;
  /** Cardholder name */
  cardholderName: string;
  /** Expiry in MM/YY format */
  expiry: string;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Whether the card is expired / non-selectable */
  disabled?: boolean;
  /** Whether an async selection operation is in progress */
  isLoading?: boolean;
  /** Whether a delete operation is in progress */
  isDeleting?: boolean;
  /** Error message to display (deletion or load failure) */
  error?: string;
  /** Called when the user confirms card selection */
  onSelect?: (last4: string) => void;
  /** Called when the user confirms deletion */
  onDelete?: (last4: string) => Promise<void>;
}

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
};

export const PaymentCard: React.FC<PaymentCardProps> = ({
  last4,
  brand,
  cardholderName,
  expiry,
  isSelected = false,
  disabled = false,
  isLoading = false,
  isDeleting: isDeleteingProp = false,
  error,
  onSelect,
  onDelete,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(isDeleteingProp);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const handleSelect = useCallback(() => {
    if (!disabled && !isLoading && !isDeleting) {
      onSelect?.(last4);
    }
  }, [disabled, isLoading, isDeleting, onSelect, last4]);

  const handleDeleteIntent = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(undefined);
      setIsDeleteModalOpen(true);
    },
    []
  );

  const handleModalClose = useCallback(() => {
    if (!isDeleting) {
      setIsDeleteModalOpen(false);
      setDeleteError(undefined);
      // Return focus to the delete button that triggered the modal
      setTimeout(() => deleteButtonRef.current?.focus(), 0);
    }
  }, [isDeleting]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      await onDelete?.(last4);
      setIsDeleteModalOpen(false);
    } catch {
      setDeleteError('Failed to delete card. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, last4]);

  const maskedNumber = `**** **** **** ${last4}`;
  const brandLabel = BRAND_LABEL[brand];
  const expiryLabel = `Expires ${expiry}`;
  const deleteAriaLabel = `Delete card ending in ${last4}`;
  const cardAriaLabel = `${brandLabel} card ending in ${last4}${
    isSelected ? ', selected' : ''
  }${disabled ? ', expired' : ''}`;

  const displayError = error || deleteError;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2)',
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {/* ── Card container ── */}
      <div style={{ position: 'relative' }}>
        <Card
          interactive={!disabled}
          selected={isSelected}
          padding="md"
          onClick={!disabled ? handleSelect : undefined}
        >
          {/* Loading overlay — async selection in progress */}
          {isLoading && (
            <div
              role="status"
              aria-label="Loading card"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.75)',
                borderRadius: 'var(--radius-md)',
                zIndex: 2,
              }}
            >
              <Spinner size="md" label="Loading card" />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-4)',
              opacity: disabled ? 0.5 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {/* Brand icon */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-hidden="true"
            >
              <Icon name={brand} size="lg" aria-hidden={true} />
            </div>

            {/* Card details */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-1)',
              }}
            >
              {/* Masked card number */}
              <span
                aria-label={`Card ending in ${last4}`}
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'],
                  color: 'var(--color-neutral-900)',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {maskedNumber}
              </span>

              {/* Cardholder name + expiry row */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-neutral-600)',
                    fontWeight: 'var(--font-weight-regular)' as React.CSSProperties['fontWeight'],
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '160px',
                  }}
                >
                  {cardholderName}
                </span>

                <span
                  style={{
                    color: 'var(--color-neutral-400)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                  aria-hidden="true"
                >
                  ·
                </span>

                <time
                  dateTime={expiry}
                  aria-label={expiryLabel}
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-neutral-600)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {expiry}
                </time>

                {/* Expired badge */}
                {disabled && (
                  <Badge variant="danger">Expired</Badge>
                )}
              </div>
            </div>

            {/* Brand label (visually hidden, for screen readers) */}
            <span
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              {brandLabel}
            </span>

            {/* Delete action — right side */}
            <div
              style={{ flexShrink: 0, marginLeft: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              {isDeleting ? (
                <Spinner size="sm" label="Deleting card" />
              ) : (
                <IconButton
                  ref={deleteButtonRef as React.Ref<HTMLButtonElement>}
                  variant="destructive"
                  size="lg"
                  icon={<Icon name="trash" size="md" aria-hidden={true} />}
                  aria-label={deleteAriaLabel}
                  disabled={disabled || isLoading}
                  onClick={handleDeleteIntent}
                />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Error message ── */}
      {displayError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(225, 75, 75, 0.08)',
            border: '1px solid var(--color-danger)',
          }}
        >
          <Icon
            name="alert"
            size="sm"
            aria-hidden={true}
            style={{ color: 'var(--color-danger)', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-danger)',
              fontWeight: 'var(--font-weight-medium)' as React.CSSProperties['fontWeight'],
            }}
          >
            {displayError}
          </span>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={handleModalClose}
        title="Delete card"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-6)',
            fontFamily: 'var(--font-family-sans)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-neutral-600)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            Are you sure you want to delete the{' '}
            <strong style={{ color: 'var(--color-neutral-900)' }}>
              {brandLabel} card ending in {last4}
            </strong>
            ? This action cannot be undone.
          </p>

          {/* Inline delete error inside modal */}
          {deleteError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(225, 75, 75, 0.08)',
                border: '1px solid var(--color-danger)',
              }}
            >
              <Icon name="alert" size="sm" aria-hidden={true} />
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-danger)',
                }}
              >
                {deleteError}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-3)',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="secondary"
              onClick={handleModalClose}
              disabled={isDeleting}
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
    </div>
  );
};

export default PaymentCard;
