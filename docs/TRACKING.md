# Partidas (beta fechado, grupos e privacidade)

O frontend chama `/tracking` com o JWT do login Steam. As partidas ficam abertas
para quem tem acesso (`users.accessGrantedAt`):

- **Fundadores** (`TRACKING_ALLOWED_STEAM_IDS`) ganham acesso na primeira visita,
  fora do limite de vagas, e recebem o resumo de cada partida por DM no Discord
  (Clodoaldo). Os comandos `/cs2` do Clodoaldo também só falam deles.
- **Os demais** entram por um link `/convite/<código>`: convite de grupo (qualquer
  membro copia, o dono troca) ou convite de acesso (criado por admin em `/grupos`,
  com número de usos). Quem entra ocupa uma vaga até `TRACKING_MAX_USERS` (30).
- **Admins** (`TRACKING_ADMIN_STEAM_IDS`) veem as vagas, geram convites de acesso e
  tiram o acesso de alguém (a importação dessa pessoa é desligada).

Privacidade: histórico e placar completo só para quem jogou a partida; perfil
(`/perfil/<steamid>`), ranking e "jogaram juntos" (`/grupos/<id>`) só para quem
divide algum grupo. Não há perfil público. Limites: 10 grupos por pessoa,
20 pessoas por grupo. "Excluir meus dados" (perfil) desliga a importação, apaga os
grupos criados pela pessoa, tira dos outros, apaga links e convites, libera a vaga e
remove as partidas que só ela importou e em que nenhum outro usuário com acesso jogou.

Link de partida: `/partidas/<id>-<código>`, um código por pessoa (`match_shares`). A
miniatura mostra quem compartilhou e quem divide grupo com ela, se `allowPreview`
estiver ligado no perfil. Links antigos (chave HMAC de 16 hex) continuam valendo e
mostram os fundadores.

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

## Mapa de abates

Desde a análise versão 3, cada partida guarda a lista de mortes (`analysis.kills`):
round, tempo desde o fim do freeze time, quem matou, quem morreu, arma,
headshot, lado de cada um e as coordenadas do jogo (X/Y/Z) dos dois. A página
da partida desenha isso sobre os radares de `public/images/maps` com a
calibração de `cs2-smokes/lib/radar.ts` (conferida com mortes reais em Mirage,
Nuke, Inferno e Ancient; Dust2, Overpass e Train usam os valores oficiais, ainda
sem conferência; Vertigo e Anubis não têm radar no site).

Partidas de versões antigas são reprocessadas com o coletor parado (uma sessão
Steam por vez), enquanto a Valve ainda tiver a demo:

```
docker stop cs2-smokes-collector
COMPOSE_PROJECT_NAME=cs2-smokes-hub-api docker compose -f compose.production.yml --profile tracking \
  run --rm --no-deps collector node dist/src/tracking/worker/main.js --backfill
docker start cs2-smokes-collector
```

## Métricas e limites

- K/D = eliminações / mortes; sem mortes, indisponível.
- ADR = soma do dano / soma dos rounds dos jogos com dano disponível.
- HS% = soma dos headshots / eliminações nos jogos com headshots disponíveis.
- Vitórias = partidas vencidas / partidas importadas (empates no denominador).
- Filtro de grupo: todos os IDs configurados no mesmo time.

Não há promessa de recuperar todo o passado: a Valve precisa ainda ter a demo.
O coletor trata partidas completas de 5×5 e Duplas (Wingman) 2×2. O placar de
Duplas também tem dez slots no Game Coordinator: seis IDs de conta zero são
ignorados, mantendo os índices originais de time e K/D/A. Cada participante
real precisa constar na demo e conferir com o placar da Valve. Escalações
incompletas, duplicadas ou de formatos incompatíveis não são publicadas.
O parser foi validado com uma demo real de Inferno: 10 jogadores, 21 rounds e
K/D/A conferidos com o placar do Game Coordinator. O fluxo automático completo
ainda precisa ser validado após configurar a conta dedicada e os códigos. KAST, clutches, trades, rating proprietário e replay 2D não fazem parte
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

## Estado da migração — 05/11/2026

Neon restaurado no koala: 4 usuários, 7 mapas, 15 smokes, 9 avaliações e
3 denúncias; conteúdo integral das tabelas conferido por assinaturas. Backup
privado em `~/apps/cs2-smokes-hub-api/migration-backup/`. Neon preservado para
retorno. URLs antigas da Vercel redirecionam ao koala; novos builds Vercel
desativados em `vercel.json`. Deploy e monitoramento via GitHub Actions e bot.
Coletor mantido pausado por escolha do proprietário, aguardando conta dedicada.
