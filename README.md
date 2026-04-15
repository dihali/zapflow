# ZapFlow

SaaS de disparos inteligentes para WhatsApp com geração de variações via IA (Claude) e fila anti-ban.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Banco | PostgreSQL + Prisma ORM |
| Fila | BullMQ + Redis |
| WhatsApp | Evolution API |
| IA | Anthropic API (claude-sonnet) |
| Auth | JWT + bcrypt |

---

## Rodar localmente

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Conta Anthropic com API key
- Evolution API rodando (veja abaixo)

### 1. Subir banco e Redis

```bash
docker-compose up -d
```

### 2. Configurar variáveis de ambiente

```bash
# na pasta /server
cp ../.env.example .env
# edite .env com seus dados
```

### 3. Instalar dependências e rodar migrations

```bash
cd server
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Iniciar o backend

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — Worker de disparos
npm run worker
```

### 5. Instalar e iniciar o frontend

```bash
cd ../client
npm install
npm run dev
```

Acesse: **http://localhost:5173**

---

## Estrutura do projeto

```
zapflow/
├── client/                  # React + Vite
│   └── src/
│       ├── pages/           # Login, Dashboard, Contacts, NewCampaign, Report
│       ├── components/      # Layout, Sidebar
│       ├── context/         # AuthContext
│       └── services/        # axios instance
│
├── server/                  # Node.js + Express
│   ├── prisma/
│   │   └── schema.prisma    # Modelos: User, Contact, Campaign, Message
│   └── src/
│       ├── controllers/     # auth, contacts, campaigns, messages
│       ├── routes/          # rotas REST
│       ├── services/        # ai, whatsapp, queue
│       ├── workers/         # message.worker.js (BullMQ)
│       ├── middleware/      # JWT auth
│       └── utils/           # spinText, csvParser
│
├── docker-compose.yml       # PostgreSQL + Redis
└── .env.example
```

---

## API REST

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Perfil do usuário logado |
| PATCH | `/api/auth/instance` | Configurar instância WhatsApp |

### Contatos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/contacts` | Listar (paginado, busca) |
| POST | `/api/contacts` | Criar contato |
| POST | `/api/contacts/import` | Importar CSV |
| DELETE | `/api/contacts/:id` | Deletar |
| DELETE | `/api/contacts/bulk` | Deletar em lote |

### Campanhas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/campaigns` | Listar |
| GET | `/api/campaigns/:id` | Detalhes |
| POST | `/api/campaigns` | Criar + gerar variações IA |
| PATCH | `/api/campaigns/:id/approve` | Aprovar variações |
| POST | `/api/campaigns/:id/launch` | Disparar para contatos |
| PATCH | `/api/campaigns/:id/pause` | Pausar |
| DELETE | `/api/campaigns/:id` | Deletar |

### Mensagens
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/messages/stats` | Stats do dashboard |
| GET | `/api/messages/campaign/:id` | Relatório da campanha |

---

## Formato do CSV para importação

```csv
name,phone,tags
João Silva,5511999999999,cliente|vip
Maria Santos,5521988888888,lead
```

- `phone`: apenas números, formato DDI+DDD+número (ex: `5511999999999`)
- `tags`: separar por `|` (pipe)

---

## Evolution API (WhatsApp)

A Evolution API deve rodar separado. Recomendamos via Docker:

```bash
docker run -d \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua-chave-aqui \
  atendai/evolution-api:latest
```

Após rodar, crie uma instância e escaneie o QR Code. Configure `instanceName` e `instanceKey` no perfil do usuário em **Settings → WhatsApp** (rota `PATCH /api/auth/instance`).

---

## Deploy no Railway

### 1. Criar projeto no Railway

```bash
railway login
railway init
```

### 2. Adicionar serviços

No dashboard do Railway, adicione:
- **PostgreSQL** plugin
- **Redis** plugin

### 3. Configurar variáveis de ambiente

No Railway, adicione todas as variáveis do `.env.example`. O `DATABASE_URL` e `REDIS_URL` são preenchidos automaticamente pelos plugins.

### 4. Deploy do backend

```bash
cd server
railway up
```

### 5. Deploy do frontend

No Railway, crie um novo serviço apontando para `/client` com:
- Build command: `npm run build`
- Start command: `npm run preview -- --port $PORT --host`

### 6. Worker como serviço separado

Crie outro serviço Railway com:
- Start command: `node src/workers/message.worker.js`

---

## Lógica anti-ban

O worker enfileira as mensagens com **delay aleatório cumulativo de 5–15 segundos** entre cada envio. Para uma campanha de 100 contatos, o disparo total leva ~16 minutos, imitando comportamento humano.

Além disso, cada mensagem usa uma **variação aleatória** do texto (spin text) gerada pela IA, evitando conteúdo idêntico repetido.
