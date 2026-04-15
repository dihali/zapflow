import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, Edit2, Rocket, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const STEPS = ['Escrever', 'Variações IA', 'Selecionar Contatos', 'Disparar'];

export default function NewCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0
  const [form, setForm] = useState({ name: '', originalText: '' });
  // Step 1
  const [campaign, setCampaign] = useState(null);
  const [variations, setVariations] = useState([]);
  // Step 2
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (step === 2) {
      setContactsLoading(true);
      api.get('/contacts', { params: { limit: 500 } })
        .then((r) => setContacts(r.data.contacts))
        .catch(() => toast.error('Erro ao carregar contatos'))
        .finally(() => setContactsLoading(false));
    }
  }, [step]);

  async function handleGenerateVariations(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/campaigns', form);
      setCampaign(data);
      setVariations(data.variations);
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar variações');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setLoading(true);
    try {
      await api.patch(`/campaigns/${campaign.id}/approve`, { variations });
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar campanha');
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (selected.length === 0) {
      toast.error('Selecione ao menos um contato');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/campaigns/${campaign.id}/launch`, { contactIds: selected });
      toast.success(`${data.queued} mensagens enfileiradas!`);
      navigate(`/campaigns/${campaign.id}/report`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao disparar');
    } finally {
      setLoading(false);
    }
  }

  function toggleContact(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  function selectAll() {
    setSelected(contacts.length === selected.length ? [] : contacts.map((c) => c.id));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Campanha</h1>
        <p className="text-sm text-gray-500 mt-1">IA gera variações automáticas para evitar bloqueios</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 text-sm font-medium ${i === step ? 'text-brand-700' : i < step ? 'text-brand-500' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Escrever */}
      {step === 0 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Escreva sua mensagem</h2>
          <form onSubmit={handleGenerateVariations} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Promoção de Maio" required className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem original</label>
              <textarea
                value={form.originalText}
                onChange={(e) => setForm((f) => ({ ...f, originalText: e.target.value }))}
                placeholder="Olá! Temos uma oferta especial para você..."
                required
                rows={5}
                className="input resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">A IA irá gerar 5 variações desta mensagem.</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              <Sparkles size={16} />
              {loading ? 'Gerando variações...' : 'Gerar variações com IA'}
            </button>
          </form>
        </div>
      )}

      {/* Step 1: Variações IA */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Variações geradas pela IA</h2>
            <span className="text-xs text-gray-400">Edite se necessário</span>
          </div>
          <div className="space-y-3">
            {variations.map((v, i) => (
              <div key={i} className="relative">
                <div className="absolute left-3 top-3 text-xs font-bold text-gray-400">#{i + 1}</div>
                <textarea
                  value={v}
                  onChange={(e) => {
                    const updated = [...variations];
                    updated[i] = e.target.value;
                    setVariations(updated);
                  }}
                  rows={3}
                  className="input resize-none pl-8"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-secondary">Voltar</button>
            <button onClick={handleApprove} disabled={loading} className="btn-primary">
              <Check size={16} />
              {loading ? 'Aprovando...' : 'Aprovar e continuar'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Selecionar Contatos */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Selecionar destinatários</h2>
            <button onClick={selectAll} className="text-sm text-brand-600 hover:underline">
              {selected.length === contacts.length ? 'Desmarcar todos' : `Selecionar todos (${contacts.length})`}
            </button>
          </div>
          {contactsLoading ? (
            <div className="text-center py-8 text-gray-400">Carregando contatos...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Nenhum contato cadastrado.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleContact(c.id)} className="rounded" />
                  <span className="flex-1 text-sm font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.phone}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">{selected.length} contatos selecionados</p>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary">Voltar</button>
            <button onClick={() => setStep(3)} disabled={selected.length === 0} className="btn-primary">
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmar disparo */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Confirmar disparo</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Campanha</span><span className="font-medium">{campaign?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destinatários</span><span className="font-medium">{selected.length} contatos</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Variações</span><span className="font-medium">{variations.length} versões</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Delay</span><span className="font-medium">20–45s entre envios (anti-ban)</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary">Voltar</button>
            <button onClick={handleLaunch} disabled={loading} className="btn-primary">
              <Rocket size={16} />
              {loading ? 'Disparando...' : 'Disparar agora!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
