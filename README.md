# Pix Flow

Crie um sistema web simples de cobrança pelo WhatsApp usando Evolution API, sem n8n.

Quero um painel em HTML/CSS/JS com backend seguro. A API key do Evolution NÃO pode ficar exposta no front-end; deve ser salva no servidor/env/config protegida.

Nome do sistema: Cobrança WhatsApp

O sistema deve ter:

1. Tela inicial de configuração

- Campo: URL base do Evolution

  Exemplo: https://evolution-api-production-c674.up.railway.app

- Campo: Nome da instância do WhatsApp

  Exemplo: Julio

- Campo: API Key do Evolution

  Header usado: apikey

- Campo: número do dono/admin

  Exemplo: 5585996449844

- Campo: chave Pix

- Campo: nome do titular Pix

- Campo: banco

- Botão: Salvar configuração

- Botão: Testar conexão com Evolution

- Botão: Enviar mensagem teste para meu WhatsApp

2. Página de cadastro de devedores

Campos:

- Nome do devedor

- WhatsApp do devedor, aceitar com ou sem +55

- Descrição da cobrança

- Valor da parcela

- Parcela atual

- Total de parcelas

- Data de vencimento

- Anuidade mensal opcional

- Status: pendente, aguardando confirmação, pago

- Botão cadastrar

3. Lista de cobranças

Mostrar:

- Nome

- WhatsApp

- Valor

- Vencimento

- Parcela atual / total

- Status

- Botão enviar cobrança agora

- Botão marcar como pago

- Botão editar

- Botão excluir

4. Envio pelo WhatsApp usando Evolution

Criar função backend para enviar mensagem:

POST para Evolution:

{{EVOLUTION_URL}}/message/sendText/{{INSTANCE_NAME}}

Headers:

apikey: {{EVOLUTION_API_KEY}}

Content-Type: application/json

Body:

{

  "number": "55DDDNUMERO",

  "text": "mensagem"

}

5. Mensagem de cobrança

A mensagem deve ser assim:

[Cobranças]

Assistente automática de cobranças

Olá, {{nome}}.

Estou passando para lembrar da cobrança:

{{descricao}}

Valor: R$ {{valor}}

Parcela: {{parcela_atual}}/{{total_parcelas}}

Vencimento: {{vencimento}}

Pix:

Chave: {{pix}}

Titular: {{titular}}

Banco: {{banco}}

Após pagar, responda: PAGUEI {{codigo}}

6. Confirmação manual

Quando o cliente responder PAGUEI ou mandar comprovante, o sistema NÃO deve marcar pago automaticamente.

Ele deve mandar mensagem para o dono/admin:

"{{cliente}} informou pagamento da cobrança {{codigo}} no valor de R$ {{valor}}. Confira no banco e responda: SIM {{codigo}} ou NÃO {{codigo}}"

Se o dono responder:

SIM {{codigo}}

- marcar como pago

- salvar data de pagamento

- enviar mensagem ao cliente:

"Pagamento confirmado. Obrigado!"

Se o dono responder:

NÃO {{codigo}}

- manter como pendente

- enviar mensagem ao cliente:

"Ainda não consegui confirmar o pagamento. Por favor confira o Pix."

7. Webhook para receber mensagens do Evolution

Criar endpoint backend:

POST /webhook/evolution

Esse endpoint deve ler eventos do Evolution, principalmente MESSAGES_UPSERT.

Ele deve identificar:

- número de quem mandou

- texto da mensagem

- se tem imagem/documento

- se é mensagem do admin ou do cliente

8. Agendamento de cobrança

Criar rotina automática:

- Todo dia verificar cobranças pendentes

- Enviar somente entre 08:00 e 10:00

- Enviar às 08:00 e às 10:00

- Não enviar se já estiver pago

- Não enviar se estiver aguardando confirmação

- Se a data de vencimento for hoje ou já passou, pode cobrar

- Depois que pagar, parar cobrança

9. Segurança

- API key do Evolution não pode aparecer no HTML

- Criar login simples de admin

- Proteger painel com senha

- Proteger webhook com token opcional

- Não salvar senha em texto puro

10. Banco de dados

Pode usar SQLite, PostgreSQL ou banco interno do LowCode.

Tabelas:

settings

debtors

charges

payments

messages_log

11. Visual

Criar painel simples e fácil para celular:

- Dashboard com total pendente, pagos, aguardando confirmação

- Botão grande "Cadastrar cobrança"

- Botão grande "Enviar teste WhatsApp"

- Status colorido: pendente vermelho, aguardando amarelo, pago verde

12. Entrega

Gerar projeto completo funcionando com:

- Frontend HTML/CSS/JS

- Backend com rotas API

- Configuração Evolution

- Webhook

- Cadastro

- Envio manual

- Agendamento

- README explicando como configurar no Evolution

Importante:

Não usar n8n.

O sistema deve funcionar direto com Evolution API.

Primeiro passo do sistema deve pedir URL do Evolution, nome da instância e API Key.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cobranca-whats-easy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/160ad143-8947-4ba3-afdb-6f88b9684b9f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Configuração do WhatsApp

O sistema usa a Evolution API direto, sem n8n. A chave da Evolution fica salva no servidor e não aparece no HTML depois de gravada.

1. Entre no sistema e faça login.
2. Abra **Config**.
3. Preencha:
   - **URL base do Evolution**: exemplo `https://evolution-api-production-c674.up.railway.app`
   - **Nome da instância**: exemplo `Julio`
   - **API Key do Evolution**: valor de `AUTHENTICATION_API_KEY`
   - **Número do dono/admin**: formato `55DDDNUMERO`
   - **Chave Pix**, **titular** e **banco**
4. Clique em **Salvar configuração**.
5. Clique em **Testar conexão com Evolution**.
6. Clique em **Enviar mensagem teste**.

## Webhook no Evolution

No painel da Evolution, configure o webhook da instância conectada:

- **Webhook URL**: `https://SEU-DOMINIO/api/public/webhook/evolution`
- **Evento**: `MESSAGES_UPSERT`
- **Webhook ativo**: ligado

Se você preencher **Token do webhook** na tela de configuração, envie esse token no cabeçalho:

```text
x-webhook-token: SEU_TOKEN
```

ou coloque no final da URL:

```text
https://SEU-DOMINIO/api/public/webhook/evolution?token=SEU_TOKEN
```

## Como a confirmação funciona

O cliente responde:

```text
PAGUEI COB12345
```

O sistema avisa o dono/admin. O pagamento só é confirmado quando o dono responder:

```text
SIM COB12345
```

Para recusar e voltar para pendente:

```text
NAO COB12345
```

## Cobrança automática

A rota de cobrança automática é:

```text
POST /api/public/hooks/enviar-cobrancas
Authorization: Bearer CHARGE_CRON_TOKEN
```

Ela envia cobranças pendentes com vencimento hoje ou vencido, somente na janela de 08:00 até 10:00 no horário de Fortaleza. Configure a variável de ambiente `CHARGE_CRON_TOKEN` no servidor e chame essa rota por um agendador às 08:00 e às 10:00.