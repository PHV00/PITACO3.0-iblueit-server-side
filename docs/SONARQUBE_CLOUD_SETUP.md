# SonarQube Cloud — preparação da análise estática

**Status: workflow pronto para configuração externa, NÃO conectado nem validado com análise remota.**

## Repositório

[`PHV00/PITACO3.0-iblueit-server-side`](https://github.com/PHV00/PITACO3.0-iblueit-server-side)

A Action `.github/workflows/sonarqube-cloud.yml` prepara análise estática JavaScript adequada ao projeto, usando o scanner oficial do SonarQube Cloud. **Não modifica as Actions de build/testes/deploy Azure existentes** e não precisa de dados reais de pacientes.

## O que falta configurar no SonarQube Cloud

1. Fazer login em [SonarQube Cloud](https://sonarcloud.io) e autorizar explicitamente a integração com o GitHub.
2. Importar **este repositório** como projeto e selecionar análise via GitHub Actions.
3. Registrar nas **GitHub Actions Variables** deste repositório:
   - `SONAR_ORGANIZATION` — chave exata da organização SonarQube Cloud.
   - `SONAR_PROJECT_KEY` — chave exata do projeto SonarQube Cloud.
4. Salvar o token gerado como **GitHub Actions Secret** `SONAR_TOKEN`; nunca colocá-lo no arquivo YAML ou no README.
5. Executar a Action manualmente ou em PR/push, verificar a página do projeto Sonar, quantidade de arquivos efetivamente analisados, problemas e Quality Gate.

O job fica **ignorado** se as duas variables estiverem ausentes. Se elas existirem, mas o token não estiver configurado, uma mensagem explícita informa que **nenhum scan foi executado**. Isso evita declarar conformidade apenas porque existe um workflow.

## Escopo inicial

- Código-fonte: `.`.
- Exclusões de ferramentas/dependências e artefatos: `node_modules/**,tests/**,.github/**,.vs/**,coverage/**,**/local.settings.json,**/release.zip`.
- Sem garantia de cobertura de testes: o Sonar identifica análise estática, mas cobertura só aparece com relatório instrumentado, que exige etapa própria.
- Revisar as exclusões após o primeiro scan. Código não listado no resultado do projeto não pode ser considerado verificado.

## Próximos passos

Depois de uma primeira análise bem-sucedida, anexar link da execução e do projeto Sonar ao [hub IoT](https://github.com/PHV00/RFC-IBlueIt-Pitaco3.0-Multimodal); corrigir problemas por severidade e decidir regras de bloqueio. Não confundir relatório de qualidade com validação clínica de BPM ou SpO₂ DEMO.

Referência: [SonarSource - scan action](https://github.com/SonarSource/sonarqube-scan-action).
