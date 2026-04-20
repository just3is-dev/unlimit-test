// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Badge,
  Button,
  IconButton,
  Select,
  Spinner,
  Skeleton,
  Icon,
  Modal,
} from '@unlimit/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'visa' | 'mastercard' | 'amex';

export interface Transaction {
  id: string;
  date: string;           // ISO-8601
  amount: number;         // positive = credit, negative = debit
  currency: string;
  status: TransactionStatus;
  merchant: string;
  paymentMethod: PaymentMethod;
}

type SortKey = 'date' | 'amount' | 'status' | 'merchant' | 'paymentMethod';
type SortDir = 'asc' | 'desc' | 'none';

interface SortState {
  key: SortKey | null;
  dir: SortDir;
}

interface TransactionTableProps {
  transactions?: Transaction[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<TransactionStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  pending:   'warning',
  completed: 'success',
  failed:    'danger',
  refunded:  'info',
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending:   'Pending',
  completed: 'Completed',
  failed:    'Failed',
  refunded:  'Refunded',
};

const PAYMENT_ICON: Record<PaymentMethod, 'visa' | 'mastercard' | 'amex'> = {
  visa:       'visa',
  mastercard: 'mastercard',
  amex:       'amex',
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  visa:       'Visa',
  mastercard: 'Mastercard',
  amex:       'American Express',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount >= 0 ? '+' : '\u2212'; // U+2212 MINUS SIGN
  return `${sign}\u00A0${currency}\u00A0${abs}`;
}

function compareValues(a: Transaction, b: Transaction, key: SortKey): number {
  switch (key) {
    case 'date':          return new Date(a.date).getTime() - new Date(b.date).getTime();
    case 'amount':        return a.amount - b.amount;
    case 'status':        return a.status.localeCompare(b.status);
    case 'merchant':      return a.merchant.localeCompare(b.merchant);
    case 'paymentMethod': return a.paymentMethod.localeCompare(b.paymentMethod);
    default:              return 0;
  }
}

const ROWS_PER_PAGE_OPTIONS = [
  { value: '25',  label: '25' },
  { value: '50',  label: '50' },
  { value: '100', label: '100' },
];

// ─── Visually-hidden utility ──────────────────────────────────────────────────

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SortIconProps {
  columnKey: SortKey;
  sort: SortState;
}
const SortIcon: React.FC<SortIconProps> = ({ columnKey, sort }) => {
  if (sort.key !== columnKey || sort.dir === 'none') {
    return (
      <span style={{ opacity: 0.35, marginLeft: 'var(--spacing-1)', display: 'inline-flex' }}>
        <Icon name="chevron-down" size="sm" aria-hidden />
      </span>
    );
  }
  return (
    <span
      style={{
        marginLeft: 'var(--spacing-1)',
        display: 'inline-flex',
        transform: sort.dir === 'asc' ? 'rotate(180deg)' : 'none',
        transition: 'transform 150ms ease',
        color: 'var(--color-brand-primary)',
      }}
    >
      <Icon name="chevron-down" size="sm" aria-hidden />
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions = [],
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [sort, setSort]               = useState<SortState>({ key: null, dir: 'none' });
  const [page, setPage]               = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState('25');
  const [selectedTx, setSelectedTx]   = useState<Transaction | null>(null);
  const tableRef                      = useRef<HTMLTableElement>(null);
  const headingRef                    = useRef<HTMLHeadingElement>(null);

  // Reset to page 1 when sort or rowsPerPage changes
  useEffect(() => { setPage(1); }, [sort, rowsPerPage]);

  // Return focus to table heading after sort/page change so focus is not lost
  const prevSortRef = useRef(sort);
  useEffect(() => {
    if (prevSortRef.current !== sort) {
      prevSortRef.current = sort;
      headingRef.current?.focus();
    }
  }, [sort]);

  const handleSort = useCallback((key: SortKey) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc')  return { key, dir: 'desc' };
      return { key: null, dir: 'none' };
    });
  }, []);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, tx: Transaction) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSelectedTx(tx);
      }
    },
    []
  );

  const handleHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, key: SortKey) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort(key);
      }
    },
    [handleSort]
  );

  // Derived data
  const rpp    = parseInt(rowsPerPage, 10);
  const sorted = sort.key
    ? [...transactions].sort((a, b) => {
        const cmp = compareValues(a, b, sort.key!);
        return sort.dir === 'asc' ? cmp : -cmp;
      })
    : transactions;

  const totalPages  = Math.max(1, Math.ceil(sorted.length / rpp));
  const safePage    = Math.min(page, totalPages);
  const pageStart   = (safePage - 1) * rpp;
  const pageEnd     = Math.min(pageStart + rpp, sorted.length);
  const pageRows    = sorted.slice(pageStart, pageEnd);

  const isFirstPage = safePage === 1;
  const isLastPage  = safePage === totalPages;

  const ariaSortAttr = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sort.key !== key) return 'none';
    if (sort.dir === 'asc')  return 'ascending';
    if (sort.dir === 'desc') return 'descending';
    return 'none';
  };

  // ── Pending rows (functional state) ────────────────────────────────────────
  const pendingRows    = transactions.filter(t => t.status === 'pending');
  const hasPendingRows = pendingRows.length > 0;

  // ── Skeleton rows for loading transitions ──────────────────────────────────
  const skeletonRows = Array.from({ length: 5 });

  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'date',          label: 'Date' },
    { key: 'amount',        label: 'Amount' },
    { key: 'status',        label: 'Status' },
    { key: 'merchant',      label: 'Merchant' },
    { key: 'paymentMethod', label: 'Payment Method' },
  ];

  return (
    <>
      <style>{`
        /* ── Visually-hidden ── */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }

        /* ── Table wrapper ── */
        .tx-table-wrapper {
          font-family: var(--font-family-sans);
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }

        /* ── Scroll container for narrow viewports ── */
        .tx-scroll-container {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Table ── */
        .tx-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
        }

        /* ── Column headers ── */
        .tx-th {
          padding: var(--spacing-3) var(--spacing-4);
          text-align: left;
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-xs);
          color: var(--color-muted-foreground);
          background: var(--color-neutral-100);
          border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
          user-select: none;
          min-height: 44px;
        }

        /* ── Sortable header ── */
        .tx-th-sortable {
          cursor: pointer;
          outline: none;
        }
        .tx-th-sortable:hover {
          background: var(--color-neutral-200);
          color: var(--color-foreground);
        }
        /* sorted-asc / sorted-desc active state */
        .tx-th-sortable[aria-sort='ascending'],
        .tx-th-sortable[aria-sort='descending'] {
          background: var(--color-neutral-200);
          color: var(--color-brand-primary);
        }
        /* focus-visible on column header */
        .tx-th-sortable:focus-visible {
          outline: 2px solid var(--color-focus-ring);
          outline-offset: -2px;
          background: var(--color-neutral-200);
        }

        /* ── Table rows ── */
        .tx-tr {
          border-bottom: 1px solid var(--color-border-subtle);
          transition: background 120ms ease;
          cursor: pointer;
          outline: none;
          min-height: 44px;
        }
        /* hover state */
        .tx-tr:hover {
          background: var(--color-neutral-100);
        }
        /* focus-visible state */
        .tx-tr:focus-visible {
          outline: 2px solid var(--color-focus-ring);
          outline-offset: -2px;
          background: var(--color-neutral-100);
        }
        .tx-tr:last-child {
          border-bottom: none;
        }

        /* ── Cells ── */
        .tx-td {
          padding: var(--spacing-3) var(--spacing-4);
          vertical-align: middle;
          min-height: 44px;
        }

        /* ── Amount ── */
        .tx-amount {
          font-family: var(--font-family-mono);
          font-weight: var(--font-weight-medium);
          white-space: nowrap;
        }
        .tx-amount--positive { color: var(--color-success); }
        .tx-amount--negative { color: var(--color-danger); }

        /* ── Date / secondary text ── */
        .tx-date {
          color: var(--color-muted-foreground);
          font-size: var(--font-size-sm);
          white-space: nowrap;
        }

        /* ── Payment method cell ── */
        .tx-payment {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          color: var(--color-muted-foreground);
          font-size: var(--font-size-sm);
        }

        /* ── Pending banner ── */
        .tx-pending-banner {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-3) var(--spacing-4);
          background: #FFF8EC;
          border-bottom: 1px solid var(--color-border);
          font-size: var(--font-size-sm);
          color: var(--color-warning);
          font-weight: var(--font-weight-medium);
        }

        /* ── State containers ── */
        .tx-state-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-12) var(--spacing-8);
          gap: var(--spacing-4);
          text-align: center;
        }
        .tx-state-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-foreground);
          margin: 0;
        }
        .tx-state-desc {
          font-size: var(--font-size-sm);
          color: var(--color-muted-foreground);
          margin: 0;
        }

        /* ── Pagination ── */
        .tx-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          border-top: 1px solid var(--color-border);
          background: var(--color-neutral-100);
        }
        .tx-pagination-info {
          font-size: var(--font-size-sm);
          color: var(--color-muted-foreground);
        }
        .tx-pagination-controls {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }
        .tx-pagination-page {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-foreground);
          min-width: 80px;
          text-align: center;
        }

        /* ── Table heading (visually hidden, focus target) ── */
        .tx-heading {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }
        .tx-heading:focus {
          position: static;
          width: auto;
          height: auto;
          clip: auto;
          margin: 0;
          overflow: visible;
          white-space: normal;
          outline: 2px solid var(--color-focus-ring);
          outline-offset: 2px;
          padding: var(--spacing-2) var(--spacing-4);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-brand-primary);
        }

        /* ── Responsive ── */
        @media (max-width: 767px) {
          .tx-th, .tx-td {
            padding: var(--spacing-2) var(--spacing-3);
          }
          .tx-col-paymentMethod {
            display: none;
          }
        }
      `}</style>

      {/* Visually-hidden focus target to receive focus after sort/page changes */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="tx-heading"
        aria-live="polite"
      >
        Transactions table
      </h2>

      <div className="tx-table-wrapper">

        {/* ── Pending banner (functional: pending state) ── */}
        {hasPendingRows && !isLoading && !error && (
          <div className="tx-pending-banner" role="status" aria-live="polite">
            <Icon name="alert" size="sm" aria-hidden />
            <span>
              {pendingRows.length} transaction{pendingRows.length !== 1 ? 's' : ''} pending
              &nbsp;— processing may take a few minutes.
            </span>
          </div>
        )}

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="tx-state-container" role="status" aria-live="polite">
            <Spinner size="md" label="Loading transactions" />
            <p className="tx-state-desc">Loading transactions…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {!isLoading && error && (
          <div className="tx-state-container" role="alert">
            <Icon name="alert" size="lg" aria-label="Error loading transactions" />
            <p className="tx-state-title">Failed to load transactions</p>
            <p className="tx-state-desc">{error}</p>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !error && transactions.length === 0 && (
          <div
            className="tx-state-container"
            role="status"
            aria-live="polite"
            aria-label="No transactions found"
          >
            <Icon name="info" size="lg" aria-hidden />
            <p className="tx-state-title">No transactions found</p>
            <p className="tx-state-desc">Try adjusting your filters or date range.</p>
          </div>
        )}

        {/* ── Table ── */}
        {!isLoading && !error && transactions.length > 0 && (
          <>
            <div className="tx-scroll-container">
              <table
                ref={tableRef}
                className="tx-table"
                aria-label="Transactions"
              >
                <caption style={srOnly}>Transactions</caption>
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`tx-th tx-th-sortable tx-col-${col.key}`}
                        aria-sort={ariaSortAttr(col.key)}
                        tabIndex={0}
                        onClick={() => handleSort(col.key)}
                        onKeyDown={e => handleHeaderKeyDown(e, col.key)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {col.label}
                          <SortIcon columnKey={col.key} sort={sort} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map(tx => {
                    const isPending   = tx.status === 'pending';
                    const isCompleted = tx.status === 'completed';
                    const isFailed    = tx.status === 'failed';
                    const isRefunded  = tx.status === 'refunded';

                    return (
                      <tr
                        key={tx.id}
                        className="tx-tr"
                        tabIndex={0}
                        role="button"
                        aria-label={`View transaction from ${tx.merchant} on ${formatDate(tx.date)}, ${formatAmount(tx.amount, tx.currency)}, status: ${STATUS_LABEL[tx.status]}`}
                        onClick={() => setSelectedTx(tx)}
                        onKeyDown={e => handleRowKeyDown(e, tx)}
                        // Pending row: subtle left border accent
                        style={isPending ? { borderLeft: '3px solid var(--color-warning)' } : undefined}
                      >
                        {/* Date */}
                        <td className="tx-td tx-col-date">
                          <span className="tx-date">{formatDate(tx.date)}</span>
                        </td>

                        {/* Amount — prefix with +/− symbol, never colour-only */}
                        <td className="tx-td tx-col-amount">
                          <span
                            className={`tx-amount ${
                              tx.amount >= 0 ? 'tx-amount--positive' : 'tx-amount--negative'
                            }`}
                          >
                            {formatAmount(tx.amount, tx.currency)}
                          </span>
                        </td>

                        {/* Status — Badge + visually-hidden text for SR */}
                        <td className="tx-td tx-col-status">
                          {/* Functional states: pending / completed / failed / refunded */}
                          {isPending && (
                            <Badge variant="warning">
                              {STATUS_LABEL.pending}
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge variant="success">
                              {STATUS_LABEL.completed}
                            </Badge>
                          )}
                          {isFailed && (
                            <Badge variant="danger">
                              {STATUS_LABEL.failed}
                            </Badge>
                          )}
                          {isRefunded && (
                            <Badge variant="info">
                              {STATUS_LABEL.refunded}
                            </Badge>
                          )}
                          {/* SR-only text so status is not conveyed by colour alone */}
                          <span style={srOnly}>{STATUS_LABEL[tx.status]}</span>
                        </td>

                        {/* Merchant */}
                        <td className="tx-td tx-col-merchant">
                          <span style={{ fontWeight: 'var(--font-weight-medium)' as React.CSSProperties['fontWeight'] }}>
                            {tx.merchant}
                          </span>
                        </td>

                        {/* Payment method */}
                        <td className="tx-td tx-col-paymentMethod">
                          <span className="tx-payment">
                            <Icon
                              name={PAYMENT_ICON[tx.paymentMethod]}
                              size="sm"
                              aria-hidden
                            />
                            <span>{PAYMENT_LABEL[tx.paymentMethod]}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="tx-pagination">
              <span className="tx-pagination-info">
                Showing {pageStart + 1}–{pageEnd} of {sorted.length} transactions
              </span>

              <div className="tx-pagination-controls">
                {/* Rows per page */}
                <Select
                  label="Rows per page"
                  value={rowsPerPage}
                  onChange={setRowsPerPage}
                  options={ROWS_PER_PAGE_OPTIONS}
                />

                {/* Previous page — disabled on first page */}
                <IconButton
                  variant="ghost"
                  size="md"
                  icon={<Icon name="chevron-left" size="sm" aria-hidden />}
                  aria-label={isFirstPage ? 'Disabled — no previous page' : 'Previous page'}
                  disabled={isFirstPage}
                  onClick={() => !isFirstPage && setPage(p => p - 1)}
                />

                <span className="tx-pagination-page" aria-live="polite" aria-atomic="true">
                  Page {safePage} of {totalPages}
                </span>

                {/* Next page — disabled on last page */}
                <IconButton
                  variant="ghost"
                  size="md"
                  icon={<Icon name="chevron-right" size="sm" aria-hidden />}
                  aria-label={isLastPage ? 'Disabled — no next page' : 'Next page'}
                  disabled={isLastPage}
                  onClick={() => !isLastPage && setPage(p => p + 1)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Transaction detail modal ── */}
      {selectedTx && (
        <Modal
          open={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title="Transaction Details"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--spacing-4)',
              fontFamily: 'var(--font-family-sans)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {([
              ['Date',           formatDate(selectedTx.date)],
              ['Amount',         formatAmount(selectedTx.amount, selectedTx.currency)],
              ['Status',         STATUS_LABEL[selectedTx.status]],
              ['Merchant',       selectedTx.merchant],
              ['Payment Method', PAYMENT_LABEL[selectedTx.paymentMethod]],
              ['Transaction ID', selectedTx.id],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <dt
                  style={{
                    color: 'var(--color-muted-foreground)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginBottom: 'var(--spacing-1)',
                  }}
                >
                  {label}
                </dt>
                <dd
                  style={{
                    color: 'var(--color-foreground)',
                    fontWeight: 'var(--font-weight-semibold)',
                    margin: 0,
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
};

export default TransactionTable;
