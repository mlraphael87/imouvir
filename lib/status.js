export const STATUSES = [
  { key: "documentacao_recebida", label: "Documentação recebida" },
  { key: "teste_agendado", label: "Teste agendado" },
  { key: "teste_realizado", label: "Teste realizado" },
  { key: "paciente_aprovou", label: "Paciente aprovou" },
  { key: "pedido_enviado", label: "Pedido enviado à fábrica" },
  { key: "aguardando_chegada", label: "Aguardando chegada" },
  { key: "adaptacao_agendada", label: "Retorno/adaptação agendado" },
  { key: "concluido", label: "Concluído" }
];

export const statusLabel = (key) => STATUSES.find((status) => status.key === key)?.label || key;
