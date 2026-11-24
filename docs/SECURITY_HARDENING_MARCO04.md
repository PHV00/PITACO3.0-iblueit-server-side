# Hardening de segurança — PITACO 3.0 Backend (após Marco Funcional 04)

**Status: PR em desenvolvimento; NÃO publicado no Azure; NÃO pronto para merge isolado.**

**Baseline anterior:** `a70fb1ba9f8b0338f0385a2e156967ad271746d8`, em `baseline/marco-funcional-04-2026-11-24`. PR documental do marco: [#6](https://github.com/PHV00/PITACO3.0-iblueit-server-side/pull/6).

## Mudanças em análise

- Hash bcrypt para **todos** os novos usuários; migração oportunística de contas legadas após login correto (contas inativas precisam de migração/recuperação independente).
- Sessão de usuário com token aleatório de 256 bits, armazenado somente como hash SHA-256 na coleção `authsessions`; validade de duas horas. Uso: `Authorization: Bearer <sessionToken>`.
- Criação de administradores só via sessão de outro administrador; bootstrap da primeira conta exige variável `ADMIN_BOOTSTRAP_TOKEN`, que deve ser removida após uso.
- Criação de paciente, emissão de token, exclusão e consulta de conta de paciente com verificação de administrador e escopo por conta.
- `GET /pacients/:id/account` **não retorna** campo `password`, mesmo quando a senha está armazenada como hash.
- E-mail de boas-vindas sem senha; logs de criação não incluem objeto do usuário.
- `query.js` não guarda URI MongoDB e não imprime documentos de paciente; usa `MongoDbAtlas` do ambiente.
- `SendPlataformOverview` mantém Unity/GameToken e contrato de persistência, mas exige que o paciente exista na conta do GameToken.
- Correção da exclusão em transação MongoDB com `await` e `endSession` no `finally`; correção de filtros regex/paginação e id inválido.

## Dependências e limites operacionais

1. **Incidente de possível segredo exposto:** verificar no MongoDB Atlas se a credencial anteriormente publicada em `query.js` ainda funciona; se sim, **rotacionar/revogar no Atlas** e atualizar `MongoDbAtlas` no Azure. Não é suficiente remover o segredo de um único commit: versões antigas no GitHub podem permanecer acessíveis. Não rotacionamos credenciais com este PR.
2. **Frontend acoplado:** o frontend anterior lia `password` e acionava `POST /token` apenas com `userId`; após a mudança, a interface precisará aceitar `sessionToken` do login, enviar `Authorization` nas rotas administrativas e mostrar procedimento de redefinição em vez de exibir senha.
3. **Mudança de API:** `POST /register` e `POST /token` exigem sessão de administrador (exceto bootstrap seguro da primeira conta). `GET /pacients/:id/account` muda resposta e exige sessão de administrador. `DELETE /pacients/:id` exige sessão de administrador. Esses endpoints NÃO devem ser implantados antes da atualização compatível do frontend.
4. **GameToken:** permanece credencial legada de telemetria. Atualmente também delimita históricos em `_gameToken`. **Rotacionar GameToken sem migração de identidade estável de conta desconectará dados históricos.** Não rotacionar GameToken automaticamente nesta etapa.
5. **Escopo ainda pendente:** identidade de paciente para todas as leituras, migração completa de contas legadas, revogação explícita/logout no backend, quotas/rate limits, auditoria de dependências e testes end-to-end em ambiente Azure de homologação. Não declarar essas garantias concluídas.
6. **MongoDB transactions:** exigem deployment MongoDB que suporte transações (Atlas replica set). A transação de exclusão multi-coleção precisa de teste com banco de desenvolvimento.
7. **Login:** mantém os campos legados de resposta (incluindo `gameToken`) **temporariamente** para compatibilidade; recomenda-se separar credencial de dispositivo da sessão de paciente na próxima fase.

## Validação

- `npm test` executa suites existentes de contrato, endpoint, leitura, e regressão da nova sessão/autorização.
- Análise Sonar automática no PR; não desativar Quality Gate.
- Verificar testes negativos entre duas contas A/B para criação, consulta, envio e exclusão.
- Testar login de Administrator e User (hash novo e senha legada com migração), token expirado, bootstrap desabilitado e redaction de logs.
- Testar `POST /plataforms` Unity 201/200/409 e GET de sinais sem modificação de formato.
- Implantação somente após revisão do PR frontend correspondente e validação de acesso/índices no Azure/Atlas.
