# IMOUVIR CRM

CRM leve para acompanhar pedidos de aparelhos auditivos da IMOUVIR.

## Stack

- Next.js para deploy na Vercel
- PostgreSQL gratuito via Neon ou Supabase
- Exportacao Excel `.xlsx`
- Autenticacao simples por senha via variavel de ambiente

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no ambiente local ou configure na Vercel:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
CRM_PASSWORD="uma-senha-forte"
SESSION_SECRET="uma-chave-grande-aleatoria"
```

## Banco

Execute o arquivo:

```text
sql/schema.sql
```

no SQL Editor do Neon ou Supabase.

## Deploy na Vercel

Projeto sugerido: `imouvir`.

Se o nome nao estiver disponivel, use `imouvir-crm`.

## Fluxo do pedido

1. Documentacao recebida
2. Teste agendado
3. Teste realizado
4. Paciente aprovou
5. Pedido enviado a fabrica
6. Aguardando chegada
7. Retorno/adaptacao agendado
8. Concluido
