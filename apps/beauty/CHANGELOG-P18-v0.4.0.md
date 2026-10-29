# P18 v0.4.0 — Melhorias de agendamento e cadastro

- Reativada a seleção múltipla no agendamento público e manual; duração, valor, preços promocionais e snapshot dos procedimentos são tratados no backend.
- Disponibilidade libera o início no minuto exato do término, sem acréscimos de 60 segundos; a detecção de sobreposição real continua ativa.
- Reaproveitado o seletor de hora/minuto do P17, com visual adaptado à paleta prata/grafite da Ana e mantendo a responsividade.
- Adicionado autocomplete de clientes no agendamento manual e opção de não informar telefone apenas para lançamentos administrativos.
- Reintegrada a importação de contatos vCard (.vcf), com prévia, extração apenas de nome/telefone, deduplicação e contagem de inválidos.
- Preservados filtros avançados, preenchimentos e demais recursos do P18; nenhum dado comercial da Fernanda foi copiado.
- Adicionada migração SQL para bancos MySQL P18 existentes que ainda exigem telefone; nenhuma migração foi executada e nenhum dado real foi alterado nesta mudança.
