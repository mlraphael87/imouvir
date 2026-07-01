"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STATUSES, statusLabel } from "@/lib/status";

const emptyForm = {
  status: "teste_agendado",
  patient_name: "",
  cpf: "",
  sus_card: "",
  birth_date: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  medical_request_date: "",
  audiometry_date: "",
  hearing_loss: "",
  documentation_notes: "",
  test_date: "",
  audiologist_name: "",
  test_result: "",
  patient_approved: false,
  order_date: "",
  factory_order_number: "",
  selected_payment_term_id: "",
  payment_terms: "",
  payment_description: "",
  payment_code: "",
  selected_device_product_id: "",
  selected_accessory_product_ids: [],
  accessory_items: [],
  device_side: "bilateral",
  device_brand: "",
  device_model: "",
  right_device_code: "",
  left_device_code: "",
  accessory_codes: "",
  factory_value_cents: 0,
  patient_value_cents: 0,
  arrival_date: "",
  adaptation_date: "",
  notes: ""
};

const currencyToCents = (value) => Math.round(Number(String(value).replace(",", ".") || 0) * 100);
const centsToCurrency = (value) => (Number(value || 0) / 100).toFixed(2).replace(".", ",");
const moneyLabel = (value) => `R$ ${centsToCurrency(value)}`;
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const onlyDigits = (value) => String(value || "").replace(/\D/g, "");
const isValidPhone = (value) => /^\d{11}$/.test(onlyDigits(value));
const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};
const isValidCpf = (value) => {
  const digits = onlyDigits(value);
  if (!digits) return true;
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (base) => {
    let sum = 0;
    for (let index = 0; index < base.length; index += 1) {
      sum += Number(base[index]) * (base.length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(digits.slice(0, 9)) === Number(digits[9])
    && calculateDigit(digits.slice(0, 10)) === Number(digits[10]);
};
const isValidEmail = (value) => {
  const email = String(value || "").trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};
const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthLabel = (date) => date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const eventTypeLabel = (type) => type === "adaptation_date" ? "Adaptação" : "Teste";
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const workflowStages = [
  {
    key: "agendamento_teste",
    title: "1. Agendamento teste",
    description: "Horários agendados e testes já realizados com o fonoaudiólogo.",
    statuses: ["teste_agendado", "teste_realizado"]
  },
  {
    key: "pedido_aparelho",
    title: "2. Pedido do aparelho",
    description: "Paciente aprovou, escolha de aparelho, acessórios e envio à fábrica.",
    statuses: ["paciente_aprovou", "pedido_enviado", "aguardando_chegada"]
  },
  {
    key: "entrega_adaptacao",
    title: "3. Entrega e adaptação",
    description: "Aparelho chegou, retorno agendado e processo concluído.",
    statuses: ["adaptacao_agendada", "concluido"]
  }
];

const documentTypeOptions = [
  { key: "medical_request", label: "Pedido médico" },
  { key: "audiometry_exam", label: "Exame de audiometria" },
  { key: "payment_receipt", label: "Comprovante de pagamento" },
  { key: "other", label: "Outro documento" }
];

const formSteps = [
  { key: "cadastro", label: "Cadastro" },
  { key: "teste", label: "Teste" },
  { key: "pedido", label: "Pedido" },
  { key: "entrega", label: "Entrega" },
  { key: "documentos", label: "Documentos" }
];

const documentTypeLabel = (key) => documentTypeOptions.find((item) => item.key === key)?.label || "Documento";
const fileSizeLabel = (size) => {
  const value = Number(size || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
};

function appointmentDateTime(appointment) {
  const value = appointment.starts_at_local || String(appointment.starts_at || "").slice(0, 16);
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

function appointmentDateLabel(appointment) {
  const { date, time } = appointmentDateTime(appointment);
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} às ${time}`;
}

function patientDateTimeLabel(value) {
  if (!value) return "-";
  const [date = "", timeWithSeconds = ""] = String(value).slice(0, 16).split("T");
  const [year, month, day] = date.split("-");
  const time = timeWithSeconds.slice(0, 5);
  if (!year || !month || !day || !time) return "-";
  return `${day}/${month}/${year}, ${time}`;
}

function whatsappHref(appointment) {
  const digits = onlyDigits(appointment.phone);
  if (!isValidPhone(digits)) return "";
  const phone = `55${digits}`;
  const message = `Olá, o Instituto Imouvir gostaria de confirmar seu agendamento para o teste de aparelho auditivo que está marcado para ${appointmentDateLabel(appointment)}?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function DashboardClient({ initialAuthenticated }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [activeWorkflowMetric, setActiveWorkflowMetric] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [activeFormStep, setActiveFormStep] = useState("cadastro");
  const [patientFiles, setPatientFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadType, setUploadType] = useState("medical_request");
  const [uploadFile, setUploadFile] = useState(null);
  const [catalog, setCatalog] = useState({ products: [], paymentTerms: [] });
  const [formMode, setFormMode] = useState("schedule");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const products = catalog.products || [];
  const devices = useMemo(() => products.filter((item) => item.item_kind === "device"), [products]);
  const accessories = useMemo(() => products.filter((item) => item.item_kind !== "device"), [products]);
  const appointmentsByDay = useMemo(() => {
    const grouped = {};
    for (const appointment of appointments) {
      const key = appointmentDateTime(appointment).date;
      grouped[key] = [...(grouped[key] || []), appointment];
    }
    return grouped;
  }, [appointments]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const workflowTotals = useMemo(() => {
    return workflowStages.map((stage) => ({
      ...stage,
      total: stage.statuses.reduce((sum, status) => sum + Number(totals[status] || 0), 0)
    }));
  }, [totals]);
  const selectedStage = useMemo(() => workflowTotals.find((stage) => stage.key === stageFilter), [stageFilter, workflowTotals]);
  const displayedRows = useMemo(() => {
    if (!selectedStage) return rows;
    return rows.filter((row) => selectedStage.statuses.includes(row.status));
  }, [rows, selectedStage]);

  useEffect(() => {
    if (authenticated) {
      loadPatients();
      loadCatalog();
    }
  }, [authenticated, statusFilter]);

  useEffect(() => {
    if (authenticated) loadAppointments();
  }, [authenticated, calendarMonth]);

  async function login(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      setMessage("Senha inválida ou variável CRM_PASSWORD não configurada.");
      return;
    }
    setAuthenticated(true);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  }

  async function loadPatients() {
    setLoading(true);
    const params = new URLSearchParams();
    const searchQuery = query.trim();
    if (searchQuery) params.set("q", searchQuery);
    params.set("limit", searchQuery ? "200" : "3");
    if (statusFilter) params.set("status", statusFilter);
    const response = await fetch(`/api/patients?${params.toString()}`);
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = await response.json();
    setRows(data.rows || []);
    setTotals(data.totals || {});
    setLoading(false);
  }

  async function loadAppointments(monthDate = calendarMonth) {
    setAppointmentsLoading(true);
    const response = await fetch(`/api/appointments?month=${monthKey(monthDate)}`);
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = await response.json();
    setAppointments(data.events || []);
    setAppointmentsLoading(false);
  }

  function moveCalendarMonth(offset) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function editAppointment(appointment) {
    const response = await fetch(`/api/patients/${appointment.id}`);
    if (!response.ok) return;
    const data = await response.json();
    edit(data.row, "schedule");
    document.getElementById("novo-pedido")?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadCatalog() {
    const response = await fetch("/api/catalog");
    if (!response.ok) return;
    const data = await response.json();
    setCatalog({
      products: data.products || [],
      paymentTerms: data.paymentTerms || []
    });
  }

  async function loadPatientFiles(patientId) {
    if (!patientId) {
      setPatientFiles([]);
      return;
    }

    setFilesLoading(true);
    const response = await fetch(`/api/patients/${patientId}/files`);
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = await response.json();
    setPatientFiles(data.files || []);
    setFilesLoading(false);
  }

  function findProduct(id) {
    return products.find((item) => String(item.id) === String(id));
  }

  function findPaymentTerm(id) {
    return catalog.paymentTerms.find((item) => String(item.id) === String(id));
  }

  function productLabel(product) {
    const code = product.code ? `${product.code} - ` : "";
    return `${code}${product.description} (${moneyLabel(product.unit_value_cents)})`;
  }

  function normalizeAccessoryItems(items) {
    return (items || [])
      .map((item) => ({
        product_id: item.product_id ? String(item.product_id) : "",
        quantity: Math.max(1, Number(item.quantity || 1))
      }))
      .filter((item) => item.product_id);
  }

  function accessoryItemsFromLegacyIds(ids) {
    return (ids || []).map((id) => ({ product_id: String(id), quantity: 1 }));
  }

  function calculateFactoryValueCents(nextForm) {
    const selectedDevice = findProduct(nextForm.selected_device_product_id);
    const accessoryItems = normalizeAccessoryItems(
      nextForm.accessory_items?.length ? nextForm.accessory_items : accessoryItemsFromLegacyIds(nextForm.selected_accessory_product_ids)
    );
    const deviceQuantity = selectedDevice ? (nextForm.device_side === "bilateral" ? 2 : 1) : 0;
    const deviceTotal = selectedDevice ? Number(selectedDevice.unit_value_cents || 0) * deviceQuantity : 0;
    const accessoriesTotal = accessoryItems.reduce((sum, item) => {
      const product = findProduct(item.product_id);
      return sum + (product ? Number(product.unit_value_cents || 0) * Number(item.quantity || 1) : 0);
    }, 0);
    return deviceTotal + accessoriesTotal;
  }

  function hydrateCatalogFields(nextForm) {
    const selectedDevice = findProduct(nextForm.selected_device_product_id);
    const rawAccessoryItems = nextForm.accessory_items?.length
      ? nextForm.accessory_items
      : accessoryItemsFromLegacyIds(nextForm.selected_accessory_product_ids);
    const accessoryItems = normalizeAccessoryItems(
      rawAccessoryItems
    );
    const selectedAccessoryProductIds = [...new Set(accessoryItems.map((item) => Number(item.product_id)).filter(Boolean))];
    const side = nextForm.device_side || "bilateral";
    const deviceCode = selectedDevice?.code || "";

    return {
      ...nextForm,
      accessory_items: rawAccessoryItems,
      selected_accessory_product_ids: selectedAccessoryProductIds,
      device_brand: selectedDevice ? "Sonic" : nextForm.device_brand,
      device_model: selectedDevice?.description || nextForm.device_model,
      right_device_code: side === "esquerdo" ? "" : deviceCode,
      left_device_code: side === "direito" ? "" : deviceCode,
      accessory_codes: accessoryItems.map((item) => {
        const product = findProduct(item.product_id);
        return product ? `${item.quantity}x ${product.code || "sem codigo"} - ${product.description}` : "";
      }).filter(Boolean).join("; "),
      factory_value_cents: calculateFactoryValueCents(nextForm),
      factory_value_cents_display: undefined
    };
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "patient_approved" && value && ["documentacao_recebida", "teste_agendado", "teste_realizado"].includes(current.status)) {
        next.status = "paciente_aprovou";
      }
      if ((key === "order_date" || key === "factory_order_number") && value && ["paciente_aprovou", "teste_realizado"].includes(current.status)) {
        next.status = "pedido_enviado";
      }
      if (key === "arrival_date" && value && ["pedido_enviado", "aguardando_chegada"].includes(current.status)) {
        next.status = "aguardando_chegada";
      }
      if (key === "adaptation_date" && value && ["aguardando_chegada", "pedido_enviado"].includes(current.status)) {
        next.status = "adaptacao_agendada";
      }
      if (["selected_device_product_id", "selected_accessory_product_ids", "accessory_items", "device_side"].includes(key)) {
        return hydrateCatalogFields(next);
      }
      return next;
    });
  }

  function addAccessoryItem() {
    setForm((current) => ({
      ...current,
      accessory_items: [...(current.accessory_items || []), { product_id: "", quantity: 1 }]
    }));
  }

  function updateAccessoryItem(index, key, value) {
    setForm((current) => {
      const accessoryItems = [...(current.accessory_items || [])];
      accessoryItems[index] = {
        ...accessoryItems[index],
        [key]: key === "quantity" ? value.replace(/\D/g, "") : value
      };
      return hydrateCatalogFields({ ...current, accessory_items: accessoryItems });
    });
  }

  function normalizeAccessoryQuantity(index) {
    setForm((current) => {
      const accessoryItems = [...(current.accessory_items || [])];
      const currentItem = accessoryItems[index];
      if (!currentItem) return current;
      accessoryItems[index] = {
        ...currentItem,
        quantity: Math.max(1, Number(currentItem.quantity || 1))
      };
      return hydrateCatalogFields({ ...current, accessory_items: accessoryItems });
    });
  }

  function removeAccessoryItem(index) {
    setForm((current) => hydrateCatalogFields({
      ...current,
      accessory_items: (current.accessory_items || []).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function updatePaymentTerm(id) {
    const term = findPaymentTerm(id);
    setForm((current) => ({
      ...current,
      selected_payment_term_id: id,
      payment_terms: term?.terms || "",
      payment_description: term?.description || "",
      payment_code: term?.code || ""
    }));
  }

  function edit(row, mode = "schedule") {
    setFormMode(mode);
    setActiveFormStep(mode === "order" ? "pedido" : "cadastro");
    setEditingId(row.id);
    loadPatientFiles(row.id);
    setForm({
      ...emptyForm,
      ...row,
      cpf: formatCpf(row.cpf),
      phone: formatPhone(row.phone),
      birth_date: row.birth_date || "",
      medical_request_date: row.medical_request_date || "",
      audiometry_date: row.audiometry_date || "",
      test_date: row.test_date ? row.test_date.slice(0, 16) : "",
      order_date: row.order_date || "",
      selected_payment_term_id: row.selected_payment_term_id || "",
      selected_device_product_id: row.selected_device_product_id || "",
      selected_accessory_product_ids: row.selected_accessory_product_ids || [],
      accessory_items: row.accessory_items?.length ? row.accessory_items : accessoryItemsFromLegacyIds(row.selected_accessory_product_ids),
      arrival_date: row.arrival_date || "",
      adaptation_date: row.adaptation_date ? row.adaptation_date.slice(0, 16) : ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setFormMode("schedule");
    setActiveFormStep("cadastro");
    setForm(emptyForm);
    setPatientFiles([]);
    setUploadFile(null);
    setUploadType("medical_request");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startOrder(row) {
    edit(row, "order");
    setActiveFormStep("pedido");
    document.getElementById("novo-pedido")?.scrollIntoView({ behavior: "smooth" });
  }

  function startDocuments(row) {
    edit(row, "schedule");
    setActiveFormStep("documentos");
    document.getElementById("novo-pedido")?.scrollIntoView({ behavior: "smooth" });
  }

  function openOnEnter(event, callback) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  }

  async function savePatient(event, intent = formMode) {
    event.preventDefault();
    setMessage("");
    if (!form.patient_name?.trim()) {
      setMessage("Informe o nome do paciente.");
      return;
    }
    if (!isValidPhone(form.phone)) {
      setMessage("Informe um telefone valido com 11 digitos: 2 de DDD + 9 do telefone.");
      return;
    }
    if (!isValidCpf(form.cpf)) {
      setMessage("Informe um CPF valido.");
      setActiveFormStep("cadastro");
      return;
    }
    if (!isValidEmail(form.email)) {
      setMessage("Informe um e-mail valido.");
      setActiveFormStep("cadastro");
      return;
    }
    if (intent === "schedule" && !editingId && !form.test_date) {
      setMessage("Informe a data e horário do teste para aparecer na agenda.");
      return;
    }
    const payload = {
      ...form,
      cpf: onlyDigits(form.cpf),
      email: String(form.email || "").trim().toLowerCase(),
      phone: onlyDigits(form.phone),
      selected_payment_term_id: form.selected_payment_term_id || null,
      selected_device_product_id: form.selected_device_product_id || null,
      selected_accessory_product_ids: form.selected_accessory_product_ids || [],
      accessory_items: normalizeAccessoryItems(form.accessory_items),
      factory_value_cents: currencyToCents(form.factory_value_cents_display ?? centsToCurrency(form.factory_value_cents)),
      patient_value_cents: currencyToCents(form.patient_value_cents_display ?? centsToCurrency(form.patient_value_cents))
    };
    if (intent === "schedule" && !editingId) {
      payload.status = "teste_agendado";
    }
    delete payload.factory_value_cents_display;
    delete payload.patient_value_cents_display;

    const response = await fetch(editingId ? `/api/patients/${editingId}` : "/api/patients", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível salvar.");
      return;
    }
    setMessage(editingId ? "Edição salva." : intent === "schedule" ? "Cadastro e agendamento salvos." : "Pedido cadastrado.");
    const appointmentDate = data.row?.test_date || data.row?.adaptation_date;
    if (appointmentDate) {
      const nextMonth = new Date(appointmentDate);
      setCalendarMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
      await loadAppointments(nextMonth);
    }
    resetForm();
    loadPatients();
    if (!appointmentDate) loadAppointments();
  }

  function exportCurrentPatientOrder() {
    if (!editingId) {
      setMessage("Salve ou abra um cadastro antes de gerar o pedido.");
      return;
    }
    window.location.href = `/api/export?ids=${editingId}`;
  }

  function exportPatientExcel(row) {
    window.location.href = `/api/export?ids=${row.id}`;
  }

  function countStatus(status) {
    return Number(totals[status] || 0);
  }

  function metricButtonClass(isActive, key) {
    return ["mini-filter", isActive ? "active" : "", activeWorkflowMetric === key ? "show-count" : ""].filter(Boolean).join(" ");
  }

  function formStepClass(step) {
    return activeFormStep === step ? "form-step-panel active" : "form-step-panel";
  }

  function showWorkflowMetric(key) {
    setActiveWorkflowMetric(key);
  }

  function toggleStageFilter(stage) {
    setStageFilter(stageFilter === stage.key ? "" : stage.key);
    setStatusFilter("");
    showWorkflowMetric(`${stage.key}:all`);
  }

  function toggleStatusFilter(stage, status) {
    setStageFilter("");
    setStatusFilter(statusFilter === status ? "" : status);
    showWorkflowMetric(`${stage.key}:${status}`);
  }

  async function uploadPatientFile() {
    setMessage("");
    if (!editingId) {
      setMessage("Salve o cadastro antes de anexar documentos.");
      return;
    }
    if (!uploadFile) {
      setMessage("Selecione um arquivo para anexar.");
      return;
    }

    const formData = new FormData();
    formData.append("document_type", uploadType);
    formData.append("file", uploadFile);

    const response = await fetch(`/api/patients/${editingId}/files`, {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível anexar o arquivo.");
      return;
    }

    setMessage("Documento anexado ao histórico do paciente.");
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadPatientFiles(editingId);
    await loadPatients();
  }

  async function deletePatientFile(fileId) {
    if (!window.confirm("Excluir este documento do histórico do paciente?")) return;

    const response = await fetch(`/api/patients/${editingId}/files/${fileId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Não foi possível excluir o documento.");
      return;
    }

    setMessage("Documento excluído.");
    await loadPatientFiles(editingId);
    await loadPatients();
  }

  if (!authenticated) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <img src="/assets/logo-imouvir-header.png" alt="Instituto IMOUVIR" />
          <h1>CRM IMOUVIR</h1>
          <p>Acesso operacional para acompanhamento de pedidos de aparelhos auditivos.</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha do CRM"
            autoFocus
          />
          <button type="submit">Entrar</button>
          {message ? <small>{message}</small> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <img src="/assets/logo-imouvir-header.png" alt="Instituto IMOUVIR" />
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#agendamentos">Agendamentos</a>
          <a href="#novo-pedido">Novo pedido</a>
          <a href="#lista">Pedidos</a>
        </nav>
        <button className="ghost-button" onClick={logout}>Sair</button>
      </aside>

      <section className="workspace">
        <header className="topbar" id="dashboard">
          <div>
            <p className="eyebrow">Operação IMOUVIR</p>
            <h1>Dashboard de pedidos</h1>
          </div>
        </header>

        <section className="workflow-board">
          {workflowTotals.map((stage) => (
            <article key={stage.title} className="workflow-card">
              <div>
                <span>{stage.title}</span>
                <strong>{stage.total}</strong>
              </div>
              <p>{stage.description}</p>
              <div className="workflow-actions">
                <button
                  type="button"
                  className={metricButtonClass(stageFilter === stage.key, `${stage.key}:all`)}
                  onMouseEnter={() => showWorkflowMetric(`${stage.key}:all`)}
                  onFocus={() => showWorkflowMetric(`${stage.key}:all`)}
                  onClick={() => toggleStageFilter(stage)}
                >
                  <span>Todos</span>
                  <strong className="mini-filter-count">{stage.total}</strong>
                </button>
                {stage.statuses.map((status) => (
                  <button
                    type="button"
                    className={metricButtonClass(statusFilter === status, `${stage.key}:${status}`)}
                    key={status}
                    onMouseEnter={() => showWorkflowMetric(`${stage.key}:${status}`)}
                    onFocus={() => showWorkflowMetric(`${stage.key}:${status}`)}
                    onClick={() => toggleStatusFilter(stage, status)}
                  >
                    <span>{statusLabel(status)}</span>
                    <strong className="mini-filter-count">{countStatus(status)}</strong>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="panel" id="agendamentos">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2>Agendamentos do mês</h2>
            </div>
            <div className="calendar-controls">
              <button type="button" className="secondary" onClick={() => moveCalendarMonth(-1)}>Mês anterior</button>
              <strong>{monthLabel(calendarMonth)}</strong>
              <button type="button" className="secondary" onClick={() => moveCalendarMonth(1)}>Próximo mês</button>
            </div>
          </div>

          <div className="calendar-summary">
            <article>
              <span>Total no mês</span>
              <strong>{appointments.length}</strong>
            </article>
            <article>
              <span>Testes</span>
              <strong>{appointments.filter((item) => item.event_type === "test_date").length}</strong>
            </article>
            <article>
              <span>Adaptações</span>
              <strong>{appointments.filter((item) => item.event_type === "adaptation_date").length}</strong>
            </article>
          </div>

          <div className="calendar-grid">
            {weekDays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {calendarDays.map((day) => {
              const key = dateKey(day.date);
              const dayAppointments = appointmentsByDay[key] || [];
              return (
                <div className={day.inMonth ? "calendar-day" : "calendar-day muted-day"} key={key}>
                  <span className="calendar-date">{day.date.getDate()}</span>
                  <div className="calendar-events">
                    {dayAppointments.map((appointment) => {
                      const { time } = appointmentDateTime(appointment);
                      const whatsapp = whatsappHref(appointment);
                      return (
                        <div
                          className={`calendar-event ${appointment.event_type === "adaptation_date" ? "adaptation-event" : "test-event"}`}
                          key={`${appointment.event_type}-${appointment.id}-${appointment.starts_at}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => editAppointment(appointment)}
                          onKeyDown={(event) => openOnEnter(event, () => editAppointment(appointment))}
                        >
                          <span>{time} · {eventTypeLabel(appointment.event_type)}</span>
                          <strong>{appointment.patient_name}</strong>
                          {whatsapp ? (
                            <a className="whatsapp-link" href={whatsapp} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                              {formatPhone(appointment.phone)}
                            </a>
                          ) : (
                            <small>Sem telefone</small>
                          )}
                          <button type="button" className="calendar-edit" onClick={(event) => { event.stopPropagation(); editAppointment(appointment); }}>Editar</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {appointmentsLoading ? <p className="calendar-loading">Carregando agenda...</p> : null}
        </section>

        <section className="panel" id="novo-pedido">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{formMode === "schedule" ? "Cadastro e agenda" : "Pedido do aparelho"}</p>
              <h2>{editingId ? `Paciente #${editingId} · ${patientFiles.length} documento${patientFiles.length === 1 ? "" : "s"}` : formMode === "schedule" ? "Novo cadastro e agendamento" : "Novo pedido de aparelho"}</h2>
            </div>
            <div className="mode-actions">
              <button type="button" className={formMode === "schedule" ? "mode-active" : ""} onClick={(event) => savePatient(event, "schedule")}>
                Salvar agendamento
              </button>
              <button type="button" className={formMode === "order" ? "secondary mode-active" : "secondary"} onClick={() => { setFormMode("order"); setActiveFormStep("pedido"); }}>
                Fazer pedido
              </button>
              {editingId ? <button type="button" className={activeFormStep === "documentos" ? "secondary mode-active" : "secondary"} onClick={() => setActiveFormStep("documentos")}>Anexar documentos</button> : null}
              {editingId ? <button type="button" className="secondary" onClick={(event) => savePatient(event, "edit")}>Salvar edição</button> : null}
            </div>
          </div>

          <form className="patient-form" onSubmit={savePatient}>
            <div className="form-step-tabs">
              {formSteps.map((step) => (
                <button
                  type="button"
                  key={step.key}
                  className={[
                    "form-step-tab",
                    activeFormStep === step.key ? "active" : "",
                    editingId && step.key === "documentos" ? "has-documents-entry" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => setActiveFormStep(step.key)}
                >
                  {step.label}
                  {editingId && step.key === "documentos" ? <small>{patientFiles.length}</small> : null}
                </button>
              ))}
            </div>

            <div className={formStepClass("cadastro")}>
              <div className="form-section-title">
                <span>1. Cadastro e agendamento do teste</span>
                <p>Primeiro contato: dados pessoais e horário com o fonoaudiólogo.</p>
              </div>
              <Field label="Nome do paciente" required value={form.patient_name} onChange={(v) => updateField("patient_name", v)} />
              <Field label="CPF" value={formatCpf(form.cpf)} onChange={(v) => updateField("cpf", formatCpf(v))} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" />
              <Field label="Nascimento" type="date" value={form.birth_date || ""} onChange={(v) => updateField("birth_date", v)} />
              <Field
                label="Telefone"
                value={formatPhone(form.phone)}
                onChange={(v) => updateField("phone", formatPhone(v))}
                inputMode="numeric"
                maxLength={15}
                placeholder="(65) 99999-9999"
              />
              <Field label="E-mail" type="email" value={form.email || ""} onChange={(v) => updateField("email", v)} placeholder="nome@email.com" />
              <Field label="Cidade - UF" value={form.city || ""} onChange={(v) => updateField("city", v)} placeholder="Ex.: Cuiabá - MT" />

              <label>
                Etapa atual
                <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                  {STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                </select>
              </label>
              <Field label="Teste com aparelho" type="datetime-local" value={form.test_date || ""} onChange={(v) => updateField("test_date", v)} />
              <Field label="Fonoaudiólogo" value={form.audiologist_name || ""} onChange={(v) => updateField("audiologist_name", v)} />
            </div>

            <div className={formStepClass("teste")}>
              <div className="form-section-title">
                <span>2. Resultado do teste</span>
                <p>Após o atendimento, registre documentos, resultado e aprovação do paciente.</p>
              </div>
              <Field label="Data do pedido médico" type="date" value={form.medical_request_date || ""} onChange={(v) => updateField("medical_request_date", v)} />
              <Field label="Data da audiometria" type="date" value={form.audiometry_date || ""} onChange={(v) => updateField("audiometry_date", v)} />
              <Field label="Perda auditiva" value={form.hearing_loss || ""} onChange={(v) => updateField("hearing_loss", v)} />
              <Field label="Resultado do teste" value={form.test_result || ""} onChange={(v) => updateField("test_result", v)} />
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(form.patient_approved)} onChange={(event) => updateField("patient_approved", event.target.checked)} />
                Paciente aprovou o teste
              </label>
            </div>

            <div className={formStepClass("pedido")}>
              <div className="form-section-title section-with-action">
                <div>
                  <span>3. Pedido do aparelho</span>
                  <p>Quando o paciente aprovar, complete aparelho, acessórios, pagamento e envio à fábrica.</p>
                </div>
                <button type="button" onClick={exportCurrentPatientOrder}>Gerar pedido</button>
              </div>
            <Field label="Data do pedido à fábrica" type="date" value={form.order_date || ""} onChange={(v) => updateField("order_date", v)} />
            <Field label="Nº pedido fábrica" value={form.factory_order_number || ""} onChange={(v) => updateField("factory_order_number", v)} />
            <label>
              Condição de pagamento
              <select value={form.selected_payment_term_id || ""} onChange={(event) => updatePaymentTerm(event.target.value)}>
                <option value="">Selecione</option>
                {catalog.paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {[term.terms, term.description, term.code].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Código pagamento" value={form.payment_code || ""} onChange={(v) => updateField("payment_code", v)} disabled />
            <label>
              Aparelho auditivo
              <select value={form.selected_device_product_id || ""} onChange={(event) => updateField("selected_device_product_id", event.target.value)}>
                <option value="">Selecione</option>
                {devices.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}
              </select>
            </label>
            <label>
              Lado
              <select value={form.device_side || "bilateral"} onChange={(event) => updateField("device_side", event.target.value)}>
                <option value="bilateral">Bilateral</option>
                <option value="direito">Direito</option>
                <option value="esquerdo">Esquerdo</option>
              </select>
            </label>
            <div className="wide accessory-builder">
              <div className="accessory-heading">
                <strong>Acessórios e itens adicionais</strong>
                <button type="button" className="secondary" onClick={addAccessoryItem}>Adicionar item</button>
              </div>
              {(form.accessory_items || []).length ? (
                <div className="accessory-list">
                  {(form.accessory_items || []).map((item, index) => {
                    const product = findProduct(item.product_id);
                    const subtotal = product ? Number(product.unit_value_cents || 0) * Number(item.quantity || 1) : 0;

                    return (
                      <div className="accessory-row" key={`${item.product_id || "novo"}-${index}`}>
                        <label>
                          Item
                          <select value={item.product_id || ""} onChange={(event) => updateAccessoryItem(index, "product_id", event.target.value)}>
                            <option value="">Selecione</option>
                            {accessories.map((productOption) => (
                              <option key={productOption.id} value={productOption.id}>
                                {productOption.category} | {productLabel(productOption)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Quantidade
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={item.quantity ?? 1}
                            onChange={(event) => updateAccessoryItem(index, "quantity", event.target.value)}
                            onBlur={() => normalizeAccessoryQuantity(index)}
                          />
                        </label>
                        <span className="accessory-subtotal">{moneyLabel(subtotal)}</span>
                        <button type="button" className="secondary" onClick={() => removeAccessoryItem(index)}>Remover</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-accessory">Nenhum acessório adicionado.</p>
              )}
            </div>
            <Field label="Marca" value={form.device_brand || ""} onChange={(v) => updateField("device_brand", v)} disabled />
            <Field label="Modelo" value={form.device_model || ""} onChange={(v) => updateField("device_model", v)} disabled />
            <Field label="Código direito" value={form.right_device_code || ""} onChange={(v) => updateField("right_device_code", v)} disabled />
            <Field label="Código esquerdo" value={form.left_device_code || ""} onChange={(v) => updateField("left_device_code", v)} disabled />
            <Field label="Acessórios / códigos" value={form.accessory_codes || ""} onChange={(v) => updateField("accessory_codes", v)} disabled />
            <Field label="Valor fábrica" value={form.factory_value_cents_display ?? centsToCurrency(form.factory_value_cents)} onChange={(v) => updateField("factory_value_cents_display", v)} disabled />
            <Field label="Valor paciente" value={form.patient_value_cents_display ?? centsToCurrency(form.patient_value_cents)} onChange={(v) => updateField("patient_value_cents_display", v)} />
            </div>

            <div className={formStepClass("entrega")}>
              <div className="form-section-title">
                <span>4. Chegada, entrega e adaptação</span>
                <p>Após a chegada do aparelho, marque o retorno para entrega e adaptação.</p>
              </div>
              <Field label="Chegada do aparelho" type="date" value={form.arrival_date || ""} onChange={(v) => updateField("arrival_date", v)} />
              <Field label="Retorno/adaptação" type="datetime-local" value={form.adaptation_date || ""} onChange={(v) => updateField("adaptation_date", v)} />
              <label className="wide">
                Observações
                <textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} />
              </label>
              <label className="wide">
                Conferência de documentos
                <textarea value={form.documentation_notes || ""} onChange={(event) => updateField("documentation_notes", event.target.value)} />
              </label>
            </div>

            <div className={formStepClass("documentos")}>
              <div className="form-section-title">
                <span>5. Documentos do paciente</span>
                <p>Pedido médico, exame de audiometria e comprovantes ficam registrados no histórico.</p>
              </div>
              <div className="wide document-panel">
                {editingId ? (
                  <>
                    <div className="document-upload">
                      <label>
                        Tipo de documento
                        <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                          {documentTypeOptions.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Arquivo
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                        />
                        <small>PDF, JPG, PNG ou WEBP até 4 MB.</small>
                      </label>
                      <button type="button" onClick={uploadPatientFile}>Anexar documento</button>
                    </div>
                    <div className="document-list">
                      {filesLoading ? <p className="empty-accessory">Carregando documentos...</p> : null}
                      {!filesLoading && !patientFiles.length ? <p className="empty-accessory">Nenhum documento anexado.</p> : null}
                      {patientFiles.map((file) => (
                        <div className="document-item" key={file.id}>
                          <div>
                            <strong>{documentTypeLabel(file.document_type)}</strong>
                            <span>{file.file_name} · {fileSizeLabel(file.file_size)} · {new Date(file.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="row-actions">
                            <a className="button-link" href={`/api/patients/${editingId}/files/${file.id}`} target="_blank" rel="noreferrer">Abrir</a>
                            <button type="button" className="secondary" onClick={() => deletePatientFile(file.id)}>Excluir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-accessory">Salve o cadastro do paciente antes de anexar documentos.</p>
                )}
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={(event) => savePatient(event, "order")}>
                {editingId ? "Salvar pedido do aparelho" : "Cadastrar pedido"}
              </button>
              {message ? <span>{message}</span> : null}
            </div>
          </form>
        </section>

        <section className="panel" id="lista">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Controle</p>
              <h2>Pedidos cadastrados</h2>
            </div>
            <div className="filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, CPF, telefone, cidade, modelo ou pedido" />
              <button className="secondary" onClick={loadPatients}>{loading ? "Buscando..." : "Buscar"}</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Status</th>
                  <th>Cidade - UF</th>
                  <th>Teste</th>
                  <th>Modelo</th>
                  <th>Pedido</th>
                  <th>Docs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={() => edit(row, "schedule")}
                    onKeyDown={(event) => openOnEnter(event, () => edit(row, "schedule"))}
                  >
                    <td>
                      <strong>{row.patient_name}</strong>
                      <small>{row.phone ? formatPhone(row.phone) : "Sem telefone"}</small>
                    </td>
                    <td><span className="pill">{statusLabel(row.status)}</span></td>
                    <td>{[row.city, row.state].filter(Boolean).join(" - ") || "-"}</td>
                    <td>{patientDateTimeLabel(row.test_date)}</td>
                    <td>{row.device_model || "-"}</td>
                    <td>{row.factory_order_number || "-"}</td>
                    <td><span className="pill">{row.document_count || 0}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="secondary" onClick={(event) => { event.stopPropagation(); edit(row, "schedule"); }}>Editar cadastro</button>
                        <button className="secondary" onClick={(event) => { event.stopPropagation(); startOrder(row); }}>Fazer pedido</button>
                        <button className="secondary" onClick={(event) => { event.stopPropagation(); startDocuments(row); }}>Documentos</button>
                        <button className="secondary" onClick={(event) => { event.stopPropagation(); exportPatientExcel(row); }}>Gerar pedido</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required = false, disabled = false, inputMode, maxLength, placeholder }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value || ""}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}
