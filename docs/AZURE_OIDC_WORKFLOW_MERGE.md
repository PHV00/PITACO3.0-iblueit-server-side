# Conciliação do workflow funcional com o login OIDC novo — backend

**Data:** 24/11/2026.

## Preservação de comportamento

O workflow `.github/workflows/main_iblueit-server-side.yml` continua com os **mesmos passos de compilação, testes, artefatos e deploy** do Marco Funcional 04. A configuração da branch `main`, as Actions e o nome do recurso Azure também continuam iguais. Este PR modifica exclusivamente a **prioridade das credenciais** fornecidas a `azure/login@v2`.

## Identidade nova: três secrets com nomes estáveis

Para utilizar a nova Managed Identity do Deployment Center, configure no **GitHub Actions Secrets** do repositório atual:

- `AZURE_CLIENT_ID` = Client ID da identidade gerenciada **nova** do backend.
- `AZURE_TENANT_ID` = Tenant ID da identidade.
- `AZURE_SUBSCRIPTION_ID` = Subscription ID do recurso Azure.

Os secrets anteriores `AZUREAPPSERVICE_*` foram mantidos como *fallback*. Sem os três novos secrets, o workflow pode continuar tentando usar a conexão antiga e falhar com `AADSTS700213`.

**Subject OIDC exato observado nos logs:**

```text
repo:PHV00@133826934/PITACO3.0-iblueit-server-side@1421418520:ref:refs/heads/main
```

A Managed Identity selecionada deve ter uma credencial federada para esse Subject, com `https://token.actions.githubusercontent.com` (issuer) e `api://AzureADTokenExchange` (audience), e permissão de deploy no recurso.

## Validação

1. Verificar se a credencial federada existe **na identidade cujo Client ID está configurado no GitHub**. Não basta que tenha sido criada em outra identidade.
2. Conferir os três secrets novos no repositório sem expor valores nos logs.
3. Executar os checks de PR e o deploy na branch `main`.
4. Confirmar que o passo `Login to Azure` e a action de deploy passam.
5. Se falhar, não recriar workflows duplicados, nem alterar o código PITACO. Revisar o mapeamento da identidade.

**Limitação:** este PR não pode ler os valores dos secrets GitHub nem acessar a identidade no Azure. Portanto, a conclusão do merge do YAML não confirma a conexão OIDC.
