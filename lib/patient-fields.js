export const patientColumns = [
  "id",
  "created_at",
  "updated_at",
  "status",
  "patient_name",
  "cpf",
  "sus_card",
  "birth_date",
  "phone",
  "email",
  "city",
  "state",
  "medical_request_date",
  "audiometry_date",
  "hearing_loss",
  "documentation_notes",
  "test_date",
  "audiologist_name",
  "test_result",
  "patient_approved",
  "order_date",
  "factory_order_number",
  "selected_payment_term_id",
  "payment_terms",
  "payment_description",
  "payment_code",
  "selected_device_product_id",
  "selected_accessory_product_ids",
  "accessory_items",
  "device_side",
  "device_brand",
  "device_model",
  "right_device_code",
  "left_device_code",
  "accessory_codes",
  "factory_value_cents",
  "patient_value_cents",
  "arrival_date",
  "adaptation_date",
  "notes"
];

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

export function normalizeCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

export function isValidBrazilMobilePhone(value) {
  const digits = normalizePhone(value);
  return Boolean(digits && /^\d{11}$/.test(digits));
}

export function isValidCpf(value) {
  const digits = normalizeCpf(value);
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

  const firstDigit = calculateDigit(digits.slice(0, 9));
  const secondDigit = calculateDigit(digits.slice(0, 10));
  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
}

export function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function normalizePatient(input) {
  const get = (key) => {
    const value = input[key];
    return value === "" || value === undefined ? null : value;
  };

  const getNumber = (key) => {
    const value = get(key);
    return value === null ? null : Number(value);
  };

  const getNumberArray = (key) => {
    const value = input[key];
    if (!Array.isArray(value)) return [];
    return value.map(Number).filter((item) => Number.isFinite(item));
  };

  const accessoryItems = Array.isArray(input.accessory_items)
    ? input.accessory_items
        .map((item) => ({
          product_id: Number(item.product_id),
          quantity: Math.max(1, Number(item.quantity || 1))
        }))
        .filter((item) => Number.isFinite(item.product_id))
    : [];

  const selectedAccessoryProductIds = accessoryItems.length
    ? [...new Set(accessoryItems.map((item) => item.product_id))]
    : getNumberArray("selected_accessory_product_ids");

  return {
    status: get("status") || "documentacao_recebida",
    patient_name: get("patient_name"),
    cpf: normalizeCpf(get("cpf")),
    sus_card: get("sus_card"),
    birth_date: get("birth_date"),
    phone: normalizePhone(get("phone")),
    email: get("email") ? String(get("email")).trim().toLowerCase() : null,
    city: get("city"),
    state: get("state"),
    medical_request_date: get("medical_request_date"),
    audiometry_date: get("audiometry_date"),
    hearing_loss: get("hearing_loss"),
    documentation_notes: get("documentation_notes"),
    test_date: get("test_date"),
    audiologist_name: get("audiologist_name"),
    test_result: get("test_result"),
    patient_approved: Boolean(input.patient_approved),
    order_date: get("order_date"),
    factory_order_number: get("factory_order_number"),
    selected_payment_term_id: getNumber("selected_payment_term_id"),
    payment_terms: get("payment_terms"),
    payment_description: get("payment_description"),
    payment_code: get("payment_code"),
    selected_device_product_id: getNumber("selected_device_product_id"),
    selected_accessory_product_ids: selectedAccessoryProductIds,
    accessory_items: accessoryItems,
    device_side: get("device_side") || "bilateral",
    device_brand: get("device_brand"),
    device_model: get("device_model"),
    right_device_code: get("right_device_code"),
    left_device_code: get("left_device_code"),
    accessory_codes: get("accessory_codes"),
    factory_value_cents: Number(input.factory_value_cents || 0),
    patient_value_cents: Number(input.patient_value_cents || 0),
    arrival_date: get("arrival_date"),
    adaptation_date: get("adaptation_date"),
    notes: get("notes")
  };
}
