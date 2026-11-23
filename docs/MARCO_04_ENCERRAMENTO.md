# Marco 04 — Encerramento técnico: backend PITACO 3.0

**Data do registro:** 23/11/2026  
**Estado:** escopo de engenharia implementado e integrado; encerramento funcional informado pelo responsável do projeto.  
**Repositório:** `PHV00/iblueit-server-side`  
**Branch consolidada antes deste registro:** `main`, commit `807670342c0ac57f9a0af9f478e25a3c6979a8c1`  
**Frontend correspondente:** https://github.com/PHV00/iblueit-health-Infocharts

## Objetivo encerrado

Disponibilizar persistência e consulta das séries PITACO 3.0 para o I Blue It, integrando a execução do jogo à Azure Functions e ao MongoDB Atlas e permitindo ao Health InfoCharts consultar partidas, fluxo, BPM, SpO₂ demonstrativa e RED/IR.

## Arquitetura entregue

```text
Arduino/MAX30102 + PITACO 3.0
         |
    Unity — I Blue It
         |
 POST /api/plataforms
         |
 Azure Functions / Node.js
         |
 MongoDB Atlas
   |-- plataformoverviews (execução, clientRunId, flowDataDevicesId)
   '-- flowdatadevices     (flowData, bpmData, spo2Data, ppgRawData)
         |
 GET /api/pacients/{pacientId}/plataforms
 GET /api/flowdata/{flowDataDeviceId}
 GET /api/pacients/{pacientId}/plataforms/physiology-summary
         |
 Health InfoCharts / React
```

O padrão de software preservado é **Function-per-Endpoint** (Azure Functions), com modelos Mongoose e utilitários compartilhados em `shared/`. As novas consultas não exigiram migração da estrutura principal das coleções.

## Requisitos atendidos

| Requisito | Estado | Implementação/evidência |
|---|---|---|
| Persistência das quatro séries | Implementado | `SendPlataformOverview/`, `shared/Pitaco3Contract.js`; PR backend #2 |
| Reenvio idempotente por execução | Implementado | HTTP 201/200/409; testes de contrato/endpoint |
| Consultar histórico de partidas | Implementado | `GetPacientPlataformOverview/`; filtros `devices` e `gameDevice`, datas e paginação |
| Consultar dados de uma partida | Implementado | `GetFlowDataDevice/`; retorno completo |
| Comparativos de pacientes da mesma conta | Implementado | `GetPlataformStatistics/`, com escopo `_gameToken` |
| Resumos fisiológicos por execução | Implementado | `GetPacientPlataformPhysiologySummary/` |
| Preservar dispositivos legados | Implementado no contrato | `Pitaco`, `Mano`/Manovacuômetro e `Cinta`; testes de regressão |
| CI e implantação Azure | Aprovados | https://github.com/PHV00/iblueit-server-side/actions/runs/45204560332 |

PRs de entrega: https://github.com/PHV00/iblueit-server-side/pull/2 e https://github.com/PHV00/iblueit-server-side/pull/3.

## Evidências de integração

Em uma execução de engenharia registrada em 23/11/2026 UTC, a integração Unity → Azure → MongoDB foi confirmada com resposta HTTP 201. O documento persistido continha:

- 3.487 amostras de fluxo respiratório;
- 366 estimativas de BPM (incluindo valores nulos);
- 366 estimativas de SpO₂ **DEMO**;
- 4.374 pares RED/IR, sem omissões no registro avaliado.

Essas contagens comprovam **persistência e integridade operacional desse teste**, não calibração clínica nem ensaio sistemático de performance. A verificação funcional das telas após a entrega foi informada pelo responsável do projeto; o CI, por si só, não autentica o navegador nem compara dados de produção contra o Atlas.

## Critérios de aceite e comandos

- `npm test` executa contrato, POST/idempotência e leituras GET, usando mocks sem credenciais do Atlas.
- CI específico (sem deploy): https://github.com/PHV00/iblueit-server-side/actions/runs/45204419976
- Pipeline da `main` com deploy Azure aprovado: https://github.com/PHV00/iblueit-server-side/actions/runs/45204560332
- Contrato e casos de leitura: [PITACO3_READ_API.md](PITACO3_READ_API.md)
- Escrita e compatibilidade: [PITACO3_BACKEND_TESTING.md](PITACO3_BACKEND_TESTING.md)

## Limitações e continuidade

1. **Autorização:** `GameToken` limita os dados à conta/grupo, mas não identifica cada paciente individualmente dentro da mesma conta. Não considerar resolvida a autorização por usuário/papel.
2. **SpO₂ DEMO:** estimativa experimental, sem calibração para uso clínico.
3. **Performance:** leituras de séries completas podem ser custosas; paginação/downsampling no servidor fica como possível evolução.
4. **Avaliação integrada:** a confirmação automatizada disponível cobre testes simulados e o deploy; ensaio autenticado e reproduzível de todos os perfis/rotas permanece trabalho de manutenção caso o sistema seja expandido.

**Conclusão:** marco de integração backend **encerrado no escopo funcional e de engenharia aprovado**, mantendo as limitações identificadas para etapas posteriores. Este documento não altera contratos HTTP nem políticas de acesso.
