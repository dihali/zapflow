import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Megaphone, Send, TrendingUp, Plus, ArrowRight } from 'lucide-react';
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/messages/stats')
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: 'Contatos', value: stats?.totalContacts ?? 0, icon: Users, color: 'text-blue-500 bg-blue-50' },
    { label: 'Campanhas', value: stats?.totalCampaigns ?? 0, icon: Megaphone, color: 'text-purple-500 bg-purple-50' },
    { label: 'Msgs Enviadas', value: stats?.sentMessages ?? 0, icon: Send, color: 'text-green-500 bg-green-50' },
    { label: 'Taxa de Entrega', value: `${stats?.deliveryRate ?? 0}%`, icon: TrendingUp, color: 'text-orange-500 bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral das suas campanhas</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus size={16} />
          Nova Campanha
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent campaigns */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Campanhas Recentes</h2>
          <Link to="/campaigns" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        {stats?.recentCampaigns?.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">
            Nenhuma campanha ainda.{' '}
            <Link to="/campaigns/new" className="text-brand-600 hover:underline">Criar agora</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats?.recentCampaigns?.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c._count.messages} mensagens</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status]}`}>
                    {statusLabels[c.status]}
                  </span>
                  <Link
                    to={`/campaigns/${c.id}/report`}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Relatório
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
