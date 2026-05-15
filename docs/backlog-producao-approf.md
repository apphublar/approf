# Backlog de Producao do Approf

Atualizado em: 2026-05-14

## Visao do produto

O Approf e um app de anotacao e organizacao da rotina da professora, com apoio de IA pedagogica para transformar registros do dia a dia em documentacao util, segura e alinhada a Educacao Infantil (0 a 5 anos), sem comparacao entre criancas.

## Objetivo desta fase

Concluir o que falta para sair de preview/mock e operar em modo real de producao, com foco em:

- geracao real por IA;
- persistencia no banco;
- seguranca e auditoria;
- operacao financeira;
- governanca no admin.

## Prioridade imediata (P0)

### 1) IA real com persistencia no banco

- Conectar geracao real com Claude para relatorios, planejamentos e textos pedagogicos.
- Conectar geracao de imagem com ChatGPT para portfolio.
- Criar prompts oficiais com linha pedagogica, BNCC 0 a 5 anos e inclusao de criancas atipicas.
- Registrar versao do prompt em cada geracao.
- Salvar o resultado gerado no banco (nao apenas preview/mock).

### 2) Relatorios de desenvolvimento (fluxo real)

- Salvar relatorios por crianca.
- Permitir edicao de relatorio gerado.
- Permitir gerar ate 2 versoes por crianca por semestre.
- Permitir que a professora escolha a versao final e descarte a outra.
- Criar status: `rascunho`, `aguardando_coordenadora`, `corrigir`, `aprovado`.

### 3) Seguranca critica para producao

- Revisar todas as politicas RLS.
- Garantir que cada professora veja somente seus dados.
- Garantir token seguro com expiracao para links de coordenadora.
- Evitar exposicao de anexos privados.
- Registrar logs de acoes sensiveis.

## Prioridade alta (P1)

### 4) GizTokens e custos

- Mostrar saldo de GizTokens no app da professora.
- Criar tela e historico de consumo de IA.
- Criar pacotes extras pagos quando o limite acabar.
- Conectar pagamento de pacotes extras.
- Criar painel admin para custo por professora, uso mensal e alertas.

### 5) Compartilhamento com coordenadora

- Criar link seguro por turma.
- Criar tela publica segura para acesso da coordenadora.
- Criar confirmacao por codigo no e-mail da coordenadora.
- Registrar nome, e-mail, data e acesso da coordenadora.
- Permitir que a coordenadora aprove, edite ou solicite correcao.
- Notificar a professora quando houver solicitacao de correcao.

### 6) Portfolio pedagogico

- Salvar portfolios por crianca.
- Gerar texto com Claude.
- Gerar capa/imagem com ChatGPT.
- Permitir anexar fotos/documentos como referencia.
- Exportar portfolio em PDF ou imagem.

### 7) Admin operacional completo

- Dashboard de professoras.
- Visualizacao de assinaturas mensal e anual.
- Consumo de IA por professora.
- Controle de liberacoes, bloqueios e pacotes extras.
- Auditoria de acessos e geracoes.

### 8) Pagamentos

- Configurar plano mensal de R$ 36,90.
- Configurar plano anual de R$ 369,00.
- Criar checkout.
- Criar webhooks para ativar/desativar assinatura.
- Criar pagamento avulso de pacotes extras.

## Prioridade media (P2)

### 9) Produto e experiencia

- Melhorar onboarding com quantidade de turmas e criancas.
- Criar area "Minha conta".
- Criar tela de assinatura/plano.
- Criar alertas amigaveis de limite, renovacao e pacote extra.
- Revisar textos finais para producao.

### 10) Deploy e operacao de producao

- Confirmar todas as variaveis na Vercel.
- Testar fluxo completo em producao.
- Configurar dominio final.
- Configurar e-mails transacionais.
- Criar rotina de backup e monitoramento.
- Testar no celular como PWA.

## Ordem sugerida de execucao

1. IA real + salvar no banco (P0.1).
2. Relatorios reais com status e versao (P0.2).
3. Hardening de seguranca e auditoria (P0.3).
4. GizTokens/custos + pagamentos (P1.4 e P1.8).
5. Compartilhamento com coordenadora e portfolio (P1.5 e P1.6).
6. Admin completo e melhorias finais de produto/deploy (P1.7, P2.9, P2.10).

## Definicao de pronto desta fase

Considerar esta fase concluida quando:

- pelo menos um fluxo real de geracao por IA estiver funcionando ponta a ponta;
- o resultado estiver salvo no banco com `prompt_version`, modelo, tokens e custo;
- a professora conseguir editar e finalizar relatorio real por crianca;
- seguranca/RLS e logs sensiveis estiverem validados;
- pagamento e controle de consumo estiverem operacionais para escalar o uso.
