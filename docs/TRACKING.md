# Partidas do grupo

O frontend chama `/tracking` com o JWT já emitido pelo login Steam. O acesso é
restrito aos SteamIDs em `TRACKING_ALLOWED_STEAM_IDS`. Comparações incluem apenas
membros que ativaram o rastreamento; placares completos só são acessíveis aos
participantes da partida. As estatísticas existentes de smokes não mudam.

## Fluxo

1. Cada jogador configura seu Game Authentication Code e um share code recente.
2. A API cifra o código com AES-256-GCM, nonce aleatório e vínculo ao ID do usuário.
3. Um único coletor consulta `GetNextMatchSharingCode` e persiste a fila junto com
   o cursor numa transação. Falha de download não perde a partida.
4. A conta Steam dedicada consulta o Game Coordinator. O download só aceita
   URLs `replay<numero>.valve.net/730/*.dem.bz2`, sem redirecionamentos.
5. O parser verifica os totais de K/D/A contra o placar final da Valve antes de
   persistir os resultados. Falhas aparecem na fila, nunca como números inventados.

O coletor precisa de uma conta Steam própria. OpenID do site não autentica essa
sessão. Configure um refresh token ou usuário/senha e Steam Guard no arquivo
privado do servidor; nunca no repositório. As credenciais dos jogadores são
inseridas por eles na página `/partidas`.

## Operação no koala

Frontend: `https://cs2.devkoala.com`. API: `/api` no mesmo domínio.
Portas de loopback: frontend 3010, API 3011. Banco próprio `cs2_smokes` na rede
Docker externa `db`. Arquivo privado: `~/apps/cs2-smokes-hub-api/.env`, modo 600.

O Dockerfile usa Debian no coletor para os wheels Linux ARM64 do demoparser2;
o frontend usa Node 22 Alpine. Ambos mantêm os lockfiles npm do projeto.

```
export CS2_API_ENV_FILE=/home/ubuntu/apps/cs2-smokes-hub-api/.env
docker compose -f compose.production.yml --profile migrate --profile tracking build
docker compose -f compose.production.yml --profile migrate run --rm migrate
docker compose -f compose.production.yml up -d api
# Após configurar a conta Steam:
docker compose -f compose.production.yml --profile tracking up -d collector
```

Executar somente uma réplica do coletor. Heartbeat a cada 30 segundos; após
2 minutos a UI informa que aguarda o coletor. Jobs abandonados são recuperados
após 15 minutos. Tentativas usam espera exponencial (máximo 6 horas, 12 tentativas).
Jobs FAILED ficam visíveis para diagnóstico; não são silenciosamente descartados.
Desconectar apaga a credencial e interrompe novas descobertas. Uma análise já
iniciada pode terminar. Partidas processadas permanecem no histórico pessoal.

## Métricas e limites

- K/D = eliminações / mortes; sem mortes, indisponível.
- ADR = soma do dano / soma dos rounds dos jogos com dano disponível.
- HS% = soma dos headshots / eliminações nos jogos com headshots disponíveis.
- Vitórias = partidas vencidas / partidas importadas (empates no denominador).
- Filtro de grupo: todos os IDs configurados no mesmo time.

Não há promessa de recuperar todo o passado: a Valve precisa ainda ter a demo.
Esta versão trata partidas completas de 10 jogadores; Wingman, partidas
incompletas e formatos incompatíveis não são publicados como resultados válidos.
A compatibilidade com uma partida real recente deve ser validada após configurar
os acessos. KAST, clutches, trades, rating proprietário e replay 2D não fazem parte
desta primeira versão. Os testes sintéticos não substituem essa validação real.

## Validação

`npm test -- --runInBand tracking/tracking.spec.ts`, `npm run build` e
`python -m unittest discover -s scripts/tracking -p 'test_*.py'`.

## Migração e retorno

O dump do Neon deve ser feito antes de qualquer alteração, com `pg_dump -Fc`
e restaurado com `--no-owner --no-acl` em banco novo. Comparar contagens de
users/maps/smokes/ratings/reports antes de executar as migrations novas.
Manter o Neon e a implantação antiga até validar os dados e o login no novo
endereço. O histórico de migrations precisa corresponder ao banco restaurado;
nunca usar `migrate reset` em produção. Depois da troca, não aceitar gravações
simultâneas no banco antigo e no novo. O banco novo entra no pg-backup.timer.

Referências: https://github.com/DoctorMcKay/node-globaloffensive e
https://github.com/LaihoE/demoparser.
