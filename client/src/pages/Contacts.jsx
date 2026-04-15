import React, { useEffect, useState, useRef } from 'react';
import { Plus, Upload, Trash2, Search, Tag, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const limit = 50;

  async function fetchContacts(p = page, q = search) {
    setLoading(true);
    try {
      const { data } = await api.get('/contacts', { params: { page: p, limit, search: q || undefined } });
      setContacts(data.contacts);
      setTotal(data.total);
    } catch {
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchContacts(1, search); }, [search]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/contacts', {
        name: form.name,
        phone: form.phone,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      });
      toast.success('Contato salvo!');
      setForm({ name: '', phone: '', tags: '' });
      setShowForm(false);
      fetchContacts(1, search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/contacts/import', fd);
      toast.success(`${data.imported} contatos importados!`);
      fetchContacts(1, search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao importar CSV');
    }
    e.target.value = '';
  }

  async function handleDelete(id) {
    if (!confirm('Deletar este contato?')) return;
    await api.delete(`/contacts/${id}`);
    toast.success('Contato removido');
    fetchContacts(page, search);
  }

  async function handleBulkDelete() {
    if (!confirm(`Deletar ${selected.length} contatos?`)) return;
    await api.delete('/contacts/bulk', { data: { ids: selected } });
    toast.success('Contatos removidos');
    setSelected([]);
    fetchContacts(1, search);
  }

  function toggleSelect(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-sm text-gray-500 mt-1">{total} contato{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={handleBulkDelete} className="btn-danger">
              <Trash2 size={16} /> Deletar ({selected.length})
            </button>
          )}
          <a
            href="/modelo-contatos.xlsx"
            download
            className="btn-secondary"
            title="Baixar planilha modelo"
          >
            <Download size={16} /> Planilha Modelo
          </a>
          <button onClick={() => fileRef.current.click()} className="btn-secondary">
            <Upload size={16} /> Importar CSV / Excel
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} /> Novo Contato
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleImport} />
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Novo contato</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input name="name" placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="input" />
            <input name="phone" placeholder="Telefone (55119...)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required className="input" />
            <input name="tags" placeholder="Tags (separar por vírgula)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="input" />
            <div className="sm:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input pl-9"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? contacts.map((c) => c.id) : [])} checked={selected.length === contacts.length && contacts.length > 0} className="rounded" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Telefone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tags</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Carregando...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Nenhum contato encontrado.</td></tr>
            ) : contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">{c.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full">
                        <Tag size={10} />{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Página {page} de {pages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => { setPage(page - 1); fetchContacts(page - 1, search); }} className="btn-secondary py-1 px-3 text-xs">Anterior</button>
              <button disabled={page === pages} onClick={() => { setPage(page + 1); fetchContacts(page + 1, search); }} className="btn-secondary py-1 px-3 text-xs">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
