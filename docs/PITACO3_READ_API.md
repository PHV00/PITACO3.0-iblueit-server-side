# PITACO 3.0 — API de leitura e compatibilidade

Branch: `feature/pitaco3-read-api`. Este documento descreve apenas as novas consultas e as restrições de leitura. **POST /plataforms e schemas de gravação não foram alterados.**

## Compatibilidade e diferenças intencionais

| Rota HTTP | Compatibilidade | Mudança |
| --- | --- | --- |
| GET /api/pacients/:pacientId/plataforms | Continua retornando `{ success, authorized, message, data: [], errors }` com todos os campos da partida | Isolamento por `_gameToken`; aceita `devices` e `gameDevice`; datas com objetos BSON Date |
| GET /api/flowdata/:flowDataDeviceId | Mantém `data` como **array** de documentos completos, inclusive flowData | Isolamento por `_gameToken`; ID malformado retorna HTTP 400 |
| GET /api/plataforms | Mantém `data` como array e `plataformOverviewId` | Isolamento por `_gameToken`; resposta passa a indicar `success: true` |
| GET /api/pacients/:pacientId/plataforms/statistics | Mantém os nomes e tipos dos campos legados | Isolamento por token no overview e no lookup de sinais; aceita alias `gameDevice` |
| GET /api/plataforms/statistics | Mantém a estrutura histórica de comparação entre pacientes | Coorte agora limitada aos pacientes e dados do mesmo GameToken |
| GET /api/pacients/:pacientId/plataforms/physiology-summary | **Rota nova** | Retorna agregados BPM e SpO₂ DEMO de execuções PITACO 3.0, sem os arrays PPG/fluxo |

A restrição entre tokens é deliberada: antes alguns GET apenas verificavam a existência do token e permitiam ler registros pertencentes a outra conta. Gráficos de comparação continuam disponíveis para pacientes autorizados da mesma conta. Dados históricos sem `_gameToken` válido não são expostos automaticamente e precisam de eventual migração auditada.

## Filtros do histórico

- `devices=Pitaco%203.0` é o filtro recomendado; `gameDevice` continua aceito como alias. A busca encontra tanto `devices: ['Pitaco 3.0']` quanto o campo legado `gameDevice`.
- `phase` e `level` são convertidos em inteiros. Valores inválidos retornam HTTP 400.
- `dataIni` e `dataFim` são comparados com `created_at`; datas simples `YYYY-MM-DD` usam limites UTC de início e fim do dia. Timestamps ISO completos também são aceitos.
- `sort=asc`, `skip` e `limit` continuam aceitos. Sem `limit`, os GET históricos preservam o comportamento anterior (sem limitação padrão). A rota nova usa 20 por página e máximo de 100 por requisição.
- Não enviar token de acesso na URL; usar header HTTP `GameToken`.

## Novo endpoint fisiológico

```http
GET /api/pacients/{pacientId}/plataforms/physiology-summary?limit=20&skip=0&sort=asc
GameToken: <token da conta>
```

Retorno: envelope API existente e `data` como lista de execuções. Cada item contém `overviewId`, `clientRunId`, `flowDataDevicesId`, `pacientId`, `playStart`, `playFinish`, `created_at`, `stageId`, `phase`, `level`, `deviceName`, `schemaVersion`, `rawSamplesOmitted` e:

```json
{
  "metrics": {
    "bpm": {
      "totalCount": 4,
      "numericCount": 3,
      "acceptedCount": 2,
      "rejectedOrUnavailableCount": 2,
      "coverageRatio": 0.5,
      "mean": 85,
      "median": 85,
      "minimum": 80,
      "maximum": 90
    },
    "spo2Demo": {
      "totalCount": 4,
      "numericCount": 3,
      "acceptedCount": 1,
      "rejectedOrUnavailableCount": 3,
      "coverageRatio": 0.25,
      "mean": 96,
      "median": 96,
      "minimum": 96,
      "maximum": 96
    }
  }
}
```

Os números são **sintéticos para ilustrar o formato**. A média e a mediana incluem somente estimativas com valores numéricos, `contactConfirmed === true` e `g1Approved === true`. Para `spo2Demo`, também exige `isDemonstration === true`. Ausências e rejeições não são convertidas em zero. `coverageRatio` é proporção de estimativas tecnicamente aceitas, **não sensibilidade/precisão clínica**.

Na rota nova, somente BPM e SpO₂ são projetados na consulta Mongo. RED/IR e fluxo respiratório são recuperados pelo GET `/flowdata/:id` quando o usuário abre os detalhes de uma execução.

## Riscos residuais e validação

1. **Ainda é necessário um teste integrado em ambiente controlado.** Os testes locais simulam modelos e não comprovam agregações reais do Atlas, índices ou CORS.
2. Antes de implantar, verificar registros antigos sem `_gameToken`; não remover restrição de leitura para manter visualização histórica. Eventual migração requer comprovação de pertencimento.
3. Verificar filtros/coortes nas telas legadas: resultados de outras contas, antes acessíveis por falha de isolamento, não aparecem mais.
4. O POST legado não foi alterado por esta branch. A vinculação/autorização de `pacientId` nos endpoints de escrita permanece um tema separado de segurança.
5. A SpO₂ é demonstrativa, não calibrada clinicamente. O resumo é adequado para análises técnicas, não para limiares ou alertas clínicos.
6. Não fazer deploy diretamente em produção apenas para rodar testes.

### Testes automatizados sem acesso a banco

```bash
npm test
```

A suíte cobre contrato de escrita, POST com reenvio e regressões GET (dados históricos, tokens distintos, alias de dispositivo, qualidade e agregação DEMO). O workflow `PITACO3 read API checks (no deploy)` valida esta branch separadamente, sem publicar na Azure.

### Validação integrada sugerida

Consultar com token de teste as duas coleções vinculadas pela execução `clientRunId`, confirmar que `GET /flowdata/:id` retorna as quatro séries, que `GET /physiology-summary` retorna as contagens/médias corretas, que outro token não acessa esses dados e que as estatísticas respiratórias dos dispositivos anteriores continuam iguais. Usar somente dados autorizados e não divulgar tokens, nomes ou informações pessoais em logs.
