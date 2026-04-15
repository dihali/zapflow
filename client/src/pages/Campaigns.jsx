import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BarChart2, Pause, Trash2, Rocket, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-yellow-100 text-yellow-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

const statusLabels = {
  DRAFT: 'Rascunho',
  APPROVED: 'Aprovada',
  RUNNING: 'Disparando',
  PAUSED: 'Pausada',
  COMPLETED: 'Concluída',
};

function LaunchModal({ campaign, onClose, onLaunched }) {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    api.get('/contacts', { params: { limit: 500 } })
      .then((r) => {
        setContacts(r.data.contacts);
        setSelected(r.data.contacts.map((c) => c.id));
      })
      .catch(() => toast.error('Erro ao carregar contatos'))
      .finally(() => setLoading(false));
  }, []);

  function toggleContact(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  function selectAll() {
    setSelected(selected.length === contacts.length ? [] : contacts.map((c) => c.id));
  }

  async function handleLaunch() {
    if (selected.length === 0) { toast.error('Selecione ao menos um contato'); return; }
    setLaunching(true);
    try {
      const { data } = await api.post(`/campaigns/${campaign.id}/launch`, { contactIds: selected });
      toast.success(`${data.queued} mensagens enfileiradas!`);
      onLaunched(campaign.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao disparar');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Disparar campanha</h2>
            <p className="text-sm text-gray-500">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Selecionar destinatários</span>
            <button onClick={selectAll} className="text-brand-600 hover:underline">
              {selected.length === contacts.length ? 'Desmarcar todos' : `Selecionar todos (${contacts.length})`}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Carregando contatos...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum contato cadastrado.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleContact(c.id)} className="rounded" />
                  <span className="flex-1 text-sm font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.phone}</span>
                </label>
              ))}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Selecionados</span><span className="font-medium">{selected.length} contatos</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Delay entre envios</span><span className="font-medium">20–45s (anti-ban)</span></div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button onClick={handleLaunch} disabled={launching || selected.length === 0} className="btn-primary flex-1 justify-center">
            <Rocket size={15} />
            {launching ? 'Disparando...' : 'Disparar agora!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launchTarget, setLaunchTarget] = useState(null);
  const navigate = useNavigate();

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns');
      setCampaigns(data);
    } catch {
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCampaigns(); }, []);

  async function handlePause(id) {
    try {
      await api.patch(`/campaigns/${id}/pause`);
      toast.success('Campanha pausada');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao pausar');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Deletar campanha e todas as mensagens?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campanha removida');
      fetchCampaigns();
    } catch {
      toast.error('Erro ao deletar');
    }
  }

  function handleLaunched(id) {
    setLaunchTarget(null);
    navigate(`/campaigns/${id}/report`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus size={16} /> Nova Campanha
        </Link>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="mb-2">Nenhuma campanha criada ainda.</p>
            <Link to="/campaigns/new" className="text-brand-600 hover:underline text-sm">Criar primeira campanha</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-600">Nome</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Mensagens</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Criada em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{c._count.messages}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {['APPROVED', 'PAUSED'].includes(c.status) && (
                        <button
                          onClick={() => setLaunchTarget(c)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                          title="Disparar"
                        >
                          <Rocket size={12} /> Disparar
                        </button>
                      )}
                      <Link to={`/campaigns/${c.id}/report`} className="text-gray-400 hover:text-brand-600 transition-colors" title="Relatório">
                        <BarChart2 size={15} />
                      </Link>
                      {c.status === 'RUNNING' && (
                        <button onClick={() => handlePause(c.id)} className="text-gray-400 hover:text-orange-500 transition-colors" title="Pausar">
                          <Pause size={15} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Deletar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {launchTarget && (
        <LaunchModal
          campaign={launchTarget}
          onClose={() => setLaunchTarget(null)}
          onLaunched={handleLaunched}
        />
      )}
    </div>
  );
}
