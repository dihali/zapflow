import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const statusIcon = {
  PENDING: <Clock size={14} className="text-gray-400" />,
  QUEUED: <Send size={14} className="text-blue-400" />,
  SENT: <CheckCircle size={14} className="text-green-500" />,
  FAILED: <XCircle size={14} className="text-red-500" />,
};

const statusLabel = {
  PENDING: 'Pendente',
  QUEUED: 'Na fila',
  SENT: 'Enviado',
  FAILED: 'Falhou',
};

export default function Report() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [reportRes, campaignRes] = await Promise.all([
        api.get(`/messages/campaign/${id}`),
        api.get(`/campaigns/${id}`),
      ]);
      setData(reportRes.data);
      setCampaign(campaignRes.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh a cada 5s enquanto a campanha estiver rodando
  useEffect(() => {
    if (!autoRefresh || campaign?.status !== 'RUNNING') return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, campaign?.status, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { messages = [], summary = {}, total = 0 } = data || {};
  const sent = summary.SENT || 0;
  const failed = summary.FAILED || 0;
  const pending = (summary.PENDING || 0) + (summary.QUEUED || 0);
  const deliveryRate = total > 0 ? ((sent / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/campaigns" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{campaign?.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Relatório em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto-refresh
          </label>
          <button onClick={fetchData} className="btn-secondary py-1.5">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-gray-900' },
          { label: 'Enviados', value: sent, color: 'text-green-600' },
          { label: 'Pendentes', value: pending, color: 'text-yellow-600' },
          { label: 'Falhas', value: failed, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium text-gray-700">Taxa de entrega</span>
          <span className="font-bold text-brand-700">{deliveryRate}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${deliveryRate}%` }}
          />
        </div>
      </div>

      {/* Messages table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Mensagens ({total})</h2>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Contato</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Telefone</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{m.contact.name}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{m.contact.phone}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      {statusIcon[m.status]}
                      {statusLabel[m.status]}
                    </span>
                    {m.error && <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs">{m.error}</p>}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">
                    {m.sentAt ? new Date(m.sentAt).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">Nenhuma mensagem ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
