# P18 v0.3.1 — Auditoria de código, assets e SEO

- Atualizados título, descrição, cor de tema e metadados Open Graph/Twitter da página pública.
- Adicionado favicon vetorial leve e removida a dependência do JPG antigo usado como ícone.
- A rota `/admin` passa a usar título/descrição específicos e diretiva `noindex, nofollow`; ao retornar à agenda pública, os metadados públicos são restaurados.
- Removidas referências CSS a duas imagens antigas do layout anterior.
- Removidos cinco assets antigos ou de referência sem uso no runtime.
- Sincronizada a versão do projeto e do lockfile para `0.3.1`.
- O domínio ainda não está definido; canonical e `og:image` não foram inventados nem apontados para localhost.
