# Integracao com Telegram

## Objetivo

O Telegram sera usado como canal auxiliar, nao como fonte principal de dados sensíveis.

Usos previstos:

- Avisar que um relatório ficou pronto.
- Lembrar trial vencendo.
- Alertar sobre pagamento/manual pendente.
- Enviar lembretes leves de rotina.
- Enviar alertas internos para o Super Admin.

## Já previsto no schema

- `telegram_accounts`
- `notification_events`
- `notification_channel = 'telegram'`

## Pendencias

1. Criar bot no BotFather.
2. Definir comandos:
   - `/start`
   - `/vincular`
   - `/ajuda`
   - `/desativar`
3. Criar webhook server-side.
4. Vincular `telegram_chat_id` ao usuario autenticado.
5. Criar opt-out.
6. Garantir que mensagens nao exponham dados completos de crianças.

## Regra de segurança

Enviar apenas notificacoes resumidas. Para ver dados sensíveis, a professora deve abrir o app autenticado.
