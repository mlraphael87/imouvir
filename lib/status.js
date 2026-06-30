export const STATUSES = [
  { key: "documentacao_recebida", label: "Pré-cadastro" },
  { key: "teste_agendado", label: "Teste agendado" },
  { key: "teste_realizado", label: "Teste realizado" },
  { key: "paciente_aprovou", label: "Aprovou aparelho" },
  { key: "pedido_enviado", label: "Pedido enviado" },
  { key: "aguardando_chegada", label: "Aguardando chegada" },
  { key: "adaptacao_agendada", label: "Adaptação agendada" },
  { key: "concluido", label: "Concluído" }
];

export const statusLabel = (key) => STATUSES.find((status) => status.key === key)?.label || key;
