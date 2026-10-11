/*! Caixa na Mão © 2026 Marcus Deleon™ – Tecnologia de Ponta. Todos os direitos reservados.
 *  Proibida a cópia, modificação ou distribuição sem autorização. Veja LICENSE. */

/*
 * Caixa na Mão — leitura e formatação de valores em reais.
 *
 * Os valores são guardados em CENTAVOS (números inteiros) para evitar
 * erros de ponto flutuante (ex.: 0,1 + 0,2 = 0,30000000000000004).
 */

/**
 * Lê um valor digitado e devolve os centavos (inteiro).
 * Vazio devolve 0. Texto inválido devolve null.
 *
 * Aceita vírgula ou ponto para os centavos e ponto, vírgula ou espaço
 * para o milhar: "12,50", "12.50", "1.000,50", "1,000.50", "1 000", "R$ 10".
 * Recusa negativos, letras e separadores fora do lugar ("1,2,3", "12,345").
 */
function lerCentavos(texto) {
  let s = String(texto ?? "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (s === "") return 0;
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const sep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  let inteiro = s;
  let decimal = "";

  // O último separador é decimal quando tem 1 ou 2 dígitos depois dele (ou nenhum: "12,").
  if (sep !== -1 && s.length - sep - 1 <= 2) {
    inteiro = s.slice(0, sep);
    decimal = s.slice(sep + 1);
  }

  // Separador de milhar só vale em grupos de 3 dígitos: "1.000", "12.345.678".
  if (/[.,]/.test(inteiro) && !/^\d{1,3}([.,]\d{3})+$/.test(inteiro)) return null;
  // Uma única vírgula seguida de 3 dígitos é ambígua ("12,345" é 12,34 com erro
  // de digitação ou doze mil?): recusa para a pessoa conferir.
  if (/^\d+,\d{3}$/.test(s)) return null;

  const reais = Number(inteiro.replace(/[.,]/g, "") || "0");
  const centavos = Number(decimal.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(reais)) return null;
  return reais * 100 + centavos;
}

/** Até 999.999.999,99: mais que isso o campo para de aceitar dígitos. */
const MAX_DIGITOS = 11;

/**
 * Vírgula flutuante (como na maquininha): usa só os dígitos digitados,
 * e os dois últimos são sempre os centavos.
 *   "1" → 0,01   "17" → 0,17   "171150" → 1.711,50
 * Ponto, vírgula e letras são ignorados. Sem dígitos devolve { centavos: null, texto: "" }.
 */
function mascararCentavos(texto) {
  const digitos = String(texto ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITOS);
  if (digitos === "") return { centavos: null, texto: "" };
  const centavos = Number(digitos);
  return { centavos, texto: formatarCentavos(centavos) };
}

/** Máximo de parcelas numa soma ("50 + 30 + ..."). */
const MAX_PARCELAS = 50;

/**
 * Máscara com soma: cada parcela separada por "+" usa a vírgula flutuante.
 *   "5000 + 3000" → { centavos: 8000, texto: "50,00 + 30,00" }
 *   "50,00 +"     → { centavos: 5000, texto: "50,00 +" }   (esperando a próxima)
 * Sem "+" funciona igual a mascararCentavos(). Com apagando = true, uma última
 * parcela zerada some, para dar para apagar até tirar o "+".
 */
function mascararSoma(texto, apagando = false) {
  const partes = String(texto ?? "").split("+").slice(0, MAX_PARCELAS);
  if (partes.length === 1) return mascararCentavos(partes[0]);

  let ultima = mascararCentavos(partes[partes.length - 1]);
  if (apagando && ultima.centavos === 0) ultima = { centavos: null, texto: "" };
  const anteriores = partes.slice(0, -1).map((p) => mascararCentavos(p)).filter((p) => p.centavos !== null);
  if (!anteriores.length) return ultima;

  const centavos = anteriores.reduce((soma, p) => soma + p.centavos, 0) + (ultima.centavos || 0);
  const texto2 = anteriores.map((p) => p.texto).join(" + ") + " +" + (ultima.centavos !== null ? " " + ultima.texto : "");
  return { centavos, texto: texto2 };
}

/**
 * Lê um valor que pode ser uma soma ("50 + 30,50"). Parcela vazia conta 0.
 * Devolve null se alguma parcela for inválida.
 */
function lerSoma(texto) {
  const partes = String(texto ?? "").split("+");
  if (partes.length > MAX_PARCELAS) return null;
  let total = 0;
  for (const parte of partes) {
    const valor = lerCentavos(parte);
    if (valor === null) return null;
    total += valor;
  }
  return total;
}

/** Formata centavos como "1.234,56" (sem o "R$"). */
function formatarCentavos(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100).toLocaleString("pt-BR");
  const cents = String(abs % 100).padStart(2, "0");
  return (negativo ? "-" : "") + reais + "," + cents;
}
