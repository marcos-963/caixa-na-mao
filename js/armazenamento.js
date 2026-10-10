/*
 * Caixa na Mão — salvar os dias, passar o saldo de um dia para o outro e backup.
 *
 * Os dados ficam no navegador (localStorage), num único objeto:
 *
 *   {
 *     versao: 1,
 *     temporada: {
 *       meta: 900000,                         // centavos
 *       inicio: "2026-12-01", fim: "2027-02-28",
 *       folgas: [1],                          // dias da semana sem trabalho (0 = domingo)
 *       saldoInicial: { gaveta: 0, banco: 0 } // com quanto a temporada começou
 *     },
 *     dias: {
 *       "2026-12-01": {
 *         entradas: { dinheiro, pix, debito, credito, outras },       // centavos
 *         outrasEntradasEm: "gaveta" | "banco",
 *         saidas: { materiais: { valor, pagoCom: "gaveta" | "banco" }, ... },
 *         descricoes: { "entrada.dinheiro": "texto", "saida.materiais": "texto", ... },
 *         contado: 42000 | null,              // dinheiro contado na gaveta
 *         anteriorManual: { gaveta, banco } | null, // saldo anterior digitado à mão
 *         anotacoes: "texto"
 *       }
 *     }
 *   }
 *
 * O saldo anterior NÃO é guardado: é sempre recalculado a partir dos dias
 * anteriores. Assim, corrigir um dia antigo corrige todos os seguintes.
 */

const CHAVE_ARMAZENAMENTO = "caixa-na-mao-v1";
const VERSAO_DADOS = 1;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dadosVazios() {
  return {
    versao: VERSAO_DADOS,
    temporada: { meta: null, inicio: "", fim: "", folgas: [], saldoInicial: { gaveta: 0, banco: 0 } },
    dias: {},
  };
}

function diaVazio() {
  return {
    entradas: {},
    outrasEntradasEm: "gaveta",
    saidas: {},
    descricoes: {},
    contado: null,
    anteriorManual: null,
    anotacoes: "",
  };
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

/** Lê os dados salvos. Se não houver nada (ou estiver corrompido), começa do zero. */
function carregarDados() {
  try {
    const texto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return texto ? validarDados(JSON.parse(texto)) : dadosVazios();
  } catch {
    return dadosVazios();
  }
}

/** Salva os dados. Devolve false se o navegador não deixou (aba anônima, sem espaço...). */
function salvarDados(dados) {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(dados));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dias
// ---------------------------------------------------------------------------

function lerDia(dados, data) {
  return { ...diaVazio(), ...(dados.dias[data] || {}) };
}

function gravarDia(dados, data, dia) {
  if (!FORMATO_DATA.test(data)) throw new Error("Data inválida: " + data);
  dados.dias[data] = { ...diaVazio(), ...dia };
  return dados;
}

function apagarDia(dados, data) {
  delete dados.dias[data];
  return dados;
}

/** Datas salvas, em ordem. */
function datasSalvas(dados) {
  return Object.keys(dados.dias).filter((d) => FORMATO_DATA.test(d)).sort();
}

/** Transforma um dia salvo no formato que calcularDia() espera. */
function paraCalculo(dia, anterior) {
  const saidas = {};
  for (const [tipo, s] of Object.entries(dia.saidas || {})) {
    saidas[tipo] = { valor: s.valor || 0, pagoCom: s.pagoCom === "banco" ? "banco" : "gaveta" };
  }
  return {
    anterior,
    entradas: dia.entradas || {},
    outrasEntradasEm: dia.outrasEntradasEm,
    saidas,
    contado: dia.contado,
  };
}

/**
 * Calcula todos os dias em ordem, levando o saldo final de um dia
 * para o saldo anterior do próximo.
 * Devolve { "AAAA-MM-DD": { anterior, origemAnterior, resultado } }.
 */
function calcularTemporada(dados) {
  const saldoInicial = { gaveta: 0, banco: 0, ...(dados.temporada.saldoInicial || {}) };
  const porData = {};
  let saldo = saldoInicial;
  let origem = "inicio-temporada";

  for (const data of datasSalvas(dados)) {
    const dia = lerDia(dados, data);
    const anterior = dia.anteriorManual ? { gaveta: 0, banco: 0, ...dia.anteriorManual } : saldo;
    const resultado = calcularDia(paraCalculo(dia, anterior));
    porData[data] = { anterior, origemAnterior: dia.anteriorManual ? "manual" : origem, resultado };
    saldo = resultado.saldoFinal;
    origem = data;
  }
  return porData;
}

/**
 * Saldo anterior de uma data (salva ou não): o saldo final do último dia salvo antes dela.
 * Devolve { anterior: { gaveta, banco }, origem } onde origem é a data de onde veio,
 * "inicio-temporada" ou "manual".
 */
function saldoAnteriorDe(dados, data) {
  const dia = dados.dias[data];
  if (dia && dia.anteriorManual) {
    return { anterior: { gaveta: 0, banco: 0, ...dia.anteriorManual }, origem: "manual" };
  }
  const temporada = calcularTemporada(dados);
  const antes = datasSalvas(dados).filter((d) => d < data);
  if (!antes.length) {
    return { anterior: { gaveta: 0, banco: 0, ...(dados.temporada.saldoInicial || {}) }, origem: "inicio-temporada" };
  }
  const ultima = antes[antes.length - 1];
  return { anterior: temporada[ultima].resultado.saldoFinal, origem: ultima };
}

/** Calcula uma data com o saldo anterior certo. */
function calcularData(dados, data) {
  const { anterior, origem } = saldoAnteriorDe(dados, data);
  return { anterior, origemAnterior: origem, resultado: calcularDia(paraCalculo(lerDia(dados, data), anterior)) };
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Texto do arquivo de backup. */
function gerarBackup(dados) {
  return JSON.stringify({ app: "caixa-na-mao", geradoEm: new Date().toISOString(), ...dados }, null, 2);
}

/** Nome do arquivo de backup, ex.: "caixa-na-mao-backup-2026-12-01.json". */
function nomeDoBackup(hoje = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `caixa-na-mao-backup-${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}.json`;
}

/** Baixa o backup como arquivo .json. */
function baixarBackup(dados) {
  const blob = new Blob([gerarBackup(dados)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeDoBackup();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Lê o texto de um backup. Lança um Error com mensagem em português se não for válido. */
function lerBackup(texto) {
  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("Este arquivo não é um backup do Caixa na Mão (não é JSON).");
  }
  if (!bruto || bruto.app !== "caixa-na-mao") {
    throw new Error("Este arquivo não é um backup do Caixa na Mão.");
  }
  if (bruto.versao > VERSAO_DADOS) {
    throw new Error("Este backup foi feito numa versão mais nova do Caixa na Mão.");
  }
  return validarDados(bruto);
}

// ---------------------------------------------------------------------------
// Validação: só aceita o que o app sabe usar; o resto é descartado.
// ---------------------------------------------------------------------------

const _valCentavos = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
const _valCentavosOuNull = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const _valTexto = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const _valLugar = (v) => (v === "banco" ? "banco" : "gaveta");
const _valSaldo = (v) => ({ gaveta: _valCentavos(v && v.gaveta), banco: _valCentavos(v && v.banco) });

function validarDados(bruto) {
  const dados = dadosVazios();
  if (!bruto || typeof bruto !== "object") return dados;

  const t = bruto.temporada || {};
  dados.temporada = {
    meta: _valCentavosOuNull(t.meta),
    inicio: FORMATO_DATA.test(t.inicio) ? t.inicio : "",
    fim: FORMATO_DATA.test(t.fim) ? t.fim : "",
    folgas: Array.isArray(t.folgas) ? [...new Set(t.folgas.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
    saldoInicial: _valSaldo(t.saldoInicial),
  };

  for (const [data, d] of Object.entries(bruto.dias || {})) {
    if (!FORMATO_DATA.test(data) || !d || typeof d !== "object") continue;
    const dia = diaVazio();
    for (const tipo of TIPOS_ENTRADA) {
      if (d.entradas && d.entradas[tipo] != null) dia.entradas[tipo] = _valCentavos(d.entradas[tipo]);
    }
    dia.outrasEntradasEm = _valLugar(d.outrasEntradasEm);
    for (const tipo of TIPOS_SAIDA) {
      const s = d.saidas && d.saidas[tipo];
      if (s) dia.saidas[tipo] = { valor: _valCentavos(s.valor), pagoCom: _valLugar(s.pagoCom) };
    }
    for (const [campo, valor] of Object.entries(d.descricoes || {})) {
      if (/^(entrada|saida)\.[a-z]+$/.test(campo)) dia.descricoes[campo] = _valTexto(valor, 200);
    }
    dia.contado = _valCentavosOuNull(d.contado);
    dia.anteriorManual = d.anteriorManual ? _valSaldo(d.anteriorManual) : null;
    dia.anotacoes = _valTexto(d.anotacoes);
    dados.dias[data] = dia;
  }
  return dados;
}
