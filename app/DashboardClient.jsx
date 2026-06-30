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
  selected_payment_term_id: "",
  payment_terms: "",
  payment_description: "",
  payment_code: "",
  selected_device_product_id: "",
  selected_accessory_product_ids: [],
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

export default function DashboardClient({ initialAuthenticated }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [catalog, setCatalog] = useState({ products: [], paymentTerms: [] });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const totalOpen = useMemo(() => rows.filter((row) => row.status !== "concluido").length, [rows]);
  const products = catalog.products || [];
  const devices = useMemo(() => products.filter((item) => item.item_kind === "device"), [products]);
  const accessories = useMemo(() => products.filter((item) => item.item_kind !== "device"), [products]);

  useEffect(() => {
    if (authenticated) {
      loadPatients();
      loadCatalog();
    }
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

  async function loadCatalog() {
    const response = await fetch("/api/catalog");
    if (!response.ok) return;
    const data = await response.json();
    setCatalog({
      products: data.products || [],
      paymentTerms: data.paymentTerms || []
    });
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

  function calculateFactoryValueCents(nextForm) {
    const selectedDevice = findProduct(nextForm.selected_device_product_id);
    const selectedAccessories = (nextForm.selected_accessory_product_ids || [])
      .map(findProduct)
      .filter(Boolean);
    const deviceQuantity = selectedDevice ? (nextForm.device_side === "bilateral" ? 2 : 1) : 0;
    const deviceTotal = selectedDevice ? Number(selectedDevice.unit_value_cents || 0) * deviceQuantity : 0;
    const accessoriesTotal = selectedAccessories.reduce((sum, item) => sum + Number(item.unit_value_cents || 0), 0);
    return deviceTotal + accessoriesTotal;
  }

  function hydrateCatalogFields(nextForm) {
    const selectedDevice = findProduct(nextForm.selected_device_product_id);
    const selectedAccessories = (nextForm.selected_accessory_product_ids || [])
      .map(findProduct)
      .filter(Boolean);
    const side = nextForm.device_side || "bilateral";
    const deviceCode = selectedDevice?.code || "";

    return {
      ...nextForm,
      device_brand: selectedDevice ? "Sonic" : nextForm.device_brand,
      device_model: selectedDevice?.description || nextForm.device_model,
      right_device_code: side === "esquerdo" ? "" : deviceCode,
      left_device_code: side === "direito" ? "" : deviceCode,
      accessory_codes: selectedAccessories.map((item) => `${item.code || "sem código"} - ${item.description}`).join("; "),
      factory_value_cents: calculateFactoryValueCents(nextForm),
      factory_value_cents_display: undefined
    };
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (["selected_device_product_id", "selected_accessory_product_ids", "device_side"].includes(key)) {
        return hydrateCatalogFields(next);
      }
      return next;
    });
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
      selected_payment_term_id: row.selected_payment_term_id || "",
      selected_device_product_id: row.selected_device_product_id || "",
      selected_accessory_product_ids: row.selected_accessory_product_ids || [],
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
      selected_payment_term_id: form.selected_payment_term_id || null,
      selected_device_product_id: form.selected_device_product_id || null,
      selected_accessory_product_ids: form.selected_accessory_product_ids || [],
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
            <label className="wide">
              Acessórios e itens adicionais
              <select
                multiple
                value={(form.selected_accessory_product_ids || []).map(String)}
                onChange={(event) => updateField(
                  "selected_accessory_product_ids",
                  Array.from(event.target.selectedOptions).map((option) => option.value)
                )}
              >
                {accessories.map((product) => <option key={product.id} value={product.id}>{product.category} | {productLabel(product)}</option>)}
              </select>
            </label>
            <Field label="Marca" value={form.device_brand || ""} onChange={(v) => updateField("device_brand", v)} disabled />
            <Field label="Modelo" value={form.device_model || ""} onChange={(v) => updateField("device_model", v)} disabled />
            <Field label="Código direito" value={form.right_device_code || ""} onChange={(v) => updateField("right_device_code", v)} disabled />
            <Field label="Código esquerdo" value={form.left_device_code || ""} onChange={(v) => updateField("left_device_code", v)} disabled />
            <Field label="Acessórios / códigos" value={form.accessory_codes || ""} onChange={(v) => updateField("accessory_codes", v)} disabled />
            <Field label="Valor fábrica" value={form.factory_value_cents_display ?? centsToCurrency(form.factory_value_cents)} onChange={(v) => updateField("factory_value_cents_display", v)} disabled />
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

function Field({ label, value, onChange, type = "text", required = false, disabled = false }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value || ""}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
