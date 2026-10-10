# Caixa na Mão

Controle de caixa diário para quem vende na praia: anota entradas e saídas, confere a gaveta no fim do dia e acompanha a meta da temporada.

Funciona direto no navegador, sem instalar nada e sem internet.

## Como usar

1. Abra o `index.html` no navegador (dois cliques no arquivo).
2. Na primeira vez, abra **Temporada e meta** e informe a meta, as datas, os dias de folga e com quanto dinheiro você começou.
3. Todo dia, anote as entradas e as saídas. Em cada saída, marque se o dinheiro saiu da **gaveta** ou do **banco**.
4. No fim do dia, conte o dinheiro da gaveta e digite em **Quanto tem de verdade na gaveta?**.
5. De vez em quando, use **Exportar backup** e guarde o arquivo `.json` (no Drive, no WhatsApp, num pendrive).

Tudo é salvo automaticamente **neste navegador**. Para usar em outro aparelho, exporte o backup e importe no outro.

## Como funciona

- **Gaveta** é o dinheiro em espécie. **Banco** é Pix, cartão de débito e de crédito.
- A conferência compara só a gaveta: Pix e cartão não estão na gaveta, então não entram na conta.
- **Resultado do dia** = entradas − saídas de hoje.
- **Saldo total** = gaveta + banco.
- O saldo anterior vem sozinho do último dia preenchido. Se você contou a gaveta, vale o valor contado. Corrigir um dia antigo corrige os dias seguintes.
- **Meta por dia** = (meta da temporada − saldo inicial) ÷ dias de trabalho.
- **Vírgula flutuante**, como na maquininha: digite só os números e a vírgula se ajusta sozinha (`1` → `0,01`, `1250` → `12,50`, `171150` → `1.711,50`). Para R$ 800,00, digite `80000`. Ao colar um valor (`12,50`, `12.50`, `1.000`), o app entende o valor escrito.
- Os valores são guardados em centavos inteiros, sem erro de arredondamento.

## Estrutura

```
caixa-na-mao/
├── index.html            a tela
├── css/estilo.css        visual (azul petróleo) e impressão
├── js/dinheiro.js        ler e formatar valores
├── js/calculos.js        gaveta, banco, saldos, conferência e meta
├── js/armazenamento.js   salvar os dias, passar o saldo e backup
├── js/app.js             liga a tela aos cálculos
└── testes/testes.html    testes automáticos (abra no navegador)
```

## Testes

Abra `testes/testes.html` no navegador. A página mostra cada teste e se passou.
