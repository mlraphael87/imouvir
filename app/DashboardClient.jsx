"use client";

import { useEffect, useMemo, useState } from "react";
import { STATUSES, statusLabel } from "@/lib/status";

const emptyForm = {
  status: "documentacao_recebida",
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

export default function DashboardClient({ initialAuthenticated }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const totalOpen = useMemo(() => rows.filter((row) => row.status !== "concluido").length, [rows]);

  useEffect(() => {
    if (authenticated) loadPatients();
  }, [authenticated, statusFilter]);

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
    if (query) params.set("q", query);
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

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      ...emptyForm,
      ...row,
      birth_date: row.birth_date || "",
      medical_request_date: row.medical_request_date || "",
      audiometry_date: row.audiometry_date || "",
      test_date: row.test_date ? row.test_date.slice(0, 16) : "",
      order_date: row.order_date || "",
      arrival_date: row.arrival_date || "",
      adaptation_date: row.adaptation_date ? row.adaptation_date.slice(0, 16) : ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function savePatient(event) {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      factory_value_cents: currencyToCents(form.factory_value_cents_display ?? centsToCurrency(form.factory_value_cents)),
      patient_value_cents: currencyToCents(form.patient_value_cents_display ?? centsToCurrency(form.patient_value_cents))
    };
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
    setMessage(editingId ? "Pedido atualizado." : "Pedido cadastrado.");
    resetForm();
    loadPatients();
  }

  function exportExcel() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    window.location.href = `/api/export?${params.toString()}`;
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
          <button onClick={exportExcel}>Gerar Excel</button>
        </header>

        <section className="metrics">
          <article>
            <span>Total filtrado</span>
            <strong>{rows.length}</strong>
          </article>
          <article>
            <span>Em andamento</span>
            <strong>{totalOpen}</strong>
          </article>
          <article>
            <span>Concluídos</span>
            <strong>{totals.concluido || 0}</strong>
          </article>
        </section>

        <section className="pipeline">
          {STATUSES.map((status) => (
            <button
              key={status.key}
              className={statusFilter === status.key ? "status-card active" : "status-card"}
              onClick={() => setStatusFilter(statusFilter === status.key ? "" : status.key)}
            >
              <span>{status.label}</span>
              <strong>{totals[status.key] || 0}</strong>
            </button>
          ))}
        </section>

        <section className="panel" id="novo-pedido">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? "Editar pedido" : "Cadastro"}</p>
              <h2>{editingId ? `Pedido #${editingId}` : "Novo pedido de aparelho"}</h2>
            </div>
            {editingId ? <button className="secondary" onClick={resetForm}>Cancelar edição</button> : null}
          </div>

          <form className="patient-form" onSubmit={savePatient}>
            <Field label="Nome do paciente" required value={form.patient_name} onChange={(v) => updateField("patient_name", v)} />
            <Field label="CPF" value={form.cpf || ""} onChange={(v) => updateField("cpf", v)} />
            <Field label="Cartão SUS" value={form.sus_card || ""} onChange={(v) => updateField("sus_card", v)} />
            <Field label="Nascimento" type="date" value={form.birth_date || ""} onChange={(v) => updateField("birth_date", v)} />
            <Field label="Telefone" value={form.phone || ""} onChange={(v) => updateField("phone", v)} />
            <Field label="E-mail" value={form.email || ""} onChange={(v) => updateField("email", v)} />
            <Field label="Cidade" value={form.city || ""} onChange={(v) => updateField("city", v)} />
            <Field label="UF" value={form.state || ""} onChange={(v) => updateField("state", v)} />

            <label>
              Status
              <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                {STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
              </select>
            </label>
            <Field label="Data do pedido médico" type="date" value={form.medical_request_date || ""} onChange={(v) => updateField("medical_request_date", v)} />
            <Field label="Data da audiometria" type="date" value={form.audiometry_date || ""} onChange={(v) => updateField("audiometry_date", v)} />
            <Field label="Perda auditiva" value={form.hearing_loss || ""} onChange={(v) => updateField("hearing_loss", v)} />
            <Field label="Teste com aparelho" type="datetime-local" value={form.test_date || ""} onChange={(v) => updateField("test_date", v)} />
            <Field label="Fonoaudiólogo" value={form.audiologist_name || ""} onChange={(v) => updateField("audiologist_name", v)} />
            <Field label="Resultado do teste" value={form.test_result || ""} onChange={(v) => updateField("test_result", v)} />
            <label className="checkbox">
              <input type="checkbox" checked={Boolean(form.patient_approved)} onChange={(event) => updateField("patient_approved", event.target.checked)} />
              Paciente aprovou o teste
            </label>

            <Field label="Data do pedido à fábrica" type="date" value={form.order_date || ""} onChange={(v) => updateField("order_date", v)} />
            <Field label="Nº pedido fábrica" value={form.factory_order_number || ""} onChange={(v) => updateField("factory_order_number", v)} />
            <Field label="Marca" value={form.device_brand || ""} onChange={(v) => updateField("device_brand", v)} />
            <Field label="Modelo" value={form.device_model || ""} onChange={(v) => updateField("device_model", v)} />
            <Field label="Código direito" value={form.right_device_code || ""} onChange={(v) => updateField("right_device_code", v)} />
            <Field label="Código esquerdo" value={form.left_device_code || ""} onChange={(v) => updateField("left_device_code", v)} />
            <Field label="Acessórios / códigos" value={form.accessory_codes || ""} onChange={(v) => updateField("accessory_codes", v)} />
            <label>
              Lado
              <select value={form.device_side || "bilateral"} onChange={(event) => updateField("device_side", event.target.value)}>
                <option value="bilateral">Bilateral</option>
                <option value="direito">Direito</option>
                <option value="esquerdo">Esquerdo</option>
              </select>
            </label>
            <Field label="Valor fábrica" value={form.factory_value_cents_display ?? centsToCurrency(form.factory_value_cents)} onChange={(v) => updateField("factory_value_cents_display", v)} />
            <Field label="Valor paciente" value={form.patient_value_cents_display ?? centsToCurrency(form.patient_value_cents)} onChange={(v) => updateField("patient_value_cents_display", v)} />
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
            <div className="form-actions">
              <button type="submit">{editingId ? "Salvar alterações" : "Cadastrar pedido"}</button>
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, CPF ou telefone" />
              <button className="secondary" onClick={loadPatients}>{loading ? "Buscando..." : "Buscar"}</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Status</th>
                  <th>Cidade</th>
                  <th>Teste</th>
                  <th>Modelo</th>
                  <th>Pedido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.patient_name}</strong>
                      <small>{row.phone || "Sem telefone"}</small>
                    </td>
                    <td><span className="pill">{statusLabel(row.status)}</span></td>
                    <td>{[row.city, row.state].filter(Boolean).join(" / ") || "-"}</td>
                    <td>{row.test_date ? new Date(row.test_date).toLocaleString("pt-BR") : "-"}</td>
                    <td>{row.device_model || "-"}</td>
                    <td>{row.factory_order_number || "-"}</td>
                    <td><button className="secondary" onClick={() => edit(row)}>Editar</button></td>
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

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label>
      {label}
      <input type={type} value={value || ""} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
