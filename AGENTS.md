# Diretrizes do Projeto & Regras de Repositórios

## Regra Estrita: Extensão do Chrome (Brokiva)
Sempre que houver correções, novos desenvolvimentos, refatorações ou qualquer atualização na extensão do Chrome (Brokiva), o trabalho e os commits/pushes para o Git **DEVEM SER FEITOS NA PASTA E REPOSITÓRIO DEDICADO**:

- **Pasta Local:** `/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension/`
- **Git Oficial:** `https://github.com/r-fsena/brokiva-chrome-extension.git` (branch `main`)

### Procedimento Mandatório para o Agente:
1. Editar os arquivos diretamente em `/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension/`.
2. Executar validação de sintaxe (`node -c`).
3. Comitar e fazer push no repositório da extensão:
   ```bash
   git -C "/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension" add .
   git -C "/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension" commit -m "..."
   git -C "/Users/rafaelsena/Desktop/Projetos-apps/brokiva-chrome-extension" push origin main
   ```
4. Opcionalmente, manter espelhada a pasta `/Users/rafaelsena/Desktop/Projetos-apps/CRM /chrome-extension/` para referência histórica do monorepo, mas a fonte oficial de verdade é a pasta `brokiva-chrome-extension`.
