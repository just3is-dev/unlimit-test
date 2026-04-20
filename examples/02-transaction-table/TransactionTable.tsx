import React, { useState, useCallback, KeyboardEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  Icon,
  IconButton,
  Modal,
  Select,
  Skeleton,
  Spinner,
} from '@unlimit/ui';
import styles from './TransactionTable.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'visa' | 'mastercard' | 'amex' | 'other';

export interface Transaction {
  id: string;
  date: string;           // ISO-8601
  amount: number;
  currency: string;       // e.g. 'USD'
  status: TransactionStatus;
  merchant: string;
  paymentMethod: PaymentMethod;
  last4?: string;
}

type SortKey = 'date' | 'amount' | 'status' | 'merchant' | 'paymentMethod';
type SortDir = 'asc' | 'desc' | 'none';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface TransactionTableProps {
  /** All transactions to display (consumer handles data fetching) */
  transactions?: Transaction[];
  /** True while the initial data is being fetched */
  isLoading?: boolean;
  /** True while a sort / page change is in-flight */
  isFetching?: boolean;
  /** Non-null string triggers the error state */
  error?: string | null;
  /** Called when the user wants to retry after an error */
  onRetry?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<TransactionStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending:   'warning',
  completed: 'success',
  failed:    'danger',
  refunded:  'neutral',
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending:   'Pending',
  completed: 'Completed',
  failed:    'Failed',
  refunded:  'Refunded',
};

const PAYMENT_ICON_NAME: Record<PaymentMethod, 'visa' | 'mastercard' | 'amex' | null> = {
  visa:       'visa',
  mastercard: 'mastercard',
  amex:       'amex',
  other:      null,
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  visa:       'Visa',
  mastercard: 'Mastercard',
  amex:       'Amex',
  other:      'Other',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function sortTransactions(txns: Transaction[], sort: SortState): Transaction[] {
  if (sort.dir === 'none') return txns;
  return [...txns].sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case 'date':          cmp = a.date.localeCompare(b.date); break;
      case 'amount':        cmp = a.amount - b.amount; break;
      case 'status':        cmp = a.status.localeCompare(b.status); break;
      case 'merchant':      cmp = a.merchant.localeCompare(b.merchant); break;
      case 'paymentMethod': cmp = a.paymentMethod.localeCompare(b.paymentMethod); break;
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

const ROWS_PER_PAGE_OPTIONS = [
  { value: '25',  label: '25' },
  { value: '50',  label: '50' },
  { value: '100', label: '100' },
];

const SKELETON_ROW_COUNT = 6;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SortButtonProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortState;
  onSort: (key: SortKey) => void;
}

const SortButton: React.FC<SortButtonProps> = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort.key === sortKey && currentSort.dir !== 'none';
  const ariaSortMap: Record<SortDir, 'ascending' | 'descending' | 'none'> = {
    asc:  'ascending',
    desc: 'descending',
    none: 'none',
  };
  const ariaSort = isActive ? ariaSortMap[currentSort.dir] : 'none';

  const iconName =
    isActive && currentSort.dir === 'asc' ? 'chevron-right' : 'chevron-down';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={styles.th}
    >
      <button
        type="button"
        className={`${styles.sortBtn} ${isActive ? styles.sortBtnActive : ''}`}
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${
          isActive
            ? currentSort.dir === 'asc'
              ? ', currently ascending'
              : ', currently descending'
            : ''
        }`}
      >
        <span>{label}</span>
        <Icon
          name={iconName}
          size="sm"
          aria-hidden
          // Rotate icon for ascending state via CSS class
        />
      </button>
    </th>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions = [],
  isLoading = false,
  isFetching = false,
  error = null,
  onRetry,
}) => {
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState('25');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const rpp = parseInt(rowsPerPage, 10);

  // Sort
  const sorted = sortTransactions(transactions, sort);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / rpp));
  const pageRows = sorted.slice((page - 1) * rpp, page * rpp);

  const handleSort = useCallback((key: SortKey) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc')  return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'none' };
      return { key, dir: 'asc' };
    });
    setPage(1);
  }, []);

  const handleRowsPerPageChange = (val: string) => {
    setRowsPerPage(val);
    setPage(1);
  };

  const openModal = (tx: Transaction) => setSelectedTx(tx);
  const closeModal = () => setSelectedTx(null);

  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, tx: Transaction) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(tx);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  const renderSkeletonRows = () =>
    Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
      <tr key={i} className={styles.skeletonRow}>
        {[120, 80, 90, 140, 100].map((w, j) => (
          <td key={j} className={styles.td}>
            <Skeleton variant="rect" width={w} height={16} />
          </td>
        ))}
      </tr>
    ));

  const renderEmptyState = () => (
    <tr>
      <td colSpan={5} className={styles.emptyCell}>
        <div className={styles.emptyState} role="status">
          <Icon name="info" size="lg" aria-hidden />
          <p className={styles.emptyText}>No transactions found.</p>
          <p className={styles.emptySubtext}>Try adjusting your filters or check back later.</p>
        </div>
      </td>
    </tr>
  );

  const renderErrorState = () => (
    <tr>
      <td colSpan={5} className={styles.emptyCell}>
        <div className={styles.errorState} role="alert">
          <Icon name="alert" size="lg" aria-hidden />
          <p className={styles.errorText}>Failed to load transactions.</p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderRows = () =>
    pageRows.map(tx => {
      const iconName = PAYMENT_ICON_NAME[tx.paymentMethod];
      return (
        <tr
          key={tx.id}
          className={styles.row}
          role="button"
          tabIndex={0}
          aria-label={`View transaction from ${tx.merchant} on ${formatDate(tx.date)}`}
          onClick={() => openModal(tx)}
          onKeyDown={e => handleRowKeyDown(e, tx)}
        >
          {/* Date */}
          <td className={styles.td}>
            <span>{formatDate(tx.date)}</span>
          </td>

          {/* Amount */}
          <td className={styles.td}>
            <span
              aria-label={`${tx.currency} ${tx.amount.toFixed(2)}`}
              className={styles.amount}
            >
              {formatAmount(tx.amount, tx.currency)}
            </span>
          </td>

          {/* Status */}
          <td className={styles.td}>
            <Badge variant={STATUS_BADGE_VARIANT[tx.status]}>
              {STATUS_LABEL[tx.status]}
            </Badge>
            <span className={styles.srOnly}>Status: {STATUS_LABEL[tx.status]}</span>
          </td>

          {/* Merchant */}
          <td className={styles.td}>
            <span className={styles.merchant}>{tx.merchant}</span>
          </td>

          {/* Payment Method */}
          <td className={styles.td}>
            <span className={styles.paymentMethod}>
              {iconName && (
                <Icon name={iconName} size="sm" aria-hidden />
              )}
              <span>{PAYMENT_LABEL[tx.paymentMethod]}</span>
              {tx.last4 && (
                <span
                  className={styles.last4}
                  aria-label={`ending in ${tx.last4}`}
                >
                  ···· {tx.last4}
                </span>
              )}
            </span>
          </td>
        </tr>
      );
    });

  // ── Modal content ──────────────────────────────────────────────────────────

  const renderModalContent = () => {
    if (!selectedTx) return null;
    const tx = selectedTx;
    const iconName = PAYMENT_ICON_NAME[tx.paymentMethod];
    return (
      <div className={styles.modalBody}>
        <dl className={styles.detailGrid}>
          <dt>Date</dt>
          <dd>{formatDate(tx.date)}</dd>

          <dt>Merchant</dt>
          <dd>{tx.merchant}</dd>

          <dt>Amount</dt>
          <dd>
            <span aria-label={`${tx.currency} ${tx.amount.toFixed(2)}`}>
              {formatAmount(tx.amount, tx.currency)}
            </span>
          </dd>

          <dt>Status</dt>
          <dd>
            <Badge variant={STATUS_BADGE_VARIANT[tx.status]}>
              {STATUS_LABEL[tx.status]}
            </Badge>
          </dd>

          <dt>Payment Method</dt>
          <dd>
            <span className={styles.paymentMethod}>
              {iconName && <Icon name={iconName} size="sm" aria-hidden />}
              <span>{PAYMENT_LABEL[tx.paymentMethod]}</span>
              {tx.last4 && (
                <span
                  className={styles.last4}
                  aria-label={`ending in ${tx.last4}`}
                >
                  ···· {tx.last4}
                </span>
              )}
            </span>
          </dd>

          <dt>Transaction ID</dt>
          <dd className={styles.txId}>{tx.id}</dd>
        </dl>
      </div>
    );
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const isInitialLoading = isLoading && transactions.length === 0;
  const isEmpty = !isLoading && !error && transactions.length === 0;

  return (
    <>
      <Card padding="lg">
        {/* Fetching overlay spinner */}
        {isFetching && !isInitialLoading && (
          <div className={styles.fetchingBar} role="status" aria-live="polite">
            <Spinner size="sm" label="Loading transactions" />
            <span className={styles.fetchingLabel}>Updating…</span>
          </div>
        )}

        {/* Scroll container for horizontal overflow */}
        <div
          className={styles.tableWrapper}
          aria-busy={isInitialLoading || isFetching}
        >
          <table className={styles.table} aria-label="Transactions">
            <thead>
              <tr>
                <SortButton label="Date"           sortKey="date"          currentSort={sort} onSort={handleSort} />
                <SortButton label="Amount"         sortKey="amount"        currentSort={sort} onSort={handleSort} />
                <SortButton label="Status"         sortKey="status"        currentSort={sort} onSort={handleSort} />
                <SortButton label="Merchant"       sortKey="merchant"      currentSort={sort} onSort={handleSort} />
                <SortButton label="Payment Method" sortKey="paymentMethod" currentSort={sort} onSort={handleSort} />
              </tr>
            </thead>

            <tbody>
              {isInitialLoading && renderSkeletonRows()}
              {error            && renderErrorState()}
              {isEmpty          && renderEmptyState()}
              {!isInitialLoading && !error && !isEmpty && renderRows()}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isInitialLoading && !error && transactions.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.rowsPerPage}>
              <Select
                label="Rows per page"
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                options={ROWS_PER_PAGE_OPTIONS}
              />
            </div>

            <span className={styles.pageInfo} aria-live="polite">
              Page {page} of {totalPages}
            </span>

            <div className={styles.pageControls}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon name="chevron-left" size="sm" aria-hidden />}
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              />
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon name="chevron-right" size="sm" aria-hidden />}
                aria-label="Next page"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Detail Modal */}
      <Modal
        open={selectedTx !== null}
        onClose={closeModal}
        title="Transaction Details"
      >
        {renderModalContent()}
      </Modal>
    </>
  );
};

export default TransactionTable;
