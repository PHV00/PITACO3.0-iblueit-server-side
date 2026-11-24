# Alterações do contrato no hardening

- Login `POST /login` retorna todos os campos legados e também `sessionToken` (token opaco aleatório, válido por duas horas; guardar apenas em sessão).
- `POST /register` requer `Authorization: Bearer <sessionToken>` de administrador, exceto bootstrap da primeira conta com segredo `ADMIN_BOOTSTRAP_TOKEN` definido em Azure App Settings.
- `POST /token` exige sessão de administrador da mesma identidade `userId`.
- `GET /pacients/{pacientId}/account` exige sessão administrativa, `GameToken` do administrador e não retorna `password`.
- Novo `POST /pacients/{pacientId}/account/reset-password`: sessão administrativa + `GameToken` do administrador; corpo `{ "password": "nova senha forte" }`; resposta não inclui senha; as sessões prévias da conta são revogadas.
- `DELETE /pacients/{pacientId}` exige sessão administrativa, GameToken e paciente da conta.
- `POST /plataforms` continua com GameToken e mesmos retornos 201/200/409, mas rejeita paciente de outra conta.
- O GameToken continua existindo enquanto a identificação estável de contas não for migrada. A UI do paciente ainda requer fase posterior para limitar todas as consultas legadas por usuário e implementar revogação/logout.
- Todas as mudanças permanecem **fora de produção** até integração com frontend e homologação.

- Novo `POST /logout` com `Authorization: Bearer <sessionToken>` revoga a sessão atual no backend (hash na coleção `authsessions`). O frontend deve chamar este endpoint ao sair.
