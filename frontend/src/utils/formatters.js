export const formatRupee = (paiseOrRupees, isPaise = true) => {
  if (paiseOrRupees === undefined || paiseOrRupees === null) return '₹0.00';
  const val = isPaise ? paiseOrRupees / 100 : paiseOrRupees;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatCompactRupee = (paiseOrRupees, isPaise = true) => {
  if (paiseOrRupees === undefined || paiseOrRupees === null) return '₹0';
  const val = isPaise ? paiseOrRupees / 100 : paiseOrRupees;
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toFixed(0)}`;
};

export const getEventTypeMeta = (type) => {
  const map = {
    payment_failed: {
      label: 'Payment Failed',
      dotColor: 'bg-[#E5484D]',
      textColor: 'text-[#E5484D]',
      statusClass: 'status-error',
      code: 'ERR_FAIL'
    },
    checkout_abandoned: {
      label: 'Cart Dropoff',
      dotColor: 'bg-[#F5A623]',
      textColor: 'text-[#F5A623]',
      statusClass: 'status-warning',
      code: 'ABANDON'
    },
    invoice_expired: {
      label: 'Invoice Expired',
      dotColor: 'bg-[#F5A623]',
      textColor: 'text-[#F5A623]',
      statusClass: 'status-warning',
      code: 'INV_EXP'
    },
    subscription_halted: {
      label: 'Mandate Halted',
      dotColor: 'bg-[#E5484D]',
      textColor: 'text-[#E5484D]',
      statusClass: 'status-error',
      code: 'SUB_HALT'
    },
    unknown: {
      label: 'Unknown Event',
      dotColor: 'bg-[#64748B]',
      textColor: 'text-[#64748B]',
      statusClass: 'status-info',
      code: 'UNKNOWN'
    },
  };
  return map[type] || map.unknown;
};

export const getStatusMeta = (status) => {
  const map = {
    new: {
      label: 'Ingested',
      dotColor: 'bg-[#3395FF]',
      textColor: 'text-[var(--ink-muted)]',
      statusClass: 'status-info',
      stage: 1
    },
    diagnosed: {
      label: 'Diagnosed',
      dotColor: 'bg-[#3395FF]',
      textColor: 'text-[var(--ink-muted)]',
      statusClass: 'status-info',
      stage: 2
    },
    action_selected: {
      label: 'Policy Selected',
      dotColor: 'bg-[#3395FF]',
      textColor: 'text-[var(--ink-muted)]',
      statusClass: 'status-info',
      stage: 3
    },
    action_executed: {
      label: 'Dispatched',
      dotColor: 'bg-[#F5A623]',
      textColor: 'text-[var(--ink-muted)]',
      statusClass: 'status-warning',
      stage: 4
    },
    verified: {
      label: 'Awaiting Settlement',
      dotColor: 'bg-[#3395FF]',
      textColor: 'text-[var(--ink-muted)]',
      statusClass: 'status-info',
      stage: 5
    },
    recovered: {
      label: 'Recovered',
      dotColor: 'bg-[#0F9D58]',
      textColor: 'text-[var(--status-success)]',
      statusClass: 'status-success',
      stage: 6
    },
    unrecoverable: {
      label: 'Unrecoverable',
      dotColor: 'bg-[#E5484D]',
      textColor: 'text-[var(--status-error)]',
      statusClass: 'status-error',
      stage: 6
    },
  };
  return map[status] || {
    label: status,
    dotColor: 'bg-[#64748B]',
    textColor: 'text-[var(--ink-muted)]',
    statusClass: 'status-info',
    stage: 1
  };
};

export const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    if (diffSeconds < 60) return `${Math.max(1, diffSeconds)}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
};
