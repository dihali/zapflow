import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const STATUS_LABEL = {
  disconnected: { text: 'Desconectado',     color: '#ef4444' },
  connecting:   { text: 'Conectando...',    color: '#f59e0b' },
  restarting:   { text: 'Reiniciando...',   color: '#f59e0b' },
  qr:           { text: 'Aguardando scan',  color: '#f59e0b' },
  open:         { text: 'Conectado',        color: '#22c55e' },
  close:        { text: 'Desconectado',     color: '#ef4444' },
};

export default function WhatsApp() {
  const [status, setStatus]             = useState('disconnected');
  const [qr, setQr]                     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [editName, setEditName]         = useState('');
  const [saving, setSaving]             = useState(false);
  const connectingSecondsRef            = useRef(0);
  const [connectingTooLong, setConnectingTooLong] = useState(false);

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
    if (status === 'connecting' || status === 'restarting' || status === 'qr') {
      connectingSecondsRef.current = 0;
      setConnectingTooLong(false);
      const t = setInterval(() => {
        connectingSecondsRef.current += 2;
        // Depois de 20s conectando sem QR, mostra botão de reiniciar
        if (connectingSecondsRef.current >= 20 && status === 'connecting') {
          setConnectingTooLong(true);
        }
        fetchStatus();
      }, 2000);
      return () => clearInterval(t);
    } else {
      setConnectingTooLong(false);
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
    setConnectingTooLong(false);
    try {
      await api.post('/whatsapp/connect');
      setStatus('connecting');
    } catch (e) {
      alert('Erro ao conectar: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    setQr(null);
    setConnectingTooLong(false);
    try {
      await api.post('/whatsapp/restart');
      setStatus('restarting');
    } catch (e) {
      alert('Erro ao reiniciar: ' + (e.response?.data?.error || e.message));
    }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp desta conta?')) return;
    await api.delete('/whatsapp/disconnect').catch(() => {});
    setStatus('disconnected');
    setQr(null);
  }

  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.disconnected;
  const isConnecting = status === 'connecting' || status === 'restarting';

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>Conexão WhatsApp</h2>

      {/* Nome da instância */}
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
            fontWeight: 600, fontSize: 14, marginBottom: 16,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusInfo.color, display: 'inline-block',
              animation: isConnecting || status === 'qr' ? 'pulse 1.2s infinite' : 'none',
            }} />
            {statusInfo.text}
          </div>

          {/* Aviso de travamento + botão reiniciar */}
          {connectingTooLong && (
            <div style={{
              padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#92400e',
            }}>
              ⚠️ A conexão está demorando mais que o esperado. Isso pode acontecer na primeira inicialização do servidor.
              <br />
              <button
                onClick={handleRestart}
                style={{
                  marginTop: 10, padding: '7px 14px', background: '#f59e0b', color: '#fff',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                🔄 Reiniciar sessão WhatsApp
              </button>
            </div>
          )}

          {/* QR code */}
          {qr && status === 'qr' && (
            <div style={{ textAlign: 'center', marginBottom: 28, padding: '24px 0' }}>
              <div style={{
                display: 'inline-block',
                borderRadius: 16,
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                background: '#fff',
                overflow: 'hidden',
                maxWidth: '100%',
              }}>
                <img
                  src={qr}
                  alt="QR Code WhatsApp"
                  style={{ display: 'block', width: 480, maxWidth: '100%', height: 'auto' }}
                />
              </div>
              <p style={{ color: '#374151', fontSize: 14, fontWeight: 600, marginTop: 16 }}>
                Escaneie o QR code com seu WhatsApp
              </p>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
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
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {status !== 'open' && !isConnecting && status !== 'qr' && (
              <button
                onClick={handleConnect}
                disabled={loading}
                style={{
                  padding: '10px 20px', background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Iniciando...' : 'Conectar WhatsApp'}
              </button>
            )}

            {isConnecting && (
              <button disabled style={{
                padding: '10px 20px', background: '#6366f1', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 600, opacity: 0.6, cursor: 'not-allowed',
              }}>
                Conectando...
              </button>
            )}

            {(status === 'open' || status === 'qr' || isConnecting) && (
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
