# PITACO 3.0 — backend de persistência por etapa

## O que foi alterado

Esta branch atualiza o POST /plataforms, mantendo a rota e as coleções
existentes. Cada documento em flowdatadevices continua sendo associado
a uma execução por plataformoverviews.flowDataDevicesId.

O dispositivo novo é identificado por "Pitaco 3.0". Dentro dele,
o schema reconhece:
- flowData[]: dados respiratórios existentes;
- bpmData[]: frequência cardíaca estimada e qualidade;
- spo2Data[]: estimativa de saturação, status e isDemonstration;
- ppgRawData[]: RED, IR, sequências, contato e timestamps;
- schemaVersion: 1 e rawSamplesOmitted.

A saturação da Unity é demonstrativa, não calibrada clinicamente.
O backend apenas registra o que recebeu. Não modifica IA, Mixer,
DeepDDA, alertas ou filtros do sinal.

## Compatibilidade

Continua aceitando dispositivos "Pitaco", "Manovacuômetro" e "Cinta".
Sinais novos são opcionais. O PITACO 3.0 pode enviar flowData vazio;
nesse caso, maxFlowValue, minFlowValue e meanFlowValue são nulos,
sem lançar exceção no backend.

A API exige clientRunId (GUID de 32 dígitos hexadecimais) para
Pitaco 3.0 e registra esse identificador em plataformoverviews.
Um reenvio da mesma etapa retorna 200 e reutiliza o overview.
Execução nova retorna 201. Se o mesmo ID for usado em outra etapa,
a API retorna 409.

Existe um índice único parcial declarado em PlataformOverview.js,
chamado unique_plataform_stage_run_by_token. Sua criação efetiva
deve ser confirmada no Atlas ANTES dos testes de reenvio concorrente.
Erros no salvamento do overview recebem uma tentativa de limpeza
dos dados de fluxo criados pela requisição. Isso não substitui uma
transação MongoDB.

## Limites e validações

- Resposta HTTP 400 para registros inválidos;
- HTTP 413 para JSON com mais de 9 MiB;
- até 12.000 pares RED/IR por execução;
- até 30.000 estimativas em cada série de BPM/SpO2;
- timestamps devem ser datas válidas; amostras ausentes devem usar null;
- SpO2 demonstração é identificada por isDemonstration;
- clientRunId não deve ser reaproveitado em outra execução.

## Testar primeiro sem banco

Na raiz do repositório:
npm test

O script usa apenas Node.js e assert, sem MongoDB nem token.
A suite tem 13 casos de teste para contrato e compatibilidade.

## Testar conexão real com a API

1. Faça checkout desta branch no repositório backend.
2. Instale as dependências do projeto com npm install.
3. Configure local.settings.json com o MongoDbAtlas e outras
   configurações necessárias. Não faça commit do arquivo.
4. Inicialize a Azure Function localmente com func start.
5. Prepare tests/fixtures/pitaco3-stage.example.json substituindo
   o pacientId sintético pelo ID real de um paciente de teste.
   Use um clientRunId novo para cada execução nova.
6. Envie o JSON por HTTP. Exemplo no Linux:

curl -i -X POST http://localhost:7071/api/plataforms \
  -H "Content-Type: application/json" \
  -H "gametoken: SEU_TOKEN_DE_TESTE" \
  --data-binary @tests/fixtures/pitaco3-stage.example.json

7. Repita a mesma requisição: deve retornar HTTP 200, sem duplicar.
8. Mude apenas o level mantendo clientRunId: deve retornar HTTP 409.
9. Para o primeiro POST (201), anote em data.flowDataDevicesId o ID
   do documento de medidas criado. Consulte:

curl -i -H "gametoken: SEU_TOKEN_DE_TESTE" \
  http://localhost:7071/api/flowdata/ID_DO_FLOW_DATA

10. Confira no JSON retornado os quatro arrays.
11. No Atlas, confirme o vínculo na coleção plataformoverviews
    e o documento na coleção flowdatadevices.
12. Execute também uma etapa legada e confirme o funcionamento anterior.

O fixture possui valores fictícios. Não use seus valores como
medições de um paciente real, nem interprete SpO2 DEMO como clínica.

## Ligação com a Unity

Na branch Unity feature/pitaco3-unity-oximetry-persistence, o
DataManager mantém Pitaco3BackendReady = false e o upload novo
fica guardado localmente. Só habilite o envio da Unity após instalar
e validar esta branch do backend, confirmar o índice parcial e
conferir um POST de teste com o payload real da Unity.

## Limites desta entrega

O código foi enviado para uma branch. A aplicação não foi implantada
em Azure e não houve conexão real ao MongoDB Atlas nesta entrega.
A próxima etapa é o teste da API com credenciais de teste.
