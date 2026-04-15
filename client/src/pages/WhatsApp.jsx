import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const STATUS_LABEL = {
  disconnected: { text: 'Desconectado', color: '#ef4444' },
  connecting:   { text: 'Conectando...', color: '#f59e0b' },
  qr:           { text: 'Aguardando scan', color: '#f59e0b' },
  open:         { text: 'Conectado', color: '#22c55e' },
  close:        { text: 'Desconectado', color: '#ef4444' },
};

export default function WhatsApp() {
  const [status, setStatus]             = useState('disconnected');
  const [qr, setQr]                     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [editName, setEditName]         = useState('');
  const [saving, setSaving]             = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/status');
      setStatus(data.status);
      setQr(data.qr || null);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setInstanceName(data.instanceName || '');
      setEditName(data.instanceName || '');
      if (data.instanceName) fetchStatus();
    }).catch(() => {});
  }, [fetchStatus]);

  // Polling enquanto conectando ou aguardando scan
  useEffect(() => {
    if (status === 'connecting' || status === 'qr') {
      const t = setInterval(fetchStatus, 2000);
      return () => clearInterval(t);
    }
  }, [status, fetchStatus]);

  async function handleSaveName() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.patch('/auth/instance', { instanceName: editName.trim() });
      setInstanceName(editName.trim());
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setLoading(true);
    setQr(null);
    try {
      // Inicia conexão em background (retorna imediatamente)
      await api.post('/whatsapp/connect');
      setStatus('connecting');
      // O polling vai buscar o QR assim que aparecer
    } catch (e) {
      alert('Erro ao conectar: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp desta conta?')) return;
    await api.delete('/whatsapp/disconnect').catch(() => {});
    setStatus('disconnected');
    setQr(null);
  }

  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.disconnected;

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>Conexão WhatsApp</h2>

      {/* Configuração do instanceName */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 10, padding: 16, marginBottom: 24,
      }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
          Nome da instância
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="ex: minha-empresa"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 7,
              border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleSaveName}
            disabled={saving || editName === instanceName}
            style={{
              padding: '8px 16px', background: '#6366f1', color: '#fff',
              border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 14,
              opacity: (saving || editName === instanceName) ? 0.5 : 1,
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
          Um nome único para identificar sua conexão WhatsApp.
        </p>
      </div>

      {instanceName && (
        <>
          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999,
            background: statusInfo.color + '1a',
            color: statusInfo.color,
            fontWeight: 600, fontSize: 14, marginBottom: 24,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusInfo.color, display: 'inline-block',
              animation: (status === 'connecting' || status === 'qr') ? 'pulse 1.2s infinite' : 'none',
            }} />
            {statusInfo.text}
          </div>

          {/* QR code */}
          {qr && status === 'qr' && (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img
                src={qr}
                alt="QR Code WhatsApp"
                style={{ width: 260, height: 260, border: '2px solid #e2e8f0', borderRadius: 12 }}
              />
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
                Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>
          )}

          {status === 'open' && (
            <div style={{
              padding: 16, background: '#f0fdf4', borderRadius: 10,
              color: '#166534', fontSize: 14, marginBottom: 24, border: '1px solid #bbf7d0',
            }}>
              ✅ WhatsApp conectado e pronto para envio de campanhas.
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: 12 }}>
            {status !== 'open' && (
              <button
                onClick={handleConnect}
                disabled={loading || status === 'connecting' || status === 'qr'}
                style={{
                  padding: '10px 20px', background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                  opacity: (loading || status === 'connecting' || status === 'qr') ? 0.6 : 1,
                }}
              >
                {loading ? 'Iniciando...' : status === 'connecting' ? 'Conectando...' : status === 'qr' ? 'Aguardando scan...' : 'Conectar WhatsApp'}
              </button>
            )}
            {(status === 'open' || status === 'qr' || status === 'connecting') && (
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '10px 20px', background: '#fff', color: '#ef4444',
                  border: '1.5px solid #ef4444', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
