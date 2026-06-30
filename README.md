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

## Planilhas de pedido

Modelos reais de pedido da fábrica não devem ser versionados no GitHub porque podem conter dados de paciente, endereço e condições comerciais.

As regras do modelo SONIC analisado estão em:

```text
docs/pedido-sonic-template.md
```

A geração final do Excel deve preencher apenas células variáveis do pedido, preservando códigos, valores, fórmulas e abas auxiliares da planilha original.

## Deploy na Vercel

Projeto sugerido: `imouvir`.

Se o nome nao estiver disponivel, use `imouvir-crm`.

### Banco gratuito Neon pela Vercel

Quando a organização Neon é gerenciada pela Vercel, a criação direta por `neonctl projects create` pode ser bloqueada com:

```text
action restricted; organization is managed by Vercel
```

Nesse caso, crie o banco pelo painel da Vercel:

1. Acesse o projeto `imouvir` na Vercel.
2. Abra `Storage` ou `Marketplace`.
3. Escolha `Neon`.
4. Crie um banco Postgres gratuito para o projeto.
5. Conecte o banco ao ambiente `Production`.
6. Confirme se a Vercel criou `DATABASE_URL` ou `POSTGRES_URL`.
7. Adicione também:

```env
CRM_PASSWORD="uma-senha-forte"
SESSION_SECRET="uma-chave-grande-aleatoria"
```

O código aceita `DATABASE_URL` e `POSTGRES_URL`.

Depois, execute `sql/schema.sql` no SQL Editor do Neon.

## Fluxo do pedido

1. Documentacao recebida
2. Teste agendado
3. Teste realizado
4. Paciente aprovou
5. Pedido enviado a fabrica
6. Aguardando chegada
7. Retorno/adaptacao agendado
8. Concluido
