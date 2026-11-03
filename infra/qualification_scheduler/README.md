# Agendador dedicado da qualificação

Stack isolada `brokiva-qualification-scheduler-v2`, função `brokiva-qualification-scheduler`, conta `896884286429`, região `us-east-1`.
Não execute o Terraform geral nem `infra/scripts/deploy-aws.sh` para esta implantação.

EventBridge Scheduler invoca uma Lambda a cada cinco minutos, sem janela flexível.
A Lambda chama apenas `POST https://crm.faithhubs.com/api/internal/qualification/run`.
Cada ciclo confirma até quatro solicitações de até 26 segundos; histórico restante fica
para o próximo ciclo. O backend mantém as reservas e a fila durável por conversa.
Isso não habilita envios WhatsApp, campanhas ou IA externa. Gemini permanece desligado.

## Implantação

Use AWS CloudShell ou terminal autenticado na conta indicada. Python 3 e boto3 são
necessários (já disponíveis no CloudShell). Execute a partir da raiz deste repositório:

```bash
python3 -m unittest discover -s infra/qualification_scheduler -p 'test_*.py'
python3 infra/qualification_scheduler/deploy.py --render /tmp/qualification-template.json
aws cloudformation validate-template --template-body file:///tmp/qualification-template.json --region us-east-1
python3 infra/qualification_scheduler/deploy.py --plan
```

Revise o change set: somente recursos próprios desta stack, incluindo duas funções IAM
com permissões restritas. Em seguida execute o nome retornado pelo plano:

```bash
python3 infra/qualification_scheduler/deploy.py --execute-change-set NOME_REVISADO
python3 infra/qualification_scheduler/deploy.py --status
python3 infra/qualification_scheduler/deploy.py --activate
```

O agendamento nasce `DISABLED`. A ativação exige primeiro uma resposta válida do CRM
em uma invocação manual; somente depois habilita a cadência. Guarde o `activationTime`.
O segredo existente no Amplify é copiado em memória para o SSM SecureString
`/brokiva/qualification/cron-secret`, sem aparecer no template, Git, logs ou saída.
Se o parâmetro existente for diferente, a operação para: rotação deve ser explícita.
A Lambda só pode ler esse parâmetro, publicar suas métricas/logs e registrar falhas na
sua fila. O Scheduler só pode invocar essa Lambda e registrar falhas na mesma fila.

## Aceite e troca do cron

```bash
python3 infra/qualification_scheduler/verify.py --since HORARIO_UTC_DA_ATIVACAO
```

O aceite exige pelo menos 12 horários nativos distintos, separados por 300 segundos,
atraso de início de até 90 segundos, nenhuma falha e quatro alarmes `OK`.
Invocações manuais e múltiplas solicitações dentro do mesmo ciclo não contam.
O comando retorna 2 enquanto o aceite não estiver comprovado; retorna 0 ao validar.
Não remova `on.schedule` de `.github/workflows/qualification-worker.yml` antes disso.
Após o aceite, mantenha `workflow_dispatch` como contingência manual. O cron antigo
pode coexistir durante a conferência porque o backend reserva cada trabalho de forma
atômica. Registre os recibos e o commit da troca sem incluir dados de clientes.

## Operação e falhas

O painel CloudWatch reúne recibos sanitizados e os alarmes: ausência de confirmação
por dois períodos de cinco minutos, erro da Lambda, descarte pelo Scheduler e fila
de falhas não vazia. Retries do Scheduler tratam falha de entrega à Lambda; os dois
retries assíncronos da Lambda tratam falhas do código/HTTP. Não há reserva de concorrência
da Lambda: a conta recusou até uma reserva de 1, pois precisa manter dez execuções sem
reserva. A exclusão de trabalho por conversa continua nas reservas atômicas do CRM;
uma eventual sobreposição de invocações não deve processar a mesma reserva duas vezes.
A fila mantém falhas por 14 dias; logs, por 30 dias. Não reenvie a fila inteira sem
conferência. Novos ciclos regulares continuam a fila durável do CRM.

Os alarmes publicam em um tópico SNS próprio. **Por padrão não há destinatário de
e-mail/SMS**: os estados ficam no console. Para aviso por e-mail, informe um endereço
autorizado via `--alert-email` no plano e confirme a assinatura recebida. Não registre
endereços ou segredos no repositório. Em uma stack já ativa, use
`deploy.py --configure-alerts --alert-email ENDERECO_AUTORIZADO`; esse modo preserva
o estado do agendamento. Sem assinatura confirmada, não prometa aviso por e-mail.
Os alarmes ficam com ações desativadas enquanto o schedule está desativado.

Para interromper com segurança, atualize o parâmetro CloudFormation `ScheduleState`
para `DISABLED`, preservando os outros parâmetros. A fila e os logs têm `Retain`.
Não apague o parâmetro SSM durante rollback. Para voltar ao cron GitHub, restaure
somente seu `on.schedule` após decidir quem será o único agendador principal.

## Recuperação da primeira tentativa

A primeira stack, sem o sufixo `-v2`, reverteu por limite de concorrência da conta.
Seus logs e fila foram retidos. Preserve esse registro e adote os dois recursos na
stack nova com `--plan-import-retained`, revise o plano de importação e use
`--execute-change-set NOME_IMPORT`. Isso não apaga os recursos nem seu conteúdo.
Depois execute `--plan` e aplique o plano normal. A stack nova mantém as mesmas
permissões restritas aprovadas; não é necessário aumentar a cota da conta.
