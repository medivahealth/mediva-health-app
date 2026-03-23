import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface Article {
  _id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  author: string;
  tags: string[];
  links: string[];
  readTime: string;
  likes: number;
  dislikes: number;
  shares: number;
  views: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  'Nutrition',
  'Fitness',
  'Mental Health',
  'Sleep',
  'Heart',
  'Chronic Care',
  "Women's Health",
  'Skin & Hair',
  'Ayurveda',
  'First Aid',
  'Wellness',
];

const EMPTY_ARTICLE: Omit<Article, '_id' | 'likes' | 'dislikes' | 'shares' | 'views' | 'createdAt' | 'updatedAt'> = {
  title: '',
  excerpt: '',
  content: '',
  category: 'Nutrition',
  imageUrl: '',
  author: 'Dr. Mediva',
  tags: [],
  links: [],
  readTime: '5 min read',
  published: true,
};

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Editor state */
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [tagsInput, setTagsInput] = useState('');
  const [linksInput, setLinksInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetUrl, setAssetUrl] = useState('');

  /* Preview */
  const [previewing, setPreviewing] = useState<Article | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/blog/admin/articles?page=${page}`);
      setArticles(data.articles);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  /* ─── Open editor ─── */
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_ARTICLE });
    setTagsInput('');
    setLinksInput('');
    setImageFile(null);
    setCreating(true);
  };

  const openEdit = (article: Article) => {
    setCreating(false);
    setEditing(article);
    setForm({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      imageUrl: article.imageUrl,
      author: article.author,
      tags: article.tags,
      links: article.links,
      readTime: article.readTime,
      published: article.published,
    });
    setTagsInput(article.tags.join(', '));
    setLinksInput(article.links.join('\n'));
    setImageFile(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        links: linksInput
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      };

      let savedArticle: Article;
      if (editing) {
        savedArticle = await api.put(`/blog/admin/articles/${editing._id}`, payload);
      } else {
        savedArticle = await api.post('/blog/admin/articles', payload);
      }

      // Upload image if selected
      if (imageFile && savedArticle._id) {
        const formData = new FormData();
        formData.append('file', imageFile);
        await fetch(`/api/blog/admin/articles/${savedArticle._id}/image`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('doctor_token')}`,
          },
          body: formData,
        });
      }

      closeEditor();
      fetchArticles();
    } catch (err: any) {
      alert(err.message || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Generic Asset Upload ─── */
  const handleAssetUpload = async () => {
    if (!assetFile) return;
    setAssetLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', assetFile);
      const res = await api.post('/blog/admin/upload-image', formData);
      const markdown = `![Image](${res.url})`;
      setAssetUrl(res.url);
      
      // Attempt copy to clipboard
      try {
        await navigator.clipboard.writeText(markdown);
        alert('Image uploaded and markdown [ ![...] (url) ] copied to clipboard!');
      } catch {
        alert(`Image uploaded! URL: ${res.url}`);
      }
      setAssetFile(null);
    } catch (err: any) {
      alert(err.message || 'Failed to upload asset');
    } finally {
      setAssetLoading(false);
    }
  };

  /* ─── Delete ─── */
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) return;
    try {
      await api.delete(`/blog/admin/articles/${id}`);
      fetchArticles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete article');
    }
  };

  /* ─── Toggle publish ─── */
  const handleTogglePublish = async (article: Article) => {
    try {
      await api.put(`/blog/admin/articles/${article._id}`, {
        published: !article.published,
      });
      fetchArticles();
    } catch (err: any) {
      alert(err.message || 'Failed to update article');
    }
  };

  /* ─── Render editor/creator modal ─── */
  const renderEditor = () => {
    if (!creating && !editing) return null;

    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.modalHeader}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#333' }}>
              {editing ? 'Edit Article' : 'Create Article'}
            </h2>
            <button onClick={closeEditor} style={styles.closeBtn}>
              ✕
            </button>
          </div>

          <div style={styles.modalBody}>
            {/* Title */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Title *</label>
              <input
                style={styles.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Article title"
              />
            </div>

            {/* Excerpt */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Excerpt</label>
              <textarea
                style={{ ...styles.input, minHeight: 60 }}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="Short description shown in listings"
              />
            </div>

            {/* Row: Category + Author + Read Time */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label}>Category</label>
                <select
                  style={styles.input}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label}>Author</label>
                <input
                  style={styles.input}
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>
              <div style={{ ...styles.fieldGroup, width: 140 }}>
                <label style={styles.label}>Read Time</label>
                <input
                  style={styles.input}
                  value={form.readTime}
                  onChange={(e) => setForm({ ...form, readTime: e.target.value })}
                  placeholder="5 min read"
                />
              </div>
            </div>

            {/* Content (Markdown) */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Content (Markdown)</label>
              <textarea
                style={{ ...styles.input, minHeight: 250, fontFamily: 'monospace', fontSize: 13 }}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Write your article content in Markdown..."
              />
            </div>

            {/* Tags */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tags (comma-separated)</label>
              <input
                style={styles.input}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="nutrition, health, wellness"
              />
            </div>

            {/* Links */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Reference Links (one per line)</label>
              <textarea
                style={{ ...styles.input, minHeight: 60, fontFamily: 'monospace', fontSize: 13 }}
                value={linksInput}
                onChange={(e) => setLinksInput(e.target.value)}
                placeholder="https://example.com/source-1&#10;https://example.com/source-2"
              />
            </div>

            {/* Content Assets Tool */}
            <div style={{ ...styles.fieldGroup, border: '1px dashed #E0E0E0', padding: 16, borderRadius: 12, background: '#F9F9F9' }}>
              <label style={{ ...styles.label, marginBottom: 4 }}>Content Assets (Images for Markdown)</label>
              <p style={{ fontSize: 11, color: '#888', marginTop: 0, marginBottom: 12 }}>Upload images to use inside your article content. URLs will be copied as Markdown.</p>
              
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                  style={{ fontSize: 12, flex: 1 }}
                />
                <button 
                  onClick={handleAssetUpload} 
                  disabled={!assetFile || assetLoading}
                  style={{ 
                    ...styles.actionBtn, 
                    background: assetFile ? '#4A90E2' : '#EEE', 
                    color: assetFile ? '#FFF' : '#AAA',
                    border: 'none',
                    padding: '6px 14px'
                  }}
                >
                  {assetLoading ? '...' : 'Upload & Copy Link'}
                </button>
              </div>
              
              {assetUrl && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#2E7D32', background: '#E8F5E9', padding: '6px 10px', borderRadius: 6 }}>
                  Last uploaded: <code style={{ fontWeight: 600 }}>![Image]({assetUrl})</code>
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Cover Image</label>
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="Cover"
                  style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                style={{ fontSize: 14 }}
              />
            </div>

            {/* Published Toggle */}
            <div style={{ ...styles.fieldGroup, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <label style={{ ...styles.label, margin: 0 }}>Published (visible to users)</label>
            </div>
          </div>

          <div style={styles.modalFooter}>
            <button onClick={closeEditor} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
              {saving ? 'Saving...' : editing ? 'Update Article' : 'Create Article'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Render preview modal ─── */
  const renderPreview = () => {
    if (!previewing) return null;
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.modal, maxWidth: 700 }}>
          <div style={styles.modalHeader}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#333' }}>Preview</h2>
            <button onClick={() => setPreviewing(null)} style={styles.closeBtn}>
              ✕
            </button>
          </div>
          <div style={{ ...styles.modalBody, maxHeight: '70vh', overflow: 'auto' }}>
            {previewing.imageUrl && (
              <img
                src={previewing.imageUrl}
                alt={previewing.title}
                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={styles.categoryTag}>{previewing.category}</span>
              <span style={{ fontSize: 13, color: '#888' }}>{previewing.readTime}</span>
              <span style={{ fontSize: 13, color: '#888' }}>by {previewing.author}</span>
            </div>
            <h1 style={{ fontSize: 24, color: '#333', marginBottom: 8 }}>{previewing.title}</h1>
            <p style={{ fontSize: 15, color: '#666', marginBottom: 16 }}>{previewing.excerpt}</p>
            <div
              style={{
                fontSize: 15,
                color: '#333',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              {previewing.content}
            </div>
            {previewing.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                {previewing.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 13, color: '#888' }}>
              <span>👍 {previewing.likes}</span>
              <span>👎 {previewing.dislikes}</span>
              <span>📤 {previewing.shares}</span>
              <span>👁️ {previewing.views}</span>
            </div>
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
          <h1 style={styles.pageTitle}>Articles</h1>
          <p style={styles.pageSubtitle}>
            {total} article{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={openCreate} style={styles.createBtn}>
          + New Article
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={fetchArticles} style={{ marginLeft: 12, cursor: 'pointer', border: 'none', background: 'none', color: '#D32F2F', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading articles...</div>
      )}

      {/* Table */}
      {!loading && articles.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Title</th>
                <th style={{ ...styles.th, width: 120 }}>Category</th>
                <th style={{ ...styles.th, width: 80 }}>Status</th>
                <th style={{ ...styles.th, width: 80 }}>Stats</th>
                <th style={{ ...styles.th, width: 100 }}>Date</th>
                <th style={{ ...styles.th, width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article._id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {article.imageUrl && (
                        <img
                          src={article.imageUrl}
                          alt=""
                          style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#333', fontSize: 14, lineHeight: '1.3' }}>
                          {article.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                          {article.author} · {article.readTime}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryTag}>{article.category}</span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: article.published ? '#E8F5E9' : '#FFF3E0',
                        color: article.published ? '#2E7D32' : '#E65100',
                      }}
                    >
                      {article.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: '1.5' }}>
                      👍 {article.likes} · 👁️ {article.views}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {new Date(article.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setPreviewing(article)}
                        style={styles.actionBtn}
                        title="Preview"
                      >
                        👁️
                      </button>
                      <button onClick={() => openEdit(article)} style={styles.actionBtn} title="Edit">
                        ✏️
                      </button>
                      <button
                        onClick={() => handleTogglePublish(article)}
                        style={styles.actionBtn}
                        title={article.published ? 'Unpublish' : 'Publish'}
                      >
                        {article.published ? '📥' : '📤'}
                      </button>
                      <button
                        onClick={() => handleDelete(article._id)}
                        style={{ ...styles.actionBtn, color: '#D32F2F' }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && !error && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <h3 style={{ color: '#333', margin: '0 0 8px' }}>No articles yet</h3>
          <p style={{ color: '#888', margin: '0 0 16px' }}>Create your first health article to get started.</p>
          <button onClick={openCreate} style={styles.createBtn}>
            + New Article
          </button>
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
      {renderEditor()}
      {renderPreview()}
    </div>
  );
}

/* ─── Styles ─── */
const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  createBtn: {
    background: '#4A90E2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBanner: {
    background: '#FFF5F5',
    color: '#D32F2F',
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  tableWrap: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #E0E0E0',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    borderBottom: '1px solid #E0E0E0',
    background: '#FAFAFA',
  },
  tr: {
    borderBottom: '1px solid #F0F0F0',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle' as const,
  },
  categoryTag: {
    background: '#F0F4FF',
    color: '#4A90E2',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  actionBtn: {
    background: '#F5F5F5',
    border: '1px solid #E0E0E0',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 14,
  },
  tag: {
    background: '#F0F0F0',
    color: '#666',
    padding: '2px 8px',
    borderRadius: 8,
    fontSize: 12,
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
    maxWidth: 800,
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
