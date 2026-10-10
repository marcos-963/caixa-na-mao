/*! Caixa na Mão © 2026 Marcus Deleon™ – Tecnologia de Ponta. Todos os direitos reservados.
 *  Proibida a cópia, modificação ou distribuição sem autorização. Veja LICENSE. */

/*
 * Caixa na Mão — cálculos do dia.
 *
 * Todos os valores são em CENTAVOS (inteiros), lidos com lerCentavos() de dinheiro.js.
 *
 * O dinheiro fica em dois lugares:
 *   - GAVETA: dinheiro em espécie, que dá para contar na mão.
 *   - BANCO:  Pix, cartão de débito e de crédito (inclui o que ainda vai cair).
 * A conferência ("o caixa bateu?") compara só a GAVETA com o que foi contado.
 */

/** Onde cada tipo de entrada vai parar. "outras" depende do que a pessoa escolher. */
const DESTINO_ENTRADA = {
  dinheiro: "gaveta",
  pix: "banco",
  debito: "banco",
  credito: "banco",
};

const TIPOS_ENTRADA = ["dinheiro", "pix", "debito", "credito", "outras"];
const TIPOS_SAIDA = ["materiais", "embalagens", "fretes", "pessoais", "taxas", "outras"];

/**
 * Calcula o resultado de um dia.
 *
 * @param {object} dia
 * @param {{gaveta:number, banco:number}} dia.anterior  Saldo que ficou do dia anterior.
 * @param {object} dia.entradas  { dinheiro, pix, debito, credito, outras } em centavos.
 * @param {"gaveta"|"banco"} [dia.outrasEntradasEm="gaveta"]  Onde entraram as "outras entradas".
 * @param {object} dia.saidas    { materiais, ..., outras }: cada uma { valor, pagoCom: "gaveta"|"banco" }.
 * @param {number|null} [dia.contado]  Dinheiro contado na gaveta (null = ainda não contou).
 */
function calcularDia(dia) {
  const anterior = { gaveta: 0, banco: 0, ...(dia.anterior || {}) };
  const entradas = dia.entradas || {};
  const saidas = dia.saidas || {};

  // ---- Entradas ----
  const entrou = { gaveta: 0, banco: 0 };
  for (const tipo of TIPOS_ENTRADA) {
    const valor = entradas[tipo] || 0;
    const destino = tipo === "outras" ? (dia.outrasEntradasEm || "gaveta") : DESTINO_ENTRADA[tipo];
    entrou[destino] += valor;
  }

  // ---- Saídas ----
  const saiu = { gaveta: 0, banco: 0 };
  for (const tipo of TIPOS_SAIDA) {
    const saida = saidas[tipo] || {};
    saiu[saida.pagoCom === "banco" ? "banco" : "gaveta"] += saida.valor || 0;
  }

  const totalEntradas = entrou.gaveta + entrou.banco;
  const totalSaidas = saiu.gaveta + saiu.banco;

  // ---- Saldos ----
  const gavetaEsperada = anterior.gaveta + entrou.gaveta - saiu.gaveta;
  const bancoEsperado = anterior.banco + entrou.banco - saiu.banco;

  // ---- Conferência da gaveta ----
  const contado = Number.isInteger(dia.contado) ? dia.contado : null;
  const diferenca = contado === null ? null : contado - gavetaEsperada;
  let conferencia = "nao-conferido";
  if (diferenca !== null) conferencia = diferenca === 0 ? "bateu" : diferenca > 0 ? "sobrou" : "faltou";

  // O que vale para amanhã: se contou a gaveta, vale o que foi contado.
  const gavetaFinal = contado === null ? gavetaEsperada : contado;

  return {
    totalEntradas,
    totalSaidas,
    entrouNaGaveta: entrou.gaveta,
    entrouNoBanco: entrou.banco,
    saiuDaGaveta: saiu.gaveta,
    saiuDoBanco: saiu.banco,
    resultadoDia: totalEntradas - totalSaidas,      // lucro (ou prejuízo) só de hoje
    gavetaEsperada,                                  // quanto deveria ter na gaveta
    bancoEsperado,                                   // quanto deveria ter no banco / a receber
    contado,
    diferenca,                                       // contado − esperado (+ sobrou, − faltou)
    conferencia,                                     // "bateu" | "sobrou" | "faltou" | "nao-conferido"
    saldoFinal: { gaveta: gavetaFinal, banco: bancoEsperado },
    saldoAcumulado: gavetaFinal + bancoEsperado,     // tudo o que a pessoa tem
  };
}

/**
 * Meta por dia: divide a meta da temporada pelos dias de trabalho.
 * Arredonda para cima, para que somar as metas diárias alcance a meta total.
 * Devolve null se não der para calcular.
 */
function calcularMetaDiaria(metaTemporada, diasDeTrabalho) {
  if (!Number.isInteger(metaTemporada) || metaTemporada <= 0) return null;
  if (!Number.isInteger(diasDeTrabalho) || diasDeTrabalho <= 0) return null;
  return Math.ceil(metaTemporada / diasDeTrabalho);
}

/**
 * Quantos dias de trabalho há entre duas datas "AAAA-MM-DD" (inclusive),
 * pulando os dias da semana de folga (0 = domingo ... 6 = sábado).
 */
function contarDiasDeTrabalho(inicio, fim, folgas = []) {
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  const data = new Date(ai, mi - 1, di);
  const ultimo = new Date(af, mf - 1, df);
  let dias = 0;
  while (data <= ultimo) {
    if (!folgas.includes(data.getDay())) dias++;
    data.setDate(data.getDate() + 1);
  }
  return dias;
}
