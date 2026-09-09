# Regra Obrigatória: Repositório Oficial da Extensão Chrome (Brokiva)

## Contexto e Definição
A extensão do Chrome **Brokiva** possui seu próprio repositório Git e pasta dedicada independente do CRM:

- **Pasta Oficial Local:** `/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension/`
- **Repositório Git Oficial:** `https://github.com/r-fsena/brokiva-chrome-extension.git` (branch `main`)

## Diretrizes Mandatórias para o Agente
1. **Sempre aplicar correções e novas funcionalidades diretamente em:**
   `/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension/`
2. **Sempre realizar `git add`, `git commit` e `git push` no repositório da extensão:**
   `git -C "/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension" push origin main`
3. **Manter espelhada** a pasta interna `/Users/rafaelsena/Desktop/Projetos-apps/CRM /chrome-extension/` caso necessário, mas o repositório principal de build, versão, testes no navegador e deploy da extensão é **SEMPRE** o `brokiva-chrome-extension`.
