// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Badge,
  Button,
  IconButton,
  Select,
  Skeleton,
  Spinner,
  Icon,
  Modal,
} from '@unlimit/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'visa' | 'mastercard' | 'amex';
export type SortDirection = 'asc' | 'desc';
export type SortColumn = 'date' | 'amount' | 'status' | 'merchant' | 'method';

export interface Transaction {
  id: string;
  date: string;          // ISO 8601
  amount: number;        // in cents
  currency: string;      // e.g. 'USD'
  status: TransactionStatus;
  merchant: string;
  method: PaymentMethod;
  cardLast4: string;
}

interface TransactionTableProps {
  /** Async loader — receives page/size/sort and returns data + total count */
  fetchTransactions: (params: {
    page: number;
    pageSize: number;
    sortColumn: SortColumn;
    sortDirection: SortDirection;
  }) => Promise<{ data: Transaction[]; total: number }>;
  /** Optional: called when a row is clicked */
  onRowClick?: (transaction: Transaction) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<
  TransactionStatus,
  'warning' | 'success' | 'danger' | 'neutral'
> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
};

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'method', label: 'Payment Method' },
];

// ─── Skeleton rows ────────────────────────────────────────────────────────────

const SKELETON_WIDTHS: Record<SortColumn, string> = {
  date: '90px',
  amount: '70px',
  status: '80px',
  merchant: '120px',
  method: '100px',
};

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {COLUMNS.map((col) => (
            <td key={col.key} style={styles.td}>
              <Skeleton variant="rect" width={SKELETON_WIDTHS[col.key]} height={16} />
            </td>
          ))}
          {/* chevron cell */}
          <td style={styles.td}>
            <Skeleton variant="rect" width={16} height={16} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransactionTable({
  fetchTransactions,
  onRowClick,
}: TransactionTableProps) {
  // ── State ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaginationLoading, setIsPaginationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);

  const isLoading = isInitialLoading || isPaginationLoading;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstPage = page === 1;
  const isLastPage = page >= totalPages;

  // Track whether this is the very first fetch
  const hasFetchedOnce = useRef(false);

  // ── Data fetching ──
  const load = useCallback(
    async (opts: {
      page: number;
      pageSize: number;
      sortColumn: SortColumn;
      sortDirection: SortDirection;
      initial?: boolean;
    }) => {
      try {
        if (opts.initial) {
          setIsInitialLoading(true);
        } else {
          setIsPaginationLoading(true);
        }
        setError(null);

        const result = await fetchTransactions({
          page: opts.page,
          pageSize: opts.pageSize,
          sortColumn: opts.sortColumn,
          sortDirection: opts.sortDirection,
        });

        setTransactions(result.data);
        setTotal(result.total);
      } catch {
        setError('Failed to load transactions. Please try again.');
      } finally {
        setIsInitialLoading(false);
        setIsPaginationLoading(false);
      }
    },
    [fetchTransactions]
  );

  useEffect(() => {
    if (!hasFetchedOnce.current) {
      hasFetchedOnce.current = true;
      load({ page, pageSize, sortColumn, sortDirection, initial: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sort handler ──
  const handleSort = (col: SortColumn) => {
    const newDir: SortDirection =
      sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col);
    setSortDirection(newDir);
    setPage(1);
    load({ page: 1, pageSize, sortColumn: col, sortDirection: newDir });
  };

  // ── Pagination handlers ──
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load({ page: newPage, pageSize, sortColumn, sortDirection });
  };

  const handlePageSizeChange = (val: string) => {
    const newSize = Number(val);
    setPageSize(newSize);
    setPage(1);
    load({ page: 1, pageSize: newSize, sortColumn, sortDirection });
  };

  // ── Row interaction ──
  const handleRowClick = (tx: Transaction) => {
    setDetailTransaction(tx);
    onRowClick?.(tx);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, tx: Transaction) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(tx);
    }
  };

  // ── Aria sort ──
  const ariaSortFor = (col: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (sortColumn !== col) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  // ── Render ──
  const isEmpty = !isInitialLoading && !error && transactions.length === 0;

  // Pending transactions (functional state)
  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending');
  const hasPending = pendingTransactions.length > 0;

  return (
    <>
      <style>{CSS}</style>

      <div style={styles.wrapper}>
        {/* Pending banner — functional state */}
        {hasPending && !isLoading && (
          <div
            role="status"
            aria-live="polite"
            style={styles.pendingBanner}
          >
            <Icon name="info" size="sm" aria-hidden="true" />
            <span>
              {pendingTransactions.length} transaction
              {pendingTransactions.length > 1 ? 's are' : ' is'} pending
              processing.
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div role="alert" style={styles.errorBanner}>
            <Icon name="alert" size="sm" aria-label="Error" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                load({ page, pageSize, sortColumn, sortDirection, initial: true })
              }
            >
              Retry
            </Button>
          </div>
        )}

        {/* Table container — overflow-x for responsive horizontal scroll */}
        <div
          style={styles.tableContainer}
          aria-busy={isLoading}
        >
          {/* Pagination loading overlay */}
          {isPaginationLoading && (
            <div style={styles.paginationOverlay} aria-hidden="true">
              <Spinner size="md" label="Loading transactions" />
            </div>
          )}

          <table
            style={styles.table}
            aria-label="Transactions"
            aria-busy={isLoading}
          >
            <caption style={styles.caption}>Transactions</caption>

            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isActive = sortColumn === col.key;
                  const dir = sortDirection;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={ariaSortFor(col.key)}
                      style={{
                        ...styles.th,
                        ...(isActive ? styles.thActive : {}),
                      }}
                    >
                      <button
                        className="sort-btn"
                        style={{
                          ...styles.sortBtn,
                          ...(isActive ? styles.sortBtnActive : {}),
                        }}
                        onClick={() => handleSort(col.key)}
                        aria-label={`Sort by ${col.label} ${
                          isActive
                            ? dir === 'asc'
                              ? 'descending'
                              : 'ascending'
                            : 'ascending'
                        }`}
                      >
                        <span>{col.label}</span>
                        <span
                          style={{
                            ...styles.sortIcon,
                            ...(isActive ? styles.sortIconActive : {}),
                            ...(isActive && dir === 'asc'
                              ? styles.sortIconAsc
                              : {}),
                          }}
                          aria-hidden="true"
                        >
                          <Icon
                            name="chevron-down"
                            size="sm"
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                    </th>
                  );
                })}
                {/* Drill-down affordance column */}
                <th scope="col" style={{ ...styles.th, width: '32px' }}>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Initial loading — skeleton rows */}
              {isInitialLoading && <SkeletonRows count={8} />}

              {/* Empty state */}
              {isEmpty && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    style={styles.emptyCell}
                    aria-live="polite"
                  >
                    <div style={styles.emptyContent}>
                      <Icon name="info" size="lg" aria-hidden="true" />
                      <p style={styles.emptyText}>No transactions found.</p>
                      <p style={styles.emptySubText}>
                        Try adjusting your filters or check back later.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isInitialLoading &&
                !isEmpty &&
                transactions.map((tx) => {
                  const isPending = tx.status === 'pending';
                  const isCompleted = tx.status === 'completed';
                  const isFailed = tx.status === 'failed';
                  const isRefunded = tx.status === 'refunded';

                  return (
                    <tr
                      key={tx.id}
                      className="tx-row"
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for transaction from ${
                        tx.merchant
                      } on ${formatDate(tx.date)}, ${
                        formatAmount(tx.amount, tx.currency)
                      }, status: ${STATUS_LABEL[tx.status]}`}
                      onClick={() => handleRowClick(tx)}
                      onKeyDown={(e) => handleRowKeyDown(e, tx)}
                      data-status={tx.status}
                      data-pending={isPending ? 'true' : undefined}
                      data-completed={isCompleted ? 'true' : undefined}
                      data-failed={isFailed ? 'true' : undefined}
                      data-refunded={isRefunded ? 'true' : undefined}
                    >
                      {/* Date */}
                      <td style={styles.td}>
                        <span style={styles.cellText}>{formatDate(tx.date)}</span>
                      </td>

                      {/* Amount */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.cellText,
                            ...styles.amountText,
                            ...(isFailed ? styles.amountFailed : {}),
                          }}
                          aria-label={`${formatAmount(tx.amount, tx.currency)} ${tx.currency}`}
                        >
                          {formatAmount(tx.amount, tx.currency)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={styles.td}>
                        {/* Visually hidden status for screen readers in context */}
                        <span className="sr-only">Status: {STATUS_LABEL[tx.status]}</span>
                        <Badge variant={STATUS_BADGE_VARIANT[tx.status]} aria-hidden="true">
                          {STATUS_LABEL[tx.status]}
                        </Badge>
                      </td>

                      {/* Merchant */}
                      <td style={styles.td}>
                        <span style={styles.cellText}>{tx.merchant}</span>
                      </td>

                      {/* Payment Method */}
                      <td style={styles.td}>
                        <span style={styles.methodCell}>
                          <Icon
                            name={tx.method}
                            size="sm"
                            aria-hidden="true"
                          />
                          <span style={styles.cellText}>
                            {METHOD_LABEL[tx.method]} ···· {tx.cardLast4}
                          </span>
                        </span>
                      </td>

                      {/* Drill-down chevron */}
                      <td style={{ ...styles.td, ...styles.chevronCell }}>
                        <Icon
                          name="chevron-right"
                          size="sm"
                          aria-hidden="true"
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isInitialLoading && !error && (
          <div style={styles.pagination}>
            {/* Rows per page */}
            <div style={styles.pageSizeControl}>
              <Select
                label="Rows per page"
                value={String(pageSize)}
                onChange={handlePageSizeChange}
                options={PAGE_SIZE_OPTIONS}
                disabled={isLoading}
              />
            </div>

            {/* Page info */}
            <span style={styles.pageInfo} aria-live="polite">
              Page {page} of {totalPages}
              {total > 0 && (
                <span style={styles.totalInfo}>
                  &nbsp;({total} total)
                </span>
              )}
            </span>

            {/* Prev / Next */}
            <div style={styles.pageControls}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon name="chevron-left" size="sm" aria-hidden="true" />}
                aria-label={`Go to previous page, currently on page ${page} of ${totalPages}`}
                disabled={isFirstPage || isLoading}
                onClick={() => handlePageChange(page - 1)}
              />
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon name="chevron-right" size="sm" aria-hidden="true" />}
                aria-label={`Go to next page, currently on page ${page} of ${totalPages}`}
                disabled={isLastPage || isLoading}
                onClick={() => handlePageChange(page + 1)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction detail modal */}
      {detailTransaction && (
        <Modal
          open={!!detailTransaction}
          onClose={() => setDetailTransaction(null)}
          title={`Transaction — ${detailTransaction.merchant}`}
        >
          <div style={styles.modalContent}>
            <dl style={styles.detailList}>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Date</dt>
                <dd style={styles.detailValue}>{formatDate(detailTransaction.date)}</dd>
              </div>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Amount</dt>
                <dd
                  style={styles.detailValue}
                  aria-label={`${formatAmount(detailTransaction.amount, detailTransaction.currency)} ${detailTransaction.currency}`}
                >
                  {formatAmount(detailTransaction.amount, detailTransaction.currency)}
                </dd>
              </div>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Status</dt>
                <dd style={styles.detailValue}>
                  <span className="sr-only">Status: {STATUS_LABEL[detailTransaction.status]}</span>
                  <Badge variant={STATUS_BADGE_VARIANT[detailTransaction.status]} aria-hidden="true">
                    {STATUS_LABEL[detailTransaction.status]}
                  </Badge>
                </dd>
              </div>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Merchant</dt>
                <dd style={styles.detailValue}>{detailTransaction.merchant}</dd>
              </div>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Payment Method</dt>
                <dd style={styles.detailValue}>
                  <span style={styles.methodCell}>
                    <Icon name={detailTransaction.method} size="sm" aria-hidden="true" />
                    <span>
                      {METHOD_LABEL[detailTransaction.method]} ···· {detailTransaction.cardLast4}
                    </span>
                  </span>
                </dd>
              </div>
              <div style={styles.detailRow}>
                <dt style={styles.detailLabel}>Transaction ID</dt>
                <dd style={{ ...styles.detailValue, ...styles.monoText }}>{detailTransaction.id}</dd>
              </div>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-4)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-foreground)',
  },
  pendingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: '#FFF8EC',
    border: '1px solid var(--color-warning)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-900)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: '#FFF0F0',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-danger)',
  },
  tableContainer: {
    position: 'relative',
    overflowX: 'auto',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
    backgroundColor: 'var(--color-background)',
  },
  paginationOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    zIndex: 10,
    borderRadius: 'var(--radius-lg)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--font-size-sm)',
    minWidth: '640px',
  },
  caption: {
    // Visually hidden but available to screen readers
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
  th: {
    padding: 'var(--spacing-3) var(--spacing-4)',
    textAlign: 'left',
    fontWeight: 'var(--font-weight-semibold)' as unknown as number,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-600)',
    backgroundColor: 'var(--color-neutral-100)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  thActive: {
    color: 'var(--color-brand-primary)',
    backgroundColor: '#ECEEFF',
  },
  sortBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)' as unknown as number,
    color: 'var(--color-neutral-600)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    transition: 'color 0.15s ease',
  },
  sortBtnActive: {
    color: 'var(--color-brand-primary)',
  },
  sortIcon: {
    display: 'inline-flex',
    opacity: 0.35,
    transition: 'opacity 0.15s ease, transform 0.2s ease',
    transform: 'rotate(0deg)',
  },
  sortIconActive: {
    opacity: 1,
  },
  sortIconAsc: {
    transform: 'rotate(180deg)',
  },
  td: {
    padding: 'var(--spacing-3) var(--spacing-4)',
    borderBottom: '1px solid var(--color-border-subtle)',
    verticalAlign: 'middle',
    minHeight: '44px',
  },
  cellText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-regular)' as unknown as number,
    color: 'var(--color-foreground)',
    lineHeight: 'var(--line-height-normal)',
  },
  amountText: {
    fontWeight: 'var(--font-weight-medium)' as unknown as number,
    fontFamily: 'var(--font-family-mono)',
  },
  amountFailed: {
    color: 'var(--color-danger)',
    textDecoration: 'line-through',
  },
  methodCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
  },
  chevronCell: {
    color: 'var(--color-neutral-400)',
    textAlign: 'right',
  },
  emptyCell: {
    padding: 'var(--spacing-12) var(--spacing-4)',
    textAlign: 'center',
  },
  emptyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    color: 'var(--color-neutral-400)',
  },
  emptyText: {
    margin: 0,
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-medium)' as unknown as number,
    color: 'var(--color-neutral-600)',
  },
  emptySubText: {
    margin: 0,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-400)',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 'var(--spacing-4)',
    flexWrap: 'wrap',
  },
  pageSizeControl: {
    minWidth: '120px',
  },
  pageInfo: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-600)',
    whiteSpace: 'nowrap',
  },
  totalInfo: {
    color: 'var(--color-neutral-400)',
  },
  pageControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
  },
  modalContent: {
    padding: 'var(--spacing-4) 0',
  },
  detailList: {
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-3)',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--spacing-2) 0',
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  detailLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)' as unknown as number,
    color: 'var(--color-neutral-600)',
  },
  detailValue: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-foreground)',
    textAlign: 'right',
  },
  monoText: {
    fontFamily: 'var(--font-family-mono)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-600)',
  },
};

// ─── CSS (injected via <style>) ───────────────────────────────────────────────
// Handles: row hover, row focus-visible, sort-btn hover, sort-btn focus-visible,
// disabled pagination, active sort column highlight, sr-only utility.

const CSS = `
  /* Screen-reader only utility */
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

  /* ── Row: hover state ── */
  .tx-row:hover {
    background-color: var(--color-neutral-100);
    cursor: pointer;
  }

  /* ── Row: focus-visible state ── */
  .tx-row:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: -2px;
    background-color: var(--color-neutral-100);
  }

  /* ── Row: ensure minimum 44px touch target height ── */
  .tx-row td {
    min-height: 44px;
  }

  /* ── Sort button: hover state ── */
  .sort-btn:hover {
    color: var(--color-brand-primary-hover);
  }
  .sort-btn:hover span[aria-hidden] {
    opacity: 0.7;
  }

  /* ── Sort button: focus-visible state ── */
  .sort-btn:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  /* ── Disabled pagination IconButton ── */
  button[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ── Active sort column: th background ── */
  th[aria-sort='ascending'],
  th[aria-sort='descending'] {
    background-color: #ECEEFF;
    color: var(--color-brand-primary);
  }

  /* ── Responsive: hide payment method column on narrow screens ── */
  @media (max-width: 600px) {
    .col-method {
      display: none;
    }
  }
`;

export default TransactionTable;
