import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface FeedbackItem {
  _id: string;
  userId: string;
  message: string;
  userName: string;
  userEmail: string;
  status: string; // 'pending' | 'read' | 'resolved'
  adminReply: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = ['all', 'pending', 'read', 'resolved'] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFF3E0', color: '#E65100' },
  read: { bg: '#E3F2FD', color: '#1565C0' },
  resolved: { bg: '#E8F5E9', color: '#2E7D32' },
};

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  /* Reply modal state */
  const [replying, setReplying] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('read');
  const [saving, setSaving] = useState(false);

  /* Detail view */
  const [viewing, setViewing] = useState<FeedbackItem | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const data = await api.get(`/blog/admin/feedback?page=${page}${statusParam}`);
      setFeedback(data.feedback);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  /* ─── Mark as Read ─── */
  const markAsRead = async (id: string) => {
    try {
      await api.put(`/blog/admin/feedback/${id}`, { status: 'read' });
      fetchFeedback();
    } catch (err: any) {
      alert(err.message || 'Failed to update');
    }
  };

  /* ─── Open reply ─── */
  const openReply = (item: FeedbackItem) => {
    setReplying(item);
    setReplyText(item.adminReply || '');
    setReplyStatus(item.status === 'pending' ? 'read' : item.status);
  };

  /* ─── Save reply ─── */
  const handleSaveReply = async () => {
    if (!replying) return;
    setSaving(true);
    try {
      await api.put(`/blog/admin/feedback/${replying._id}`, {
        status: replyStatus,
        adminReply: replyText,
      });
      setReplying(null);
      fetchFeedback();
    } catch (err: any) {
      alert(err.message || 'Failed to save reply');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Time ago ─── */
  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  /* ─── Render reply modal ─── */
  const renderReplyModal = () => {
    if (!replying) return null;
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.modalHeader}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#333' }}>Reply to Feedback</h2>
            <button onClick={() => setReplying(null)} style={styles.closeBtn}>
              ✕
            </button>
          </div>
          <div style={styles.modalBody}>
            {/* Original message */}
            <div style={styles.originalMessage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>
                  {replying.userName || 'Anonymous'}
                </span>
                <span style={{ fontSize: 12, color: '#888' }}>{timeAgo(replying.createdAt)}</span>
              </div>
              {replying.userEmail && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{replying.userEmail}</div>
              )}
              <p style={{ fontSize: 14, color: '#444', lineHeight: '1.6', margin: 0 }}>
                {replying.message}
              </p>
            </div>

            {/* Status */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['read', 'resolved'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setReplyStatus(s)}
                    style={{
                      ...styles.statusToggle,
                      ...(replyStatus === s
                        ? { background: STATUS_COLORS[s].bg, borderColor: STATUS_COLORS[s].color, color: STATUS_COLORS[s].color }
                        : {}),
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Reply */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Admin Reply (optional)</label>
              <textarea
                style={{ ...styles.input, minHeight: 100 }}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply to the user..."
              />
            </div>
          </div>
          <div style={styles.modalFooter}>
            <button onClick={() => setReplying(null)} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleSaveReply} disabled={saving} style={styles.saveBtn}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Render detail modal ─── */
  const renderDetailModal = () => {
    if (!viewing) return null;
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.modal, maxWidth: 550 }}>
          <div style={styles.modalHeader}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#333' }}>Feedback Details</h2>
            <button onClick={() => setViewing(null)} style={styles.closeBtn}>
              ✕
            </button>
          </div>
          <div style={styles.modalBody}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#333', fontSize: 15 }}>
                  {viewing.userName || 'Anonymous'}
                </div>
                {viewing.userEmail && (
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{viewing.userEmail}</div>
                )}
              </div>
              <span
                style={{
                  ...styles.statusBadge,
                  background: STATUS_COLORS[viewing.status]?.bg || '#F5F5F5',
                  color: STATUS_COLORS[viewing.status]?.color || '#666',
                }}
              >
                {viewing.status}
              </span>
            </div>

            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              {new Date(viewing.createdAt).toLocaleString()}
            </div>

            <div style={{ background: '#F9F9F9', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: '#333', lineHeight: '1.7', margin: 0 }}>
                {viewing.message}
              </p>
            </div>

            {viewing.adminReply && (
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 16, borderLeft: '3px solid #4A90E2' }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#4A90E2', marginBottom: 6 }}>
                  ADMIN REPLY
                </div>
                <p style={{ fontSize: 14, color: '#333', lineHeight: '1.6', margin: 0 }}>
                  {viewing.adminReply}
                </p>
              </div>
            )}
          </div>
          <div style={styles.modalFooter}>
            <button onClick={() => { setViewing(null); openReply(viewing); }} style={styles.saveBtn}>
              Reply
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>User Feedback</h1>
          <p style={styles.pageSubtitle}>
            {total} feedback item{total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div style={styles.filterRow}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              ...styles.filterBtn,
              ...(statusFilter === s ? styles.filterBtnActive : {}),
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={fetchFeedback} style={{ marginLeft: 12, cursor: 'pointer', border: 'none', background: 'none', color: '#D32F2F', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading feedback...</div>
      )}

      {/* Feedback cards */}
      {!loading && feedback.length > 0 && (
        <div style={styles.cardList}>
          {feedback.map((item) => (
            <div key={item._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={styles.avatar}>
                    {(item.userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>
                      {item.userName || 'Anonymous'}
                    </div>
                    {item.userEmail && (
                      <div style={{ fontSize: 12, color: '#888' }}>{item.userEmail}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{timeAgo(item.createdAt)}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: STATUS_COLORS[item.status]?.bg || '#F5F5F5',
                      color: STATUS_COLORS[item.status]?.color || '#666',
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              <p style={styles.cardMessage}>
                {item.message.length > 200 ? item.message.slice(0, 200) + '...' : item.message}
              </p>

              {item.adminReply && (
                <div style={styles.replyPreview}>
                  <span style={{ fontWeight: 600, color: '#4A90E2', fontSize: 12 }}>Admin reply: </span>
                  <span style={{ fontSize: 13, color: '#555' }}>
                    {item.adminReply.length > 100 ? item.adminReply.slice(0, 100) + '...' : item.adminReply}
                  </span>
                </div>
              )}

              <div style={styles.cardActions}>
                <button onClick={() => setViewing(item)} style={styles.cardActionBtn}>
                  View
                </button>
                <button onClick={() => openReply(item)} style={{ ...styles.cardActionBtn, background: '#4A90E2', color: '#fff', borderColor: '#4A90E2' }}>
                  Reply
                </button>
                {item.status === 'pending' && (
                  <button onClick={() => markAsRead(item._id)} style={styles.cardActionBtn}>
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && feedback.length === 0 && !error && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <h3 style={{ color: '#333', margin: '0 0 8px' }}>No feedback yet</h3>
          <p style={{ color: '#888', margin: 0 }}>
            {statusFilter !== 'all'
              ? `No ${statusFilter} feedback found. Try a different filter.`
              : 'User feedback will appear here once submitted from the app.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={styles.pagination}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            style={styles.pageBtn}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 14, color: '#666' }}>
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            style={styles.pageBtn}
          >
            Next →
          </button>
        </div>
      )}

      {/* Modals */}
      {renderReplyModal()}
      {renderDetailModal()}
    </div>
  );
}

/* ─── Styles ─── */
const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#333',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#888',
    margin: '4px 0 0',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  },
  filterBtn: {
    background: '#F5F5F5',
    border: '1px solid #E0E0E0',
    borderRadius: 20,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#666',
  },
  filterBtnActive: {
    background: '#333',
    borderColor: '#333',
    color: '#fff',
  },
  errorBanner: {
    background: '#FFF5F5',
    color: '#D32F2F',
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #E0E0E0',
    borderRadius: 12,
    padding: 20,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: '#F0F4FF',
    color: '#4A90E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  },
  cardMessage: {
    fontSize: 14,
    color: '#444',
    lineHeight: '1.6',
    margin: '0 0 12px',
  },
  replyPreview: {
    background: '#F8F9FF',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 12,
    borderLeft: '3px solid #4A90E2',
  },
  cardActions: {
    display: 'flex',
    gap: 8,
  },
  cardActionBtn: {
    background: '#fff',
    border: '1px solid #E0E0E0',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#555',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 24px',
    background: '#FAFAFA',
    borderRadius: 12,
    border: '1px dashed #E0E0E0',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  pageBtn: {
    background: '#F5F5F5',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },

  /* ─── Modal ─── */
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #E0E0E0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#888',
    padding: '4px 8px',
  },
  modalBody: {
    padding: 24,
    overflowY: 'auto' as const,
    flex: 1,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '16px 24px',
    borderTop: '1px solid #E0E0E0',
  },
  originalMessage: {
    background: '#F9F9F9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #E0E0E0',
    fontSize: 14,
    color: '#333',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  statusToggle: {
    background: '#F5F5F5',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#666',
  },
  cancelBtn: {
    background: '#F5F5F5',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 500,
  },
  saveBtn: {
    background: '#4A90E2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
