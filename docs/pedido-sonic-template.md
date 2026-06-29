# Modelo de pedido SONIC

Este documento registra as regras para gerar pedidos da SONIC a partir do CRM.

## Arquivo analisado

Modelo recebido de Uberlandia, mantido fora do repositório por conter dados reais de paciente e endereço.

O arquivo original não deve ser alterado. Qualquer automação precisa trabalhar sobre uma cópia temporária.

## Abas encontradas

- `Planilha de Pedidos SONIC`: aba visual do pedido enviado para faturamento/fábrica.
- `Planilha1`: catálogo interno com descrições, códigos, condições de pagamento e valores.
- `Sheet1`: catálogo auxiliar usado pelas fórmulas da planilha principal.
- `ENDEREÇAMENTO`: texto pronto de faturamento/entrega.
- `Sheet2`: aba vazia.

## Dados protegidos

Não alterar manualmente pelo CRM:

- códigos de fábrica;
- valores unitários;
- fórmulas;
- abas auxiliares de catálogo;
- totais calculados;
- células marcadas como área de não edição.

Na planilha principal, muitos campos usam fórmulas, por exemplo:

- `C9`: busca o código da condição de pagamento a partir de `C8`.
- `B13:B28`: busca código do item a partir da descrição em `C13:C28`.
- `E15:E28`: busca valor unitário a partir da descrição.
- `F13:F28`: calcula total por item.
- linhas de bonificação seguem o mesmo padrão.

## Células variáveis identificadas

Campos de cabeçalho:

- `F3`: número do pedido.
- `C6`: endereço de entrega.
- `F6`: CEP.
- `C7`: referência/nome do paciente.
- `F7`: cidade.
- `C8`: condição de pagamento.
- `F8`: texto de pagamento.
- `C10`: observação de nota fiscal.

Itens do pedido:

- `C13:C28`: descrição dos aparelhos/acessórios do pedido.
- `D13:D28`: quantidade.

Itens de bonificação:

- `C32:C39`: descrição dos itens de bonificação.
- `D32:D39`: quantidade.

O CRM deve preencher descrições exatamente como estão cadastradas no catálogo da planilha, para que os `VLOOKUP` retornem os códigos e valores corretos.

## Estratégia correta de implementação

1. Guardar templates reais em armazenamento privado, não no GitHub público.
2. Ao gerar um pedido, copiar o template original para memória/arquivo temporário.
3. Preencher somente as células variáveis listadas acima.
4. Preservar fórmulas, abas auxiliares, merges e valores protegidos.
5. Baixar o Excel preenchido para envio por e-mail.

## Endereços por cidade

Os endereços de entrega devem entrar em tabela separada do banco:

- cidade;
- UF;
- destinatário;
- empresa;
- endereço;
- complemento;
- bairro;
- CEP;
- observação de NF.

Quando todos os endereços forem enviados, o CRM deve selecionar automaticamente o endereço pelo campo cidade/UF do pedido.
