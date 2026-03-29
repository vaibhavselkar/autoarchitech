import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CATEGORIES = [
  'room_minimum',
  'adjacency_required',
  'adjacency_forbidden',
  'zone_rule',
  'mandatory_room',
  'forbidden_room',
  'score_threshold',
];

const ROOM_TYPES = [
  'living_room', 'dining', 'kitchen', 'master_bedroom', 'bedroom',
  'bathroom', 'balcony', 'parking', 'staircase', 'entry', 'corridor',
  'study', 'guest_room', 'utility_room', 'prayer_room', 'terrace', '*',
];

const CATEGORY_LABELS = {
  room_minimum: 'Room Minimum',
  adjacency_required: 'Adjacency Required',
  adjacency_forbidden: 'Adjacency Forbidden',
  zone_rule: 'Zone Rule',
  mandatory_room: 'Mandatory Room',
  forbidden_room: 'Forbidden Room',
  score_threshold: 'Score Threshold',
};

const CATEGORY_COLORS = {
  room_minimum: 'bg-blue-900/40 text-blue-300 border-blue-700',
  adjacency_required: 'bg-green-900/40 text-green-300 border-green-700',
  adjacency_forbidden: 'bg-red-900/40 text-red-300 border-red-700',
  zone_rule: 'bg-purple-900/40 text-purple-300 border-purple-700',
  mandatory_room: 'bg-orange-900/40 text-orange-300 border-orange-700',
  forbidden_room: 'bg-rose-900/40 text-rose-300 border-rose-700',
  score_threshold: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
};

const EMPTY_RULE = {
  category: 'room_minimum',
  name: '',
  description: '',
  severity: 'error',
  roomType: 'living_room',
  minWidth: '',
  minHeight: '',
  roomTypeA: 'kitchen',
  roomTypeB: 'bathroom',
  zone: 'front',
  zoneYMin: '',
  zoneYMax: '',
  minScore: '',
  enabled: true,
};

function RuleFields({ rule, onChange }) {
  const c = rule.category;
  return (
    <div className="space-y-3 mt-3">
      {(c === 'room_minimum' || c === 'mandatory_room' || c === 'forbidden_room' || c === 'zone_rule') && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Room Type</label>
          <select
            value={rule.roomType || ''}
            onChange={e => onChange('roomType', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          >
            {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      {c === 'room_minimum' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Min Width (ft)</label>
            <input
              type="number" min="0"
              value={rule.minWidth}
              onChange={e => onChange('minWidth', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Min Height (ft)</label>
            <input
              type="number" min="0"
              value={rule.minHeight}
              onChange={e => onChange('minHeight', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>
        </div>
      )}
      {(c === 'adjacency_required' || c === 'adjacency_forbidden') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Room Type A</label>
            <select
              value={rule.roomTypeA || ''}
              onChange={e => onChange('roomTypeA', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            >
              {ROOM_TYPES.filter(t => t !== '*').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Room Type B</label>
            <select
              value={rule.roomTypeB || ''}
              onChange={e => onChange('roomTypeB', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            >
              {ROOM_TYPES.filter(t => t !== '*').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
      {c === 'zone_rule' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Zone</label>
            <select
              value={rule.zone || 'front'}
              onChange={e => onChange('zone', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="front">Front</option>
              <option value="middle">Middle</option>
              <option value="rear">Rear</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Zone Y Min (0–1)</label>
              <input
                type="number" min="0" max="1" step="0.05"
                value={rule.zoneYMin}
                onChange={e => onChange('zoneYMin', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Zone Y Max (0–1)</label>
              <input
                type="number" min="0" max="1" step="0.05"
                value={rule.zoneYMax}
                onChange={e => onChange('zoneYMax', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>
        </div>
      )}
      {c === 'score_threshold' && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Minimum Score (0–100)</label>
          <input
            type="number" min="0" max="100"
            value={rule.minScore}
            onChange={e => onChange('minScore', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
      )}
    </div>
  );
}

function RuleModal({ rule, onClose, onSave }) {
  const [form, setForm] = useState(rule || EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            {rule?._id ? 'Edit Rule' : 'New Rule'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
              placeholder="e.g. Living Room — Min Width"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white resize-none"
              placeholder="Optional description / building code reference"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Severity</label>
            <select
              value={form.severity}
              onChange={e => set('severity', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="error">Error — reject plan until fixed</option>
              <option value="warning">Warning — flag but still deliver</option>
            </select>
          </div>

          <RuleFields rule={form} onChange={set} />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  const colorCls = CATEGORY_COLORS[rule.category] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className={`border rounded-lg p-4 ${rule.enabled ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colorCls}`}>
              {CATEGORY_LABELS[rule.category]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              rule.severity === 'error'
                ? 'bg-red-900/30 text-red-300 border-red-700'
                : 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
            }`}>
              {rule.severity}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-white">{rule.name}</p>
          {rule.description && (
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{rule.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {rule.roomType && <span>Room: <span className="text-slate-300">{rule.roomType}</span></span>}
            {rule.roomTypeA && <span>A: <span className="text-slate-300">{rule.roomTypeA}</span></span>}
            {rule.roomTypeB && <span>B: <span className="text-slate-300">{rule.roomTypeB}</span></span>}
            {rule.minWidth != null && rule.minWidth !== '' && <span>Min W: <span className="text-slate-300">{rule.minWidth}ft</span></span>}
            {rule.minHeight != null && rule.minHeight !== '' && <span>Min H: <span className="text-slate-300">{rule.minHeight}ft</span></span>}
            {rule.zone && <span>Zone: <span className="text-slate-300">{rule.zone}</span></span>}
            {rule.minScore != null && rule.minScore !== '' && <span>Min Score: <span className="text-slate-300">{rule.minScore}</span></span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* Toggle */}
          <button
            onClick={() => onToggle(rule)}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
            className={`w-10 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-violet-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>

          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 text-slate-400 hover:text-violet-400 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={() => onDelete(rule)}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRules() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [modal, setModal] = useState(null); // null | { mode: 'new' | 'edit', rule }
  const [seeding, setSeeding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/home');
      toast.error('Admin access required');
    }
  }, [user, navigate]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/rules');
      setRules(res.data.data.rules);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (rule) => {
    try {
      const res = await api.patch(`/admin/rules/${rule._id}`, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r._id === rule._id ? res.data.data.rule : r));
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleSave = async (form) => {
    try {
      if (form._id) {
        const res = await api.patch(`/admin/rules/${form._id}`, form);
        setRules(prev => prev.map(r => r._id === form._id ? res.data.data.rule : r));
        toast.success('Rule updated');
      } else {
        const res = await api.post('/admin/rules', form);
        setRules(prev => [...prev, res.data.data.rule]);
        toast.success('Rule created');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save rule');
      throw err;
    }
  };

  const handleDelete = async (rule) => {
    try {
      await api.delete(`/admin/rules/${rule._id}`);
      setRules(prev => prev.filter(r => r._id !== rule._id));
      toast.success('Rule deleted');
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await api.post('/admin/rules/seed');
      setRules(res.data.data.rules);
      toast.success(`Restored ${res.data.data.total} default rules`);
    } catch {
      toast.error('Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  const displayed = filterCat === 'all' ? rules : rules.filter(r => r.category === filterCat);

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = displayed.filter(r => r.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const enabledCount  = rules.filter(r => r.enabled).length;
  const disabledCount = rules.length - enabledCount;

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Design Rules</h1>
            <p className="text-slate-400 text-sm mt-1">
              {enabledCount} active &middot; {disabledCount} disabled &middot; {rules.length} total
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {seeding ? 'Restoring…' : 'Restore Defaults'}
            </button>
            <button
              onClick={() => setModal({ mode: 'new', rule: null })}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium"
            >
              + Add Rule
            </button>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              filterCat === 'all'
                ? 'bg-violet-700 border-violet-500 text-white'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            All ({rules.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = rules.filter(r => r.category === cat).length;
            if (!count) return null;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  filterCat === cat
                    ? 'bg-violet-700 border-violet-500 text-white'
                    : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Rules list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg mb-4">No rules yet.</p>
            <button
              onClick={handleSeedDefaults}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
            >
              Load Default Rules
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                {filterCat === 'all' && (
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                )}
                <div className="space-y-3">
                  {items.map(rule => (
                    <RuleCard
                      key={rule._id}
                      rule={rule}
                      onToggle={handleToggle}
                      onEdit={r => setModal({ mode: 'edit', rule: r })}
                      onDelete={r => setConfirmDelete(r)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <RuleModal
          rule={modal.mode === 'edit' ? modal.rule : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Rule?</h3>
            <p className="text-slate-400 text-sm mb-5">
              "{confirmDelete.name}" will be permanently removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
