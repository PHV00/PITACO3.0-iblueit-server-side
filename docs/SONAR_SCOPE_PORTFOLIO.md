# SonarQube Cloud — recorte do portfólio PITACO 3.0 (backend)

**Baseline do Marco Funcional 04:** `a70fb1ba9f8b0338f0385a2e156967ad271746d8`.  
**Base atual:** `80f3978babeaf9758954b7c43e459e0d1ba8de9a`, que mantém o código funcional do marco e a retirada da credencial codificada do `query.js`.

## Objetivo

Avaliar somente as implementações e os contratos diretamente ligados à entrega de persistência e visualização PITACO 3.0. O backend do I Blue It possui módulos antigos que não foram desenvolvidos neste portfólio. **Eles continuam existindo e suas falhas não são consideradas corrigidas** por estarem fora deste recorte.

## Fontes incluídas no Sonar

| Arquivos / diretórios | Justificativa |
| --- | --- |
| `SendPlataformOverview/` | Persistência de etapa, BPM, SpO₂ DEMO, PPG RED/IR, fluxo e idempotência `clientRunId` |
| `GetPacientPlataformOverview/` | Histórico por paciente, filtros e escopo por GameToken |
| `GetFlowDataDevice/` | Recuperação das séries persistidas |
| `GetPlataformOverview/` | Consulta geral de etapas |
| `GetPacientPlataformStatistics/` e `GetPlataformStatistics/` | Estatísticas e comparativos, mantendo contrato existente |
| `GetPacientPlataformPhysiologySummary/` | Resumos técnicos de BPM e SpO₂ DEMO |
| `shared/Pitaco3Contract.js` | Validação do payload de séries, limites e dispositivos legados |
| `shared/Pitaco3Read.js` | Filtros, paginação, projeções e agregações de leitura |
| `shared/FlowDataDevice.js` e `shared/PlataformOverview.js` | Modelos de persistência e índice de idempotência |

**Arquivos de testes:** `tests/pitaco3.contract.test.js`, `tests/pitaco3.endpoint.test.js`, `tests/pitaco3.read.test.js`.

O arquivo `.sonarcloud.properties` define `sonar.sources` e `sonar.tests` com caminhos reais. O recorte não altera o tratamento dos Quality Gates, mas modifica quais arquivos são analisados.

## Fronteira com o legado

- `shared/utils.js`, `shared/Validators.js`, login e cadastro antigos são dependências; riscos na interface entre as nossas rotas e esses módulos **não devem ser ignorados**. Se a investigação revelar falhas exploráveis nas nossas features devido a dependências legadas, precisamos tratá-las por análise de risco ou PR específico.
- Arquivos mistos (rotas originais que passaram a atender PITACO 3.0) são incluídos **por inteiro**, pois a análise Sonar não separa contribuições por linha de autoria na mesma versão de um arquivo.
- Permanecem fora do recorte automático os endpoints legados sem relação direta com PITACO 3.0 e os detalhes de interface antigos. Não estamos certificando o sistema legado.
- Os testes e builds completos do GitHub Actions permanecem ativos.
- SpO₂ **DEMO** é dado demonstrativo; não calibrado clinicamente.
- Evidências funcionais existentes foram registradas em `docs/MARCO_04_ENCERRAMENTO.md`; mudar o recorte de análise não substitui uma validação de integração real com Azure, Unity e MongoDB.

## Procedimento de avaliação

1. Rodar análise automática do Sonar no PR e confirmar o escopo efetivo (arquivos incluídos e regras aplicadas).
2. Mapear cada issue por caminho, severidade, impacto no contrato, necessidade de correção e teste de regressão.
3. Priorizar erros introduzidos pelo PITACO 3.0, vazamento/cross-account nas nossas rotas, exceções e qualidade dos dados.
4. Criar PRs **pequenos**, sem reescrever login, cadastro ou módulos antigos que não sustentem um risco comprovado.
5. Verificar índices reais no Atlas, POST 201/200/409, GET de séries e regressão de equipamentos legados antes de considerar a entrega validada.
